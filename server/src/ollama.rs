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
