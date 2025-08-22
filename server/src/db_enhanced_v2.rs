use crate::db::AppState;
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;

/// Generate AI-enhanced version of a note with separate calls for each component
pub async fn generate_ai_revision_with_metadata(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
    tracing::info!(%note_id, "Starting AI enhancement process");
    
    // Step 1: Generate enhanced content (focused on content improvement only)
    let enhanced_content = generate_enhanced_content(state, content).await?;
    
    // Step 2: Extract metadata from the content (separate AI call)
    let metadata = extract_metadata(state, content, &enhanced_content).await?;
    
    // Step 3: Generate tags based on existing tags in the system
    let tags = generate_tags(state, &enhanced_content).await?;
    
    // Step 4: Store everything in the database
    store_enhanced_note(state, note_id, &enhanced_content, &metadata, &tags).await?;
    
    // Step 5: Create contextual links (async, non-blocking)
    let state_clone = state.clone();
    let metadata_clone = metadata.clone();
    tokio::spawn(async move {
        if let Err(err) = create_contextual_links(&state_clone, note_id, &metadata_clone).await {
            tracing::warn!(%note_id, error = %err, "Failed to create contextual links");
        }
    });
    
    // Step 6: Generate embeddings (async, non-blocking)
    let state_clone = state.clone();
    let content_clone = enhanced_content.clone();
    tokio::spawn(async move {
        if let Err(err) = embed_note_content(&state_clone, note_id, &content_clone).await {
            tracing::warn!(%note_id, error = %err, "Failed to generate embeddings");
        }
    });
    
    tracing::info!(%note_id, "AI enhancement completed successfully");
    Ok(())
}

/// Generate enhanced content - focused solely on improving the note's content
async fn generate_enhanced_content(state: &AppState, content: &str) -> anyhow::Result<String> {
    let prompt = format!(
        r#"You are an intelligent note-taking assistant. Your task is to enhance the following note.

Original Note:
{}

Please provide an enhanced version that:
1. Preserves ALL original information and meaning
2. Improves clarity and organization
3. Adds proper markdown formatting (headers, lists, emphasis)
4. Identifies and highlights key concepts
5. Formats any code blocks, math expressions, or diagrams properly
6. Maintains a professional yet accessible tone

Output the enhanced note in clean markdown format. Do not add any labels, markers, or metadata."#,
        content
    );
    
    let enhanced = crate::ollama::generate(&state.gen_model, &prompt).await?;
    
    // Clean up any accidental markers
    Ok(clean_enhanced_content(&enhanced))
}

/// Extract metadata from the content
async fn extract_metadata(state: &AppState, original: &str, enhanced: &str) -> anyhow::Result<serde_json::Value> {
    let prompt = format!(
        r#"Analyze the following note and extract structured metadata.

Note Content:
{}

Enhanced Version:
{}

Please provide metadata in the following JSON format:
{{
  "categories": ["primary category", "secondary category"],
  "topics": ["main topic", "subtopic 1", "subtopic 2"],
  "entities": {{
    "people": ["person names mentioned"],
    "organizations": ["organizations mentioned"],
    "technologies": ["technologies, tools, frameworks mentioned"],
    "locations": ["locations mentioned"]
  }},
  "keywords": ["important keyword 1", "important keyword 2"],
  "summary": "One sentence summary of the note",
  "context": "Brief description of what this note relates to"
}}

Output only the JSON, no other text."#,
        original, enhanced
    );
    
    let response = crate::ollama::generate(&state.gen_model, &prompt).await?;
    
    // Extract JSON from response
    let json_str = extract_json(&response);
    match serde_json::from_str(&json_str) {
        Ok(metadata) => Ok(metadata),
        Err(e) => {
            tracing::warn!("Failed to parse metadata JSON: {}", e);
            Ok(json!({
                "categories": [],
                "topics": [],
                "entities": {},
                "keywords": [],
                "summary": "",
                "context": ""
            }))
        }
    }
}

/// Generate appropriate tags for the note
async fn generate_tags(state: &AppState, content: &str) -> anyhow::Result<Vec<String>> {
    // Get existing tags for context
    let existing_tags = sqlx::query!("SELECT name FROM tag")
        .fetch_all(&state.pool).await?
        .into_iter()
        .map(|r| r.name)
        .collect::<Vec<_>>();
    
    let tags_context = if existing_tags.is_empty() {
        "No existing tags in the system yet.".to_string()
    } else {
        format!("Existing tags in the system: {}", existing_tags.join(", "))
    };
    
    let prompt = format!(
        r#"Analyze the following note and suggest appropriate tags.

Note Content:
{}

{}

Please suggest 3-7 relevant tags for this note. Use existing tags when appropriate, but create new ones if needed.
Tags should be lowercase, hyphenated (e.g., "machine-learning", "project-management").

Output the tags as a comma-separated list, nothing else."#,
        content, tags_context
    );
    
    let response = crate::ollama::generate(&state.gen_model, &prompt).await?;
    
    // Parse tags from response
    Ok(response
        .split(',')
        .map(|s| s.trim().to_lowercase().replace(' ', "-"))
        .filter(|s| !s.is_empty())
        .collect())
}

/// Store the enhanced note and metadata in the database
async fn store_enhanced_note(
    state: &AppState,
    note_id: Uuid,
    enhanced_content: &str,
    metadata: &serde_json::Value,
    tags: &[String]
) -> anyhow::Result<()> {
    let revision_id = Uuid::new_v4();
    let now = Utc::now();
    
    let mut tx = state.pool.begin().await?;
    
    // Insert revision record
    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, created_at_utc, rationale, content, type) 
         VALUES ($1, $2, $3, $4, $5, $6)",
        revision_id, note_id, now, "AI-enhanced revision", enhanced_content, "ai_enhancement"
    ).execute(&mut *tx).await?;
    
    // Update current revised content with metadata
    sqlx::query!(
        "UPDATE note_revised_current 
         SET content = $1, last_revision_id = $2, ai_metadata = $3 
         WHERE note_id = $4",
        enhanced_content, revision_id, metadata, note_id
    ).execute(&mut *tx).await?;
    
    // Process tags
    for tag_name in tags {
        // Insert tag if it doesn't exist
        sqlx::query!(
            "INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            tag_name
        ).execute(&mut *tx).await?;
        
        // Link tag to note
        sqlx::query!(
            "INSERT INTO note_tag (note_id, tag_name, source) 
             VALUES ($1, $2, 'ai') 
             ON CONFLICT (note_id, tag_name) DO NOTHING",
            note_id, tag_name
        ).execute(&mut *tx).await?;
    }
    
    // Update note's updated_at timestamp
    sqlx::query!(
        "UPDATE note SET updated_at_utc = $1 WHERE id = $2",
        now, note_id
    ).execute(&mut *tx).await?;
    
    tx.commit().await?;
    Ok(())
}

/// Create contextual links to related notes
async fn create_contextual_links(
    state: &AppState,
    note_id: Uuid,
    metadata: &serde_json::Value
) -> anyhow::Result<()> {
    // Extract potential link terms from metadata
    let mut search_terms = Vec::new();
    
    if let Some(keywords) = metadata.get("keywords").and_then(|v| v.as_array()) {
        for keyword in keywords {
            if let Some(term) = keyword.as_str() {
                search_terms.push(term.to_string());
            }
        }
    }
    
    if let Some(topics) = metadata.get("topics").and_then(|v| v.as_array()) {
        for topic in topics.iter().take(2) {
            if let Some(term) = topic.as_str() {
                search_terms.push(term.to_string());
            }
        }
    }
    
    // Search for related notes using each term
    for term in search_terms.iter().take(5) {
        let results = crate::db::search_fts(state, term, 3).await?;
        
        for hit in results {
            if hit.note_id != note_id && hit.score > 0.5 {
                let link_id = Uuid::new_v4();
                sqlx::query!(
                    "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc)
                     VALUES ($1, $2, $3, NULL, 'contextual', $4, $5)
                     ON CONFLICT DO NOTHING",
                    link_id, note_id, hit.note_id, hit.score, Utc::now()
                ).execute(&state.pool).await?;
            }
        }
    }
    
    Ok(())
}

/// Generate embeddings for the note content
async fn embed_note_content(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
    // Delete previous embeddings
    sqlx::query!("DELETE FROM embedding WHERE note_id = $1", note_id)
        .execute(&state.pool).await?;
    
    // Chunk the content
    let chunks = chunk_text(content, 1000);
    if chunks.is_empty() {
        return Ok(());
    }
    
    // Generate embeddings
    let embeddings = crate::ollama::embed_texts(chunks.clone(), &state.embed_model).await?;
    
    // Store embeddings
    for (idx, (chunk, embedding)) in chunks.iter().zip(embeddings.iter()).enumerate() {
        let embed_id = Uuid::new_v4();
        let vector = pgvector::Vector::from(embedding.clone());
        
        sqlx::query!(
            "INSERT INTO embedding (id, note_id, chunk_index, text, vector, model) 
             VALUES ($1, $2, $3, $4, $5::vector, $6)",
            embed_id, note_id, idx as i32, chunk, &vector.to_vec() as &Vec<f32>, state.embed_model
        ).execute(&state.pool).await?;
    }
    
    Ok(())
}

/// Clean up enhanced content to remove any accidental markers
fn clean_enhanced_content(content: &str) -> String {
    let mut cleaned = content.to_string();
    
    // Remove common markers that might slip through
    let markers = [
        "PART 1", "PART 2", "ENHANCED NOTE", "METADATA",
        "---", "```json", "```markdown", "```"
    ];
    
    for marker in &markers {
        if cleaned.starts_with(marker) {
            cleaned = cleaned
                .splitn(2, '\n')
                .nth(1)
                .unwrap_or(&cleaned)
                .to_string();
        }
    }
    
    cleaned.trim().to_string()
}

/// Extract JSON from a response that might contain other text
fn extract_json(response: &str) -> String {
    // Try to find JSON block
    if let Some(start) = response.find('{') {
        if let Some(end) = response.rfind('}') {
            return response[start..=end].to_string();
        }
    }
    
    // Try to extract from code block
    if response.contains("```json") {
        let parts: Vec<&str> = response.split("```json").collect();
        if parts.len() > 1 {
            if let Some(json_part) = parts[1].split("```").next() {
                return json_part.trim().to_string();
            }
        }
    }
    
    response.trim().to_string()
}

/// Chunk text into smaller pieces for embedding
fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
    if text.is_empty() {
        return vec![];
    }
    
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();
    
    for line in text.lines() {
        if current_chunk.len() + line.len() > max_len && !current_chunk.is_empty() {
            chunks.push(current_chunk.clone());
            current_chunk.clear();
        }
        current_chunk.push_str(line);
        current_chunk.push('\n');
    }
    
    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }
    
    chunks
}