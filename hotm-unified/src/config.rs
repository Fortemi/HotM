//! Configuration management for the unified runtime

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub ollama_base_url: String,
    pub embed_model: String,
    pub generation_model: String,
    pub bind_address: String,
    pub bind_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            embed_model: "nomic-embed-text".to_string(),
            generation_model: "gpt-oss:20b".to_string(),
            bind_address: "127.0.0.1".to_string(),
            bind_port: 53211,
        }
    }
}