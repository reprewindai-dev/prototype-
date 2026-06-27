# VNP Database Engine & Migration Manager (SQLx + PostgreSQL)

This directory houses the **Sovereign Database Control Plane Engine** for the Veklom Nexus Protocol (VNP). Built in Rust using `sqlx` and `tokio`, this engine manages high-performance, asynchronous database connection pooling and executes initial migrations to prepare the database for incoming agent telemetry and x402 billing flows.

---

## 1. System Integration Mapping

Each table defined in our initial schema corresponds directly to a live interactive panel built in our React frontend, providing an absolute bridge between real-time database state and the operational console UI:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Frontend Console                          │
├───────────────────┬───────────────────┬────────────────┬───────────────┤
│    RbacPanel      │  BenchmarkPanel   │ LoadTesting/   │  AlertPanel   │
│  (Users/Roles)    │ (Nodes/Scores)    │  Topology      │  (Incidents)  │
└─────────┬─────────┴─────────┬─────────┴───────┬────────┴───────┬───────┘
          │                   │                 │                │
          ▼                   ▼                 ▼                ▼
┌───────────────────┬───────────────────┬────────────────┬───────────────┐
│       users       │     api_state     │  regional_     │  compliance_  │
│  (RBAC tenants)   │  (SLA metrics)    │   telemetry    │   audit_log   │
└───────────────────┴─────────┬─────────┴────────────────┴───────────────┘
                              │ (Automated PG Trigger)
                              ▼
                    ┌───────────────────┐
                    │    performance_   │
                    │    leaderboard    │
                    └───────────────────┘
```

### Table to UI Alignments:
1. **`users` Table ↔ `RbacPanel`**
   - **Fields**: `id`, `email`, `role`, `tenant_name`
   - **UI Connection**: Controls access levels for "System Administrator", "Node Operator", "Compliance Auditor", and "Guest Developer". Tenant namespaces segment user actions.
2. **`api_state` Table ↔ `BenchmarkPanel`**
   - **Fields**: `api_did`, `name`, `composite_score`, `x402_compliant`
   - **UI Connection**: Populates the "Consensus Peer Verified API Nodes" grid. It tracks whether the API is conforming to x402/MPP billing criteria and computes the live 10-dimensional quality scores.
3. **`regional_telemetry` Table ↔ `LoadTestingPanel` & `NetworkTopologyPanel`**
   - **Fields**: `region`, `p50_latency_ms`, `p95_latency_ms`, `p99_latency_ms`, `error_rate_percent`
   - **UI Connection**: Powers the continuous telemetry stream, the regional topology counts (US-East, US-West, etc.), and coordinates the "Live Network Telemetry Drift" line charts.
4. **`transactions` Table ↔ `LoadTestingPanel` (Operations Desk)**
   - **Fields**: `microtransaction_id`, `amount_usd`, `payment_status`
   - **UI Connection**: Tracks high-stakes escrow payments and microtransaction billing commitments settled via x402 nodes.
5. **`performance_leaderboard` Table ↔ Live Ranking Headers**
   - **Fields**: `api_id`, `monthly_composite_score`, `rank_index`, `is_active_champion`
   - **UI Connection**: Automatically recomputed via the database-level PostgreSQL trigger (`trg_recompute_leaderboard`) when any API's composite score shifts, maintaining a low-latency leaderboard of the healthiest routing endpoints.
6. **`compliance_audit_log` Table ↔ `AlertPanel` (System Diagnostics)**
   - **Fields**: `actor_id`, `action_type`, `hash_payload`
   - **UI Connection**: Maintains cryptographic logs of system modifications, ensuring all operations (such as rate limits and HPA triggers) are fully verifiable and tamper-evident.

---

## 2. SQLx Async Connection Pool Config (`src/db.rs`)

Our Rust connection manager is optimized for high-throughput concurrency:
* **Max Connections (`50`)**: Limits Postgres concurrent socket exhaustion under massive spike conditions.
* **Min Connections (`5`)**: Warm pool of idle connections keeps network handshake latency at absolute zero.
* **Acquire Timeout (`8s`)**: Prevents web threads from blocking indefinitely if the database is locked.
* **Idle Timeout (`10m`)**: Prunes stale idle sockets.
* **Max Lifetime (`30m`)**: Rotates connections to prevent memory leak accumulation over long uptimes.
* **Programmatic Migrations**: Embedded in the compiled binary (`sqlx::migrate!("./migrations")`) so database setup is guaranteed on the very first container boot.

---

## 3. SQLx CLI Migration Management Guide

The `sqlx-cli` utility is the standard tool for creating, tracking, and executing migrations on Postgres.

### 3.1 Installation

Install the SQLx CLI tool globally. You can exclude other drivers by only compiling the `postgres` features:

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

### 3.2 Configuration (`.env`)

SQLx CLI automatically reads from the `DATABASE_URL` environment variable:

```bash
# Define your local or production PostgreSQL URL
export DATABASE_URL=postgres://vnp_admin:secure_password@localhost:5432/vnp_ledger
```

### 3.3 CLI Operations Cheat Sheet

#### Create a New Migration
Generates a new time-prefixed SQL file inside the `migrations/` folder (e.g., `migrations/20260627120000_add_billing_contracts.sql`):
```bash
sqlx migrate add add_billing_contracts
```

#### Run All Pending Migrations
Applies all SQL files that haven't been recorded in the database's `_sqlx_migrations` tracker yet:
```bash
sqlx migrate run
```

#### Revert the Last Applied Migration
Rolls back the most recent schema migration step (note: only works if you supply corresponding down/revert actions, or manually handle rollback blocks):
```bash
sqlx migrate revert
```

#### Inspect Migration Status
Lists all registered migrations and shows whether they are currently applied (`installed`) or pending (`staged`):
```bash
sqlx migrate info
```

---

## 4. Offline Compilation Support (`sqlx prepare`)

VNP Rust microservices compile fast in CI/CD without requiring a live database connection using **SQLx Offline Mode**.

1. **Generate Query Metadata (`sqlx-data.json`)**:
   Ensure your local database is running and up-to-date, then execute:
   ```bash
   cargo sqlx prepare -- --all-targets
   ```
2. **Enable Offline Mode**:
   Set the following flag in your CI build environments:
   ```bash
   export SQLX_OFFLINE=true
   ```
   During build, SQLx will statically validate raw SQL queries against the schema recorded in `sqlx-data.json`, preventing invalid query builds before deployment.
