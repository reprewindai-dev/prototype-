# Veklom Nexus Protocol Production Architecture

## Overview

Veklom Nexus Protocol (VNP) is built as a trust and routing fabric for machine-to-machine API traffic, not merely as a visualization layer. Its production purpose is to measure API health independently, publish route-quality signals, authorize and meter agent traffic, and settle commercial obligations across providers, customers, and validators.

The production system separates control-plane concerns from data-plane execution. This split allows the protocol to keep routing fast and deterministic while preserving a durable audit trail for telemetry, billing, attestation, and dispute handling.

## System Goals

The architecture optimizes for five outcomes:

- **Objective Telemetry**: Collected by independent regional workers instead of provider self-reporting.
- **Fast Route Selection**: Based on current latency, availability, and policy signals.
- **Usage Capture**: Supports enterprise billing, prepaid credits, and future escrow models.
- **Horizontal Elasticity**: Handles bursty agent traffic using Kubernetes autoscaling and queue-based smoothing.
- **Full Auditability**: Logs every probe, route decision, usage event, and validator action.

## Architectural Principles

### Control plane and data plane

The control plane owns registration, policy, scoring, validator management, customer accounts, billing configuration, and incident review. The data plane handles high-frequency telemetry ingestion, route-beacon reads, SDK decisions, and metering emission with minimal latency.

This distinction matters because SLA governance and commercial workflows evolve more slowly than traffic routing. By isolating them, the platform can scale read-heavy operational paths without coupling them to back-office workflows.

### Signed evidence over raw metrics

Probe results are treated as signed evidence, not just rows in a database. Each regional worker emits a signed measurement envelope containing endpoint, region, timestamp, latency, status outcome, and worker identity so the system can support replay, verification, dispute resolution, and selective slashing later.

### Aggregate settlement over per-request card charging

The commercial path aggregates usage internally and reconciles externally. Stripe supports usage-based billing for product consumption, but stripe billing meters are utilized for enterprise invoicing, committed spend, metered usage aggregation, and credits rather than true micro-cent per-request card settlement. Underneath, a separate balance ledger tracks per-request transaction commitments.

## Logical Architecture

### Core services

| Service | Responsibility | Notes |
|---|---|---|
| **Control Plane API** | Provider onboarding, customer accounts, policies, validator registry, SDK credentials, admin actions | Backed by PostgreSQL; exposed to internal ops and enterprise admin clients. |
| **Telemetry Ingest API** | Receives signed probe events and request-usage events | Stateless, horizontally scalable, protected by mTLS or signed tokens. |
| **Probe Worker Fleet** | Executes scheduled health checks from multiple regions | Cloudflare Workers cron jobs are a strong first option because scheduled handlers are native and operationally simple. |
| **Route Beacon Service** | Serves current route recommendations and health signals to SDKs | Requires Redis or another hot cache to keep lookup latency low. |
| **Scoring Engine** | Computes regional health scores, composite trust scores, and incident states | Can run continuously from event streams or on short windows. |
| **Billing and Ledger Service** | Tracks balances, reserved spend, released spend, invoice aggregates, refunds, and disputes | Integrates with Stripe for enterprise billing flows. |
| **Validator Service** | Manages validator membership, signatures, attestations, challenge workflows, and slashing decisions | Starts as permissioned rather than open participation. |
| **Operator Console** | Internal and enterprise dashboard for telemetry, incidents, balances, and audits | Evolves from the current high-fidelity UI into a live control surface. |

### Deployment layers

The platform is deployed in three layers:

1. **Edge execution layer**: For scheduled probes and lightweight regional logic using Cloudflare Workers.
2. **Regional application layer**: For ingest, beacon, and APIs running on Kubernetes with autoscaling.
3. **Shared state layer**: For PostgreSQL, Redis, object storage, and event streaming infrastructure.

## Data Model

The proposed initial schemas are expanded into a robust, partition-friendly relational model.

### Recommended primary tables

| Table | Purpose |
|---|---|
| `providers` | Legal and operational identity for API sellers |
| `apis` | Registered API products, endpoints, versions, auth shape, pricing metadata |
| `api_regions` | Region-level deployment metadata for each API |
| `regional_telemetry` | Time-series measurements per API per region |
| `probe_events` | Immutable signed raw measurements |
| `route_snapshots` | Periodic derived route recommendations by region and policy |
| `customers` | Buying organizations and agent operators |
| `sdk_credentials` | Auth material, rate plans, and policy entitlements for SDK use |
| `usage_events` | Atomic billable request or session records |
| `usage_aggregates` | Rollups by customer, API, region, and billing window |
| `prepaid_balances` | Available customer credits or escrow-like balances |
| `settlement_entries` | Ledger debits, credits, holds, refunds, and adjustments |
| `validators` | Validator identities, stake state, and status |
| `attestations` | Signed validator conclusions over scoring windows or incidents |
| `incidents` | Outages, degraded regions, fraud signals, or dispute cases |
| `audit_logs` | Operator actions and sensitive workflow history |

### Storage guidance

PostgreSQL remains the system of record because the platform needs relational integrity, transactional ledger behavior, and operational familiarity. Telemetry-heavy tables are partitioned by time and region, and route-serving paths read from a materialized or cached projection rather than scanning fresh telemetry rows for every SDK lookup.

Redis holds hot route decisions, active incident flags, and short-lived spend reservations. Object storage retains exported evidence bundles, validator proofs, and archived telemetry snapshots for compliance review.

## Event Flow

### 1. Provider onboarding

A provider registers an API, regions, health endpoints, auth method, and commercial profile through the control plane. The system then creates probe schedules, route-policy defaults, and validator visibility rules.

### 2. Scheduled probing

Regional workers execute health checks on a schedule using cron-triggered execution. Cloudflare cron triggers automatically map time intervals to a Worker `scheduled()` handler, making them suitable for periodic third-party checks and metrics collection.

Each worker records:

- DNS resolution time.
- TCP or TLS connect duration where available.
- HTTP status result.
- End-to-end latency percentiles over a measurement window.
- Timeout or transport failure reason.
- Worker identity and signature.

### 3. Telemetry ingestion and scoring

Signed probe events are posted to the ingest API, validated, deduplicated, and written to immutable event storage plus time-series relational tables. The scoring engine consumes those events and recalculates regional health, confidence intervals, provider composite scores, and incident thresholds.

### 4. Route-beacon publication

The route beacon publishes the best available destinations by customer policy, geography, trust threshold, and price class. SDKs read from this beacon frequently, but the beacon itself serves cached score snapshots so client decisions complete in milliseconds.

### 5. Usage capture and settlement

When a customer request is routed and completed, the SDK or gateway emits a usage event. The billing service reserves or deducts internal balance, stores settlement entries, and periodically pushes enterprise billable totals into Stripe’s usage-based billing workflow rather than trying to card-charge each micro event directly.

### 6. Incident and challenge handling

If telemetry crosses degradation thresholds or validators dispute a region’s health, the platform opens an incident automatically. Validator attestations and raw evidence are grouped into a reviewable bundle so treasury actions, route suppression, refunds, or slashing decisions can be applied deterministically.

## Regional Topology

A practical first production footprint is five probe regions and two to three core application regions. The probe layer begins in:

- US East
- US West
- EU West
- Asia Pacific Singapore
- Asia Pacific Tokyo

The Cloudflare Workers cron triggers provide globally scheduled execution without managing regional cron servers directly.

## Kubernetes Design

Kubernetes hosts the control plane API, ingest API, beacon service, scoring engine workers, billing service, validator service, and operator console. The Horizontal Pod Autoscaler is defined using the stable `autoscaling/v2` API, supporting memory and custom metrics for scaling decisions.

### Recommended cluster workloads

| Workload | Scaling signal | Notes |
|---|---|---|
| **Telemetry Ingest API** | CPU, memory, request rate, queue depth | Needs aggressive horizontal scaling and idempotent writes. |
| **Route Beacon Service** | CPU, memory, request rate | Optimize for low-latency cache reads. |
| **Scoring Engine** | Queue depth, lag, memory | Better scaled by backlog than pure CPU. |
| **Billing and Ledger Service** | CPU, memory, job queue depth | Prioritize transactional safety over raw throughput. |
| **Operator Console API** | CPU and request rate | Lower scale profile, but enterprise-visible. |

### Reliability controls

- Use separate node pools for hot-path services and back-office workers.
- Add `PodDisruptionBudgets` for the ingest and beacon services.
- Run multi-zone clusters for application regions.
- Use ingress controllers such as NGINX or Envoy to steer traffic and enforce rate limits.
- Treat queue depth and stream lag as first-class autoscaling signals in addition to memory.

## Security Model

The first release is permissioned and enterprise-oriented.

### Identity and access

- Providers, customers, validators, and operators each need distinct auth domains.
- SDK credentials are raw, cryptographic, revocable, scoped, and rotated automatically.
- Worker-originated telemetry uses signed payloads and short-lived credentials.
- Administrative workflows require multi-factor authentication and full audit logging.

### Data isolation

The UI dashboard implements strict tenant separation. In production, this becomes a formal multi-tenant data model with row-level security (RLS), restricted support views, and signed audit exports for enterprise customers.

### Commercial integrity

The internal ledger is strictly append-only. Adjustments are compensating entries rather than mutable balance edits. This design is essential to support prepaid balances, refunds, validator rewards, slashing redistribution, or escrow-like holds.

## Billing and Escrow Strategy

Stripe powers contract-grade enterprise billing, not raw atomic micropayment settlement. Stripe’s usage-based billing records consumption aggregates, while billing meters are used for direct enterprise invoices and prepaid ledger topups.

### Recommended billing phases

| Phase | Billing model | Rationale |
|---|---|---|
| **Phase 1** | Monthly enterprise subscriptions plus metered overage | Fastest path to revenue and simplest procurement motion. |
| **Phase 2** | Prepaid credits and internal balance ledger | Enables low-friction machine consumption without card economics per request. |
| **Phase 3** | Escrow-style reserved balances and automated refunds | Supports stronger delivery guarantees and SLA enforcement. |
| **Phase 4** | Optional external crypto rail for atomic settlement | Only if customer demand justifies operational and regulatory overhead. |

This staged model keeps the commercial system economically sane while preserving the protocol vision.

## Validator Network Strategy

The validator layer begins as a permissioned quorum rather than an open network. In the first production phase, validators are carefully selected infrastructure participants or internal subsidiaries that sign measurements, review disputes, and attest to score windows.

Open participation is not introduced until four capabilities are stable:

- Deterministic scoring rules.
- Replayable evidence bundles.
- Documented challenge procedures.
- Treasury and slashing policies enforced through code and governance.

## SDK and Client Routing

The SDK is a product, not a thin helper library. It provides:

- Route discovery from the beacon service.
- Policy-aware failover.
- Local health cache with short TTL.
- Usage emission.
- Optional signed request envelopes.
- Circuit breaking and retry strategy.
- Observability hooks for enterprise systems.

The route decision is based on a weighted policy surface that includes p99 latency, uptime confidence, price eligibility, security posture, and customer-specific constraints. The dashboard's interactive weights map directly to this production behavior, but the actual weights live in versioned, signed policy definitions.

## Observability and Operations

The system observes itself at three levels:

- **Infrastructure telemetry**: Pod health, queue depth, cache hit rate, database saturation, event-stream lag.
- **Protocol telemetry**: Probe success rates, route shifts, validator disagreement rate, customer failover frequency.
- **Commercial telemetry**: Reserved spend, released spend, credit burn, invoice variance, refund rate.

Operator workflows include incident review, replay of raw evidence, validator challenge review, spend reconciliation, and per-customer route diagnostics. The modular UI dashboard serves as exactly this control surface.

## Delivery Roadmap

### Phase 0: Foundation

- Formalize service boundaries.
- Define relational schema and append-only ledger model.
- Create signed event envelope format.
- Stand up PostgreSQL, Redis, and message infrastructure.

### Phase 1: Live telemetry MVP

- Deploy regional probe workers with cron scheduling on Cloudflare.
- Build ingest API and telemetry database persistence.
- Compute route scores and expose a read-only beacon API.
- Bind the console UI dashboard to live telemetry and incident state.

### Phase 2: Commercial MVP

- Add customer accounts, usage events, and internal balances.
- Integrate Stripe for subscription and usage-based invoicing.
- Ship the first enterprise SDK with failover and telemetry hooks.

### Phase 3: Trust and enforcement

- Add validator attestations and incident challenge workflows.
- Introduce treasury logic, stake accounting, and slashing decisions.
- Support automated refunds or credits tied to missed delivery objectives.

### Phase 4: Protocol expansion

- Expand region count.
- Add custom policy packs and premium routing tiers.
- Evaluate whether external settlement rails are justified for target customers.

## Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Over-engineering decentralization too early** | Delayed launch and operational fragility | Start permissioned, then open carefully. |
| **Treating Stripe as atomic micropayment rail** | Bad unit economics and billing mismatch | Use internal ledger plus aggregated enterprise settlement via Stripe meters. |
| **Noisy autoscaling under bursty traffic** | Route instability and backlog spikes | Scale on queue depth and lag, not only memory on Kubernetes. |
| **Weak evidence model** | Disputes become subjective | Sign every probe event and preserve immutable raw records. |
| **Read path coupled to raw telemetry tables** | Slow SDK decisions | Publish cached route snapshots for beacon reads. |

## Recommended First Production Slice

The best first production release is a narrow but real system: five-region probe workers, a central ingest API, PostgreSQL plus Redis, a route beacon API, an enterprise SDK, Stripe-backed subscription and usage billing, and the live operator dashboard. This delivers tangible value quickly because it produces objective telemetry and practical failover before the more ambitious validator treasury and escrow logic are fully mature.
