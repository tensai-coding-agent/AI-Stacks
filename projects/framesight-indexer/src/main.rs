use anyhow::Result;
use tracing::{info, warn, error};
use std::sync::Arc;

mod config;
mod db;
mod events;
mod indexer;
mod contracts;
mod api;

use config::Config;
use db::Database;
use indexer::Indexer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .init();

    info!("Starting FrameSight Indexer for ERC-8141");

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded successfully");

    // Initialize database
    let db = Arc::new(Database::new(&config.database_url).await?);
    info!("Database connection established");

    // Run migrations
    db.run_migrations().await?;
    info!("Database migrations completed");

    // Start API server if enabled
    #[cfg(feature = "api")]
    if config.api_enabled {
        let api_db = db.clone();
        let api_config = config.clone();
        tokio::spawn(async move {
            if let Err(e) = api::start_server(api_config, api_db).await {
                error!("API server error: {}", e);
            }
        });
        info!("API server started on {}", config.api_bind_address);
    }

    // Initialize and start indexer
    let indexer = Indexer::new(config, db).await?;
    
    info!("Indexer initialized, starting event processing...");
    
    // Handle shutdown signals
    let shutdown = setup_shutdown_handler();
    
    // Run indexer with graceful shutdown
    tokio::select! {
        result = indexer.run() => {
            if let Err(e) = result {
                error!("Indexer error: {}", e);
                return Err(e);
            }
        }
        _ = shutdown => {
            info!("Shutdown signal received, stopping indexer...");
            indexer.shutdown().await?;
            info!("Indexer stopped gracefully");
        }
    }

    Ok(())
}

fn setup_shutdown_handler() -> tokio::sync::oneshot::Receiver<()> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    tokio::spawn(async move {
        let mut sigterm = tokio::signal::unix::signal(
            tokio::signal::unix::SignalKind::terminate()
        ).expect("Failed to setup SIGTERM handler");
        let mut sigint = tokio::signal::unix::signal(
            tokio::signal::unix::SignalKind::interrupt()
        ).expect("Failed to setup SIGINT handler");
        
        tokio::select! {
            _ = sigterm.recv() => {
                info!("Received SIGTERM");
            }
            _ = sigint.recv() => {
                info!("Received SIGINT");
            }
        }
        
        let _ = tx.send(());
    });
    
    rx
}
