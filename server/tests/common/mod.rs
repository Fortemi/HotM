use sqlx::postgres::{PgPool, PgPoolOptions};
use uuid::Uuid;
use std::env;

pub async fn setup_test_db() -> PgPool {
    let db_name = format!("test_hotm_{}", Uuid::new_v4().simple());
    let db_url = env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost".to_string());
    
    // Create test database
    let pool = PgPoolOptions::new()
        .connect(&db_url)
        .await
        .expect("Failed to connect to Postgres");
    
    sqlx::query(&format!("CREATE DATABASE {}", db_name))
        .execute(&pool)
        .await
        .expect("Failed to create test database");
    
    // Connect to test database
    let test_db_url = format!("{}/{}", db_url, db_name);
    let test_pool = PgPoolOptions::new()
        .connect(&test_db_url)
        .await
        .expect("Failed to connect to test database");
    
    // Create pgvector extension
    sqlx::query("CREATE EXTENSION IF NOT EXISTS vector")
        .execute(&test_pool)
        .await
        .expect("Failed to create vector extension");
    
    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&test_pool)
        .await
        .expect("Failed to run migrations");
    
    test_pool
}

pub async fn cleanup_test_db(pool: PgPool, db_name: &str) {
    pool.close().await;
    
    let db_url = env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost".to_string());
    
    let pool = PgPoolOptions::new()
        .connect(&db_url)
        .await
        .expect("Failed to connect to Postgres");
    
    sqlx::query(&format!("DROP DATABASE IF EXISTS {}", db_name))
        .execute(&pool)
        .await
        .expect("Failed to drop test database");
}

pub fn test_note_content() -> String {
    "# Test Note\n\nThis is a test note for integration testing.".to_string()
}