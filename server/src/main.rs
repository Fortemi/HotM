use axum::{Router};
use axum::routing::{get, post, put};
use hotm_server::{db::AppState, routes};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load env (.env) if present
    let _ = dotenvy::dotenv();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "hotm_server=info,axum=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set (e.g., postgres://user:pass@host:5432/db)");

    let state = AppState::connect(&database_url).await?;

    let app = Router::new()
        .route("/api/v1/health", get(routes::health::health))
        .route("/api/v1/notes", post(routes::notes::create_note))
        .route("/api/v1/notes/:id", get(routes::notes::get_note))
        .route("/api/v1/notes/:id/revised", put(routes::notes::put_revised))
        .route("/api/v1/search", get(routes::search::search))
        .route("/api/v1/semantic", post(routes::search::semantic))
        .route("/api/v1/tags", post(routes::taxonomy::create_tag))
        .route("/api/v1/notes/:id/tags", put(routes::taxonomy::put_note_tags))
        .route("/api/v1/collections", post(routes::taxonomy::create_collection))
        .route("/api/v1/notes/:id/collection", put(routes::taxonomy::put_note_collection))
        .route("/api/v1/notes/:id/links", post(routes::links::post_link))
        .route("/api/v1/notes/:id/provenance", get(routes::provenance::get_provenance))
        .with_state(state);

    let addr: SocketAddr = "127.0.0.1:53211".parse().unwrap();
    tracing::info!(%addr, "HotM server listening");
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
