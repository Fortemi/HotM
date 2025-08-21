use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct EmbeddingRequest { pub model: String, pub input: Vec<String> }

#[derive(Deserialize)]
pub struct EmbeddingResponse { pub embeddings: Vec<Vec<f32>> }

pub async fn embed_texts(texts: Vec<String>, model: &str) -> anyhow::Result<Vec<Vec<f32>>> {
    let req = EmbeddingRequest { model: model.to_string(), input: texts };
    let resp = reqwest::Client::new()
        .post("http://127.0.0.1:11434/api/embeddings")
        .json(&req)
        .send().await?;
    let body: EmbeddingResponse = resp.json().await?;
    Ok(body.embeddings)
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
