use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize)]
pub struct EmbeddingRequest { 
    pub model: String, 
    pub prompt: String  // Ollama uses 'prompt' not 'input'
}

#[derive(Deserialize)]
pub struct EmbeddingResponse { 
    pub embedding: Vec<f32>  // Ollama returns single embedding not array
}

pub async fn embed_texts(texts: Vec<String>, model: &str) -> anyhow::Result<Vec<Vec<f32>>> {
    let mut embeddings = Vec::new();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
    
    // Ollama processes one text at a time for embeddings
    for text in texts {
        let req = EmbeddingRequest { 
            model: model.to_string(), 
            prompt: text.clone()
        };
        
        tracing::debug!("Requesting embedding for text (length: {})", text.len());
        
        let resp = client
            .post("http://127.0.0.1:11434/api/embeddings")
            .json(&req)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to get embedding from Ollama: {}", e);
                e
            })?;
            
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            tracing::error!("Ollama embedding error: {} - {}", status, text);
            anyhow::bail!("Ollama embedding failed: {} - {}", status, text);
        }
        
        let body: EmbeddingResponse = resp.json().await?;
        embeddings.push(body.embedding);
    }
    
    Ok(embeddings)
}

#[derive(Serialize)]
pub struct GenerateRequest { pub model: String, pub prompt: String, #[serde(skip_serializing_if = "Option::is_none")] pub stream: Option<bool> }
#[derive(Deserialize)]
pub struct GenerateResponse { pub response: String }

pub async fn generate(model: &str, prompt: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))  // Longer timeout for generation
        .build()?;
        
    let req = GenerateRequest { 
        model: model.to_string(), 
        prompt: prompt.to_string(), 
        stream: Some(false) 
    };
    
    tracing::debug!("Generating text with model {} (prompt length: {})", model, prompt.len());
    
    let resp = client
        .post("http://127.0.0.1:11434/api/generate")
        .json(&req)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate from Ollama: {}", e);
            e
        })?;
        
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        tracing::error!("Ollama generation error: {} - {}", status, text);
        anyhow::bail!("Ollama generation failed: {} - {}", status, text);
    }
    
    let body: GenerateResponse = resp.json().await?;
    Ok(body.response)
}
