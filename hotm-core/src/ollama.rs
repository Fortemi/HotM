//! Ollama client integration
//! 
//! This module provides Ollama functionality that can be shared between
//! server and unified runtime modes. Migrated from server/src/ollama.rs

#[cfg(feature = "ollama")]
pub use client::*;

#[cfg(feature = "ollama")]
pub mod client {
    use anyhow::Result;
    use serde::{Deserialize, Serialize};
    use std::time::Duration;
    use tracing::{debug, error, warn};

    #[derive(Serialize)]
    pub struct EmbeddingRequest {
        pub model: String,
        pub prompt: String, // Ollama uses 'prompt' not 'input'
    }

    #[derive(Deserialize)]
    pub struct EmbeddingResponse {
        pub embedding: Vec<f32>, // Ollama returns single embedding not array
    }

    #[derive(Serialize)]
    pub struct GenerateRequest {
        pub model: String,
        pub prompt: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub stream: Option<bool>,
    }

    #[derive(Deserialize)]
    pub struct GenerateResponse {
        pub response: String,
    }

    /// AI Service trait for testability and abstraction
    #[async_trait::async_trait]
    pub trait AIService: Send + Sync {
        async fn embed_texts(&self, texts: Vec<String>, model: &str) -> Result<Vec<Vec<f32>>>;
        async fn generate_text(&self, prompt: &str, model: &str) -> Result<String>;
        async fn health_check(&self) -> Result<()>;
    }

    #[derive(Clone)]
    pub struct OllamaClient {
        base_url: String,
        client: reqwest::Client,
    }

    impl OllamaClient {
        pub fn new(base_url: String) -> Self {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_default();

            Self { base_url, client }
        }
    }

    #[async_trait::async_trait]
    impl AIService for OllamaClient {
        async fn embed_texts(&self, texts: Vec<String>, model: &str) -> Result<Vec<Vec<f32>>> {
            let mut embeddings = Vec::new();

            // Ollama processes one text at a time for embeddings
            for text in texts {
                // Skip empty texts or provide a minimal text
                let prompt_text = if text.trim().is_empty() {
                    warn!("Empty text provided for embedding, using placeholder");
                    "[empty]".to_string()
                } else {
                    text.clone()
                };

                let req = EmbeddingRequest {
                    model: model.to_string(),
                    prompt: prompt_text,
                };

                debug!("Requesting embedding for text (length: {})", text.len());

                let resp = self
                    .client
                    .post(format!("{}/api/embeddings", self.base_url))
                    .json(&req)
                    .send()
                    .await
                    .map_err(|e| {
                        error!("Failed to get embedding from Ollama: {}", e);
                        e
                    })?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_default();
                    error!("Ollama embedding error: {} - {}", status, text);
                    return Err(anyhow::anyhow!("Ollama embedding failed: {} - {}", status, text));
                }

                let body: EmbeddingResponse = resp.json().await?;

                // Validate embedding has data
                if body.embedding.is_empty() {
                    error!("Ollama returned empty embedding for text");
                    return Err(anyhow::anyhow!("Ollama returned empty embedding"));
                }

                embeddings.push(body.embedding);
            }

            Ok(embeddings)
        }

        async fn generate_text(&self, prompt: &str, model: &str) -> Result<String> {
            let req = GenerateRequest {
                model: model.to_string(),
                prompt: prompt.to_string(),
                stream: Some(false),
            };

            debug!(
                "Generating text with model {} (prompt length: {})",
                model,
                prompt.len()
            );

            let resp = self
                .client
                .post(format!("{}/api/generate", self.base_url))
                .json(&req)
                .send()
                .await
                .map_err(|e| {
                    error!("Failed to generate from Ollama: {}", e);
                    e
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                error!("Ollama generation error: {} - {}", status, text);
                return Err(anyhow::anyhow!("Ollama generation failed: {} - {}", status, text));
            }

            let body: GenerateResponse = resp.json().await?;
            Ok(body.response)
        }

        async fn health_check(&self) -> Result<()> {
            let response = self
                .client
                .get(format!("{}/api/tags", self.base_url))
                .send()
                .await?;

            if response.status().is_success() {
                Ok(())
            } else {
                Err(anyhow::anyhow!("Ollama health check failed: {}", response.status()))
            }
        }
    }

    impl Default for OllamaClient {
        fn default() -> Self {
            Self::new("http://localhost:11434".to_string())
        }
    }

    // Convenience functions that match the server API for easy migration
    pub async fn embed_texts(texts: Vec<String>, model: &str) -> Result<Vec<Vec<f32>>> {
        let client = OllamaClient::default();
        client.embed_texts(texts, model).await
    }

    pub async fn generate(model: &str, prompt: &str) -> Result<String> {
        let client = OllamaClient::default();
        client.generate_text(prompt, model).await
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[tokio::test]
        async fn test_ollama_client_creation() {
            let client = OllamaClient::new("http://localhost:11434".to_string());
            assert_eq!(client.base_url, "http://localhost:11434");
        }

        #[tokio::test]
        async fn test_ollama_client_default() {
            let client = OllamaClient::default();
            assert_eq!(client.base_url, "http://localhost:11434");
        }

        // Integration tests require running Ollama
        #[tokio::test]
        #[ignore = "requires running Ollama instance"]
        async fn test_health_check_integration() {
            let client = OllamaClient::default();
            let result = client.health_check().await;
            assert!(result.is_ok());
        }

        #[tokio::test]
        #[ignore = "requires running Ollama instance with embedding model"]
        async fn test_embed_texts_integration() {
            let client = OllamaClient::default();
            let texts = vec!["Hello world".to_string()];
            let result = client.embed_texts(texts, "nomic-embed-text").await;
            assert!(result.is_ok());
            let embeddings = result.unwrap();
            assert_eq!(embeddings.len(), 1);
            assert!(!embeddings[0].is_empty());
        }

        #[tokio::test]
        #[ignore = "requires running Ollama instance with generation model"]
        async fn test_generate_text_integration() {
            let client = OllamaClient::default();
            let result = client.generate_text("Say hello", "gpt-oss:20b").await;
            assert!(result.is_ok());
            let response = result.unwrap();
            assert!(!response.is_empty());
        }
    }
}