// Veklom Nexus Protocol (VNP) - Rust Database Connection Engine
// Optimized for Async PostgreSQL connection pooling using SQLx with Tokio.

use sqlx::{postgres::PgPoolOptions, Pool, Postgres, Error};
use std::time::Duration;
use log::{info, warn, error};

/// Holds our thread-safe, shared database connection pool
#[derive(Clone)]
pub struct DbStore {
    pub pool: Pool<Postgres>,
}

impl DbStore {
    /// Programmatically boots the SQLx Db Connection Pool & runs pending migrations
    pub async fn initialize(database_url: &str) -> Result<Self, Error> {
        info!("Initializing high-throughput SQLx Connection Pool for Veklom Nexus Protocol...");

        // Robustly configure PgPool options to handle high concurrent load conditions
        let pool = PgPoolOptions::new()
            .max_connections(50) // Balance pool load vs PostgreSQL concurrent ceiling
            .min_connections(5)  // Keep warm connections ready in the pool idle queue
            .acquire_timeout(Duration::from_secs(8)) // Don't block async threads indefinitely
            .idle_timeout(Duration::from_secs(600)) // Prune excess idle threads
            .max_lifetime(Duration::from_secs(1800)) // Cycle threads to avoid stale memory leaking
            .connect(database_url)
            .await?;

        info!("Connection Pool successfully established. Handshaking PostgreSQL...");

        let db_store = Self { pool };

        // Programmatically run migrations on start to ensure absolute schema integrity
        db_store.run_embedded_migrations().await?;

        Ok(db_store)
    }

    /// Triggers pending migrations embedded inside the application binary on bootup.
    /// This is equivalent to invoking `sqlx migrate run` via the CLI.
    pub async fn run_embedded_migrations(&self) -> Result<(), Error> {
        info!("Reading embedded migration directories in ./migrations ...");

        // Trigger migrations
        match sqlx::migrate!("./migrations").run(&self.pool).await {
            Ok(_) => {
                info!("✅ All VNP initial migration logs synchronised with the global ledger.");
                Ok(())
            }
            Err(e) => {
                error!("❌ Migrations failed to compile: {:?}", e);
                Err(Error::Migrate(Box::new(e)))
            }
        }
    }

    /// Health Check to ensure Postgres container remains responsive
    pub async fn check_health(&self) -> Result<bool, Error> {
        let row: (i32,) = sqlx::query_as("SELECT 1")
            .fetch_one(&self.pool)
            .await?;
        Ok(row.0 == 1)
    }
}
