use serde::{Deserialize, Serialize};

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
    
    // Ollama processes one text at a time for embeddings
    for text in texts {
        let req = EmbeddingRequest { 
            model: model.to_string(), 
            prompt: text 
        };
        let resp = reqwest::Client::new()
            .post("http://127.0.0.1:11434/api/embeddings")  // Using /api/embeddings endpoint
            .json(&req)
            .send().await?;
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
    let req = GenerateRequest { model: model.to_string(), prompt: prompt.to_string(), stream: Some(false) };
    let resp = reqwest::Client::new()
        .post("http://127.0.0.1:11434/api/generate")
        .json(&req)
        .send().await?;
    let body: GenerateResponse = resp.json().await?;
    Ok(body.response)
}
