use axum::{
    routing::get,
    Router,
    Json,
    extract::State,
    http::StatusCode,
};
use std::sync::Arc;
use serde_json::json;
use tracing::info;

use crate::config::Config;
use crate::db::Database;

pub async fn start_server(config: Config, db: Arc<Database>) -> anyhow::Result<()> {
    let app = create_router(db);
    
    let listener = tokio::net::TcpListener::bind(&config.api_bind_address).await?;
    info!("API server listening on {}", config.api_bind_address);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

fn create_router(db: Arc<Database>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/metrics", get(metrics))
        .route("/status", get(status))
        .with_state(db)
}

async fn health_check() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "status": "healthy",
            "service": "framesight-indexer",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })),
    )
}

async fn readiness_check(State(db): State<Arc<Database>>) -> (StatusCode, Json<serde_json::Value>) {
    // Check database connectivity
    match sqlx::query("SELECT 1").fetch_one(db.pool()).await {
        Ok(_) => {
            (
                StatusCode::OK,
                Json(json!({
                    "status": "ready",
                    "database": "connected",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                })),
            )
        }
        Err(e) => {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "status": "not_ready",
                    "database": format!("error: {}", e),
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                })),
            )
        }
    }
}

async fn metrics() -> (StatusCode, Json<serde_json::Value>) {
    // Basic metrics - in production, you'd want to collect actual metrics
    (
        StatusCode::OK,
        Json(json!({
            "service": "framesight-indexer",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "metrics": {
                "indexer_uptime_seconds": 0, // Would track actual uptime
                "chains_indexed": 0, // Would track from actual state
            },
        })),
    )
}

async fn status(State(db): State<Arc<Database>>) -> (StatusCode, Json<serde_json::Value>) {
    // Get indexing progress for all chains
    let progress = match get_indexing_progress(db).await {
        Ok(progress) => progress,
        Err(e) => json!({"error": format!("{}", e)}),
    };

    (
        StatusCode::OK,
        Json(json!({
            "service": "framesight-indexer",
            "version": env!("CARGO_PKG_VERSION"),
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "indexing_progress": progress,
        })),
    )
}

async fn get_indexing_progress(db: Arc<Database>) -> anyhow::Result<serde_json::Value> {
    let rows = sqlx::query(
        "SELECT chain_id, last_indexed_block, last_indexed_time FROM indexing_progress"
    )
    .fetch_all(db.pool())
    .await?;

    let mut progress = serde_json::Map::new();
    for row in rows {
        let chain_id: i64 = row.get("chain_id");
        let block: i64 = row.get("last_indexed_block");
        let time: chrono::DateTime<chrono::Utc> = row.get("last_indexed_time");
        
        progress.insert(
            chain_id.to_string(),
            json!({
                "last_indexed_block": block,
                "last_indexed_time": time.to_rfc3339(),
            }),
        );
    }

    Ok(serde_json::Value::Object(progress))
}
