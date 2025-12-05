use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct EmbeddingRequest {
    pub model: String,
    pub prompt: String, // Ollama uses 'prompt' not 'input'
}

#[derive(Deserialize, Debug, PartialEq)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>, // Ollama returns single embedding not array
}

pub async fn embed_texts(texts: Vec<String>, model: &str) -> anyhow::Result<Vec<Vec<f32>>> {
    let mut embeddings = Vec::new();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    // Ollama processes one text at a time for embeddings
    for text in texts {
        // Skip empty texts or provide a minimal text
        let prompt_text = if text.trim().is_empty() {
            tracing::warn!("Empty text provided for embedding, using placeholder");
            "[empty]".to_string()
        } else {
            text.clone()
        };

        let req = EmbeddingRequest {
            model: model.to_string(),
            prompt: prompt_text,
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

        // Validate embedding has data
        if body.embedding.is_empty() {
            tracing::error!("Ollama returned empty embedding for text");
            anyhow::bail!("Ollama returned empty embedding");
        }

        embeddings.push(body.embedding);
    }

    Ok(embeddings)
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

#[derive(Deserialize, Debug, PartialEq)]
pub struct GenerateResponse {
    pub response: String,
}

pub async fn generate(model: &str, prompt: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120)) // Longer timeout for generation
        .build()?;

    let req = GenerateRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: Some(false),
    };

    tracing::debug!(
        "Generating text with model {} (prompt length: {})",
        model,
        prompt.len()
    );

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

#[cfg(test)]
mod tests {
    use super::*;

    // =============================================================================
    // EMBEDDING REQUEST/RESPONSE STRUCTURE TESTS
    // =============================================================================

    #[test]
    fn embedding_request_serializes_correctly() {
        let req = EmbeddingRequest {
            model: "nomic-embed-text".to_string(),
            prompt: "Hello world".to_string(),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"model\":\"nomic-embed-text\""));
        assert!(json.contains("\"prompt\":\"Hello world\""));
    }

    #[test]
    fn embedding_request_debug_trait() {
        let req = EmbeddingRequest {
            model: "test-model".to_string(),
            prompt: "test prompt".to_string(),
        };

        let debug_str = format!("{:?}", req);
        assert!(debug_str.contains("EmbeddingRequest"));
        assert!(debug_str.contains("test-model"));
    }

    #[test]
    fn embedding_request_equality() {
        let req1 = EmbeddingRequest {
            model: "model-a".to_string(),
            prompt: "prompt-a".to_string(),
        };
        let req2 = EmbeddingRequest {
            model: "model-a".to_string(),
            prompt: "prompt-a".to_string(),
        };
        let req3 = EmbeddingRequest {
            model: "model-b".to_string(),
            prompt: "prompt-a".to_string(),
        };

        assert_eq!(req1, req2);
        assert_ne!(req1, req3);
    }

    #[test]
    fn embedding_response_deserializes_correctly() {
        let json = r#"{"embedding": [0.1, 0.2, 0.3, 0.4, 0.5]}"#;
        let resp: EmbeddingResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.embedding.len(), 5);
        assert!((resp.embedding[0] - 0.1).abs() < f32::EPSILON);
        assert!((resp.embedding[4] - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn embedding_response_empty_embedding() {
        let json = r#"{"embedding": []}"#;
        let resp: EmbeddingResponse = serde_json::from_str(json).unwrap();

        assert!(resp.embedding.is_empty());
    }

    #[test]
    fn embedding_response_debug_trait() {
        let resp = EmbeddingResponse {
            embedding: vec![0.1, 0.2, 0.3],
        };

        let debug_str = format!("{:?}", resp);
        assert!(debug_str.contains("EmbeddingResponse"));
        assert!(debug_str.contains("embedding"));
    }

    #[test]
    fn embedding_response_equality() {
        let resp1 = EmbeddingResponse {
            embedding: vec![0.1, 0.2, 0.3],
        };
        let resp2 = EmbeddingResponse {
            embedding: vec![0.1, 0.2, 0.3],
        };
        let resp3 = EmbeddingResponse {
            embedding: vec![0.4, 0.5, 0.6],
        };

        assert_eq!(resp1, resp2);
        assert_ne!(resp1, resp3);
    }

    // =============================================================================
    // GENERATE REQUEST/RESPONSE STRUCTURE TESTS
    // =============================================================================

    #[test]
    fn generate_request_serializes_correctly() {
        let req = GenerateRequest {
            model: "gpt-oss:20b".to_string(),
            prompt: "Tell me a story".to_string(),
            stream: Some(false),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"model\":\"gpt-oss:20b\""));
        assert!(json.contains("\"prompt\":\"Tell me a story\""));
        assert!(json.contains("\"stream\":false"));
    }

    #[test]
    fn generate_request_stream_none_omitted() {
        let req = GenerateRequest {
            model: "test-model".to_string(),
            prompt: "test".to_string(),
            stream: None,
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(!json.contains("stream"));
    }

    #[test]
    fn generate_request_stream_true() {
        let req = GenerateRequest {
            model: "test-model".to_string(),
            prompt: "test".to_string(),
            stream: Some(true),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"stream\":true"));
    }

    #[test]
    fn generate_request_debug_trait() {
        let req = GenerateRequest {
            model: "model".to_string(),
            prompt: "prompt".to_string(),
            stream: Some(false),
        };

        let debug_str = format!("{:?}", req);
        assert!(debug_str.contains("GenerateRequest"));
    }

    #[test]
    fn generate_request_equality() {
        let req1 = GenerateRequest {
            model: "m".to_string(),
            prompt: "p".to_string(),
            stream: Some(false),
        };
        let req2 = GenerateRequest {
            model: "m".to_string(),
            prompt: "p".to_string(),
            stream: Some(false),
        };
        let req3 = GenerateRequest {
            model: "m".to_string(),
            prompt: "p".to_string(),
            stream: Some(true),
        };

        assert_eq!(req1, req2);
        assert_ne!(req1, req3);
    }

    #[test]
    fn generate_response_deserializes_correctly() {
        let json = r#"{"response": "Once upon a time..."}"#;
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.response, "Once upon a time...");
    }

    #[test]
    fn generate_response_empty_string() {
        let json = r#"{"response": ""}"#;
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert!(resp.response.is_empty());
    }

    #[test]
    fn generate_response_unicode() {
        let json = r#"{"response": "こんにちは世界 🌍"}"#;
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.response, "こんにちは世界 🌍");
    }

    #[test]
    fn generate_response_debug_trait() {
        let resp = GenerateResponse {
            response: "test response".to_string(),
        };

        let debug_str = format!("{:?}", resp);
        assert!(debug_str.contains("GenerateResponse"));
        assert!(debug_str.contains("test response"));
    }

    #[test]
    fn generate_response_equality() {
        let resp1 = GenerateResponse {
            response: "hello".to_string(),
        };
        let resp2 = GenerateResponse {
            response: "hello".to_string(),
        };
        let resp3 = GenerateResponse {
            response: "world".to_string(),
        };

        assert_eq!(resp1, resp2);
        assert_ne!(resp1, resp3);
    }

    // =============================================================================
    // EMBEDDING REQUEST EDGE CASES
    // =============================================================================

    #[test]
    fn embedding_request_with_special_characters() {
        let req = EmbeddingRequest {
            model: "model/with:special-chars".to_string(),
            prompt: "Text with \"quotes\" and \\ backslash".to_string(),
        };

        let json = serde_json::to_string(&req).unwrap();
        let parsed: EmbeddingRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req, parsed);
    }

    #[test]
    fn embedding_request_with_unicode() {
        let req = EmbeddingRequest {
            model: "model".to_string(),
            prompt: "日本語テスト 🚀 émojis".to_string(),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("日本語"));
    }

    #[test]
    fn embedding_request_with_long_prompt() {
        let long_prompt = "a".repeat(10000);
        let req = EmbeddingRequest {
            model: "model".to_string(),
            prompt: long_prompt.clone(),
        };

        let json = serde_json::to_string(&req).unwrap();
        let parsed: EmbeddingRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.prompt.len(), 10000);
    }

    // =============================================================================
    // EMBEDDING RESPONSE EDGE CASES
    // =============================================================================

    #[test]
    fn embedding_response_large_vector() {
        let embedding: Vec<f32> = (0..768).map(|i| i as f32 / 768.0).collect();
        let resp = EmbeddingResponse {
            embedding: embedding.clone(),
        };

        assert_eq!(resp.embedding.len(), 768);
        assert!((resp.embedding[0] - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn embedding_response_negative_values() {
        let json = r#"{"embedding": [-0.5, 0.0, 0.5]}"#;
        let resp: EmbeddingResponse = serde_json::from_str(json).unwrap();

        assert!((resp.embedding[0] - (-0.5)).abs() < f32::EPSILON);
        assert!((resp.embedding[1] - 0.0).abs() < f32::EPSILON);
        assert!((resp.embedding[2] - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn embedding_response_scientific_notation() {
        let json = r#"{"embedding": [1.5e-10, 2.0e5, -3.14159]}"#;
        let resp: EmbeddingResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.embedding.len(), 3);
        assert!(resp.embedding[0] < 0.001);
        assert!(resp.embedding[1] > 100000.0);
    }

    // =============================================================================
    // GENERATE REQUEST EDGE CASES
    // =============================================================================

    #[test]
    fn generate_request_multiline_prompt() {
        let req = GenerateRequest {
            model: "model".to_string(),
            prompt: "Line 1\nLine 2\nLine 3".to_string(),
            stream: Some(false),
        };

        let json = serde_json::to_string(&req).unwrap();
        let parsed: GenerateRequest = serde_json::from_str(&json).unwrap();
        assert!(parsed.prompt.contains('\n'));
    }

    #[test]
    fn generate_request_with_tabs_and_whitespace() {
        let req = GenerateRequest {
            model: "model".to_string(),
            prompt: "  \t  indented\t\t  ".to_string(),
            stream: None,
        };

        let json = serde_json::to_string(&req).unwrap();
        let parsed: GenerateRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req.prompt, parsed.prompt);
    }

    // =============================================================================
    // GENERATE RESPONSE EDGE CASES
    // =============================================================================

    #[test]
    fn generate_response_with_newlines() {
        let json = r#"{"response": "Line 1\nLine 2\nLine 3"}"#;
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert!(resp.response.contains('\n'));
        assert_eq!(resp.response.lines().count(), 3);
    }

    #[test]
    fn generate_response_with_json_content() {
        let json = r#"{"response": "{\"key\": \"value\"}"}"#;
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert!(resp.response.contains("key"));
        assert!(resp.response.contains("value"));
    }

    #[test]
    fn generate_response_with_markdown() {
        // Use escaped newlines within a regular string for proper JSON
        let json = "{\"response\": \"# Heading\\n\\n- bullet\\n- list\\n\\n`code`\"}";
        let resp: GenerateResponse = serde_json::from_str(json).unwrap();

        assert!(resp.response.contains("# Heading"));
        assert!(resp.response.contains("`code`"));
    }

    // =============================================================================
    // ROUND-TRIP SERIALIZATION TESTS
    // =============================================================================

    #[test]
    fn embedding_request_roundtrip() {
        let original = EmbeddingRequest {
            model: "test-model".to_string(),
            prompt: "test prompt with special chars: \"'\\".to_string(),
        };

        let json = serde_json::to_string(&original).unwrap();
        let parsed: EmbeddingRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(original, parsed);
    }

    #[test]
    fn generate_request_roundtrip_with_stream() {
        let original = GenerateRequest {
            model: "model".to_string(),
            prompt: "prompt".to_string(),
            stream: Some(false),
        };

        let json = serde_json::to_string(&original).unwrap();
        let parsed: GenerateRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(original, parsed);
    }

    #[test]
    fn generate_request_roundtrip_without_stream() {
        let original = GenerateRequest {
            model: "model".to_string(),
            prompt: "prompt".to_string(),
            stream: None,
        };

        let json = serde_json::to_string(&original).unwrap();
        // When stream is None, it's not serialized
        assert!(!json.contains("stream"));

        // But we can still deserialize (stream will be missing)
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(!parsed.as_object().unwrap().contains_key("stream"));
    }
}
