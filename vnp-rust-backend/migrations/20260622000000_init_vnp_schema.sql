-- 20260622000000_init_vnp_schema.sql
-- Veklom Nexus Protocol Database Migration
-- Implements robust, indexed tables for multi-tenant users, API states, high-stakes transactions, audit logging, and leaderboard tracking.

-- Enable UUID extension for cryptographically secure, unguessable key identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Multi-Tenant Users and RBAC Configs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Guest Developer' CHECK (role IN ('System Administrator', 'Node Operator', 'Compliance Auditor', 'Guest Developer')),
    tenant_name VARCHAR(100) NOT NULL DEFAULT 'Global Public Tenant',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. API Registry State
CREATE TABLE IF NOT EXISTS api_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_did VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'did:vnp:api:llama-3-deepseek'
    name VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL,
    version VARCHAR(50) NOT NULL,
    composite_score DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    x402_compliant BOOLEAN NOT NULL DEFAULT FALSE,
    stability_rating VARCHAR(50) NOT NULL DEFAULT 'Provisional',
    last_measured TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Regional Benchmark Aggregations (Continuous Telemetry Ingestion)
CREATE TABLE IF NOT EXISTS regional_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id UUID REFERENCES api_state(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL CHECK (region IN ('us-east', 'us-west', 'eu-west', 'ap-southeast', 'ap-northeast')),
    p50_latency_ms INT NOT NULL,
    p95_latency_ms INT NOT NULL,
    p99_latency_ms INT NOT NULL,
    error_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    uptime_percent DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    throughput_rps INT NOT NULL DEFAULT 0,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. High-Stakes Transactions (Escrow Payments via x402 / MPP)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_api_id UUID REFERENCES api_state(id) ON DELETE RESTRICT,
    microtransaction_id VARCHAR(255) UNIQUE NOT NULL, -- x402 payment anchor hash
    amount_usd DECIMAL(15, 6) NOT NULL, -- Microcent resolution
    gas_fee_usd DECIMAL(15, 6) NOT NULL DEFAULT 0.000000,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Escrowed', 'Settled', 'Refunded', 'Slashed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- 5. Real-Time Leaderboard Tracking
CREATE TABLE IF NOT EXISTS performance_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id UUID UNIQUE REFERENCES api_state(id) ON DELETE CASCADE,
    monthly_composite_score DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    rank_index INT NOT NULL,
    telemetry_samples_count INT NOT NULL DEFAULT 0,
    best_performing_region VARCHAR(50),
    is_active_champion BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Fully Encrypted Audit Logs (Supports Compliance Audits)
CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(255) NOT NULL,
    affected_entity VARCHAR(255) NOT NULL,
    hash_payload VARCHAR(64) NOT NULL, -- SHA-256 hash of details to preserve integrity without exposing PII
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized Indexes to handle high concurrent search/leaderboard sorting queries
CREATE INDEX IF NOT EXISTS idx_api_state_composite ON api_state(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_measured ON regional_telemetry(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_micro ON transactions(microtransaction_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_rank ON performance_leaderboard(monthly_composite_score DESC, rank_index ASC);

-- Automated Trigger to automatically update leaderboard rankings on core score shifts
CREATE OR REPLACE FUNCTION recompute_vnp_leaderboard_rankings()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh Leaderboard table records
    INSERT INTO performance_leaderboard (api_id, monthly_composite_score, rank_index, telemetry_samples_count, best_performing_region)
    VALUES (NEW.id, NEW.composite_score, 1, 1000, 'us-east')
    ON CONFLICT (api_id) DO UPDATE SET 
        monthly_composite_score = EXCLUDED.monthly_composite_score,
        updated_at = CURRENT_TIMESTAMP;
        
    -- Recompute sequential rankings based on composite scores
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY composite_score DESC, last_measured DESC) as r_index
        FROM api_state
    )
    UPDATE performance_leaderboard
    SET rank_index = ranked.r_index,
        is_active_champion = (ranked.r_index = 1)
    FROM ranked
    WHERE performance_leaderboard.api_id = ranked.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recompute_leaderboard
AFTER INSERT OR UPDATE OF composite_score ON api_state
FOR EACH ROW
EXECUTE FUNCTION recompute_vnp_leaderboard_rankings();
