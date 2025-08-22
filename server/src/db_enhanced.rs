use crate::db::AppState;
use uuid::Uuid;
use chrono::Utc;
use serde_json;

// Enhanced AI revision with metadata generation and contextual linking
pub async fn generate_ai_revision_with_metadata(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
    // Get existing tags and categories from the database
    let existing_tags = sqlx::query!("SELECT DISTINCT tag_name FROM note_tag")
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(|r| r.tag_name)
        .collect::<Vec<_>>();
    
    let tags_list = if existing_tags.is_empty() {
        "No existing tags yet".to_string()
    } else {
        existing_tags.join(", ")
    };
    
    // Create enhanced prompt for AI
    let prompt = format!(
        r#"You are an intelligent note-taking assistant. Analyze and enhance the following note.

Original Note:
{}

Existing tags in the system: {}

Instructions:
1. First, provide the enhanced note content directly in clean markdown format (no labels or markers)
2. Then add three dashes on a new line: ---
3. Finally, provide the metadata in JSON format

Enhanced note requirements:
- Preserve ALL original information
- Improve clarity and organization
- Add proper markdown formatting
- Identify key concepts
- Add relevant context
- Maintain professional tone

IMPORTANT: Do NOT include "PART 1", "PART 2", "ENHANCED NOTE", or any other labels. Start directly with the enhanced content.

After the three dashes, provide metadata in this JSON format:
```json
{{
  "categories": ["category1", "category2"],
  "tags": ["tag1", "tag2", "tag3"],
  "topics": ["main topic", "subtopic"],
  "entities": {{
    "people": ["person1", "person2"],
    "organizations": ["org1", "org2"],
    "technologies": ["tech1", "tech2"],
    "locations": ["place1", "place2"]
  }},
  "keywords": ["keyword1", "keyword2"],
  "summary": "One sentence summary",
  "context": "Brief context about what this note relates to",
  "potential_links": ["search term 1", "search term 2"]
}}
```

Use existing tags when appropriate, but create new ones if needed."#,
        content, tags_list
    );
    
    // Generate AI response
    let ai_response = crate::ollama::generate(&state.gen_model, &prompt).await?;
    
    // Parse response to separate content and metadata
    let (revised_content, metadata_json) = parse_ai_response(&ai_response);
    
    // Store the revision with metadata
    let revision_id = Uuid::new_v4();
    let now = Utc::now();
    
    let mut tx = state.pool.begin().await?;
    
    // Insert revision record
    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, created_at_utc, rationale, content, type) 
         VALUES ($1, $2, $3, $4, $5, $6)",
        revision_id, note_id, now, "AI-enhanced revision with metadata", revised_content, "ai_enhancement"
    ).execute(&mut *tx).await?;
    
    // Update current revised content with metadata
    sqlx::query!(
        "UPDATE note_revised_current 
         SET content = $1, last_revision_id = $2, ai_metadata = $3 
         WHERE note_id = $4",
        revised_content, revision_id, metadata_json, note_id
    ).execute(&mut *tx).await?;
    
    // Process tags from metadata
    if let Some(tags) = metadata_json.get("tags").and_then(|v| v.as_array()) {
        for tag_value in tags {
            if let Some(tag_name) = tag_value.as_str() {
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
        }
    }
    
    // Store user metadata from AI analysis
    if !metadata_json.is_null() {
        sqlx::query!(
            "UPDATE note SET metadata = metadata || $1, updated_at_utc = $2 WHERE id = $3",
            metadata_json, now, note_id
        ).execute(&mut *tx).await?;
    }
    
    tx.commit().await?;
    
    // Generate embeddings for the revised content
    tokio::spawn({
        let state = state.clone();
        let revised_content = revised_content.clone();
        async move {
            if let Err(err) = embed_note_content(&state, note_id, &revised_content).await {
                tracing::warn!(%note_id, error = %err, "Failed to embed revised content");
            }
        }
    });
    
    // Find and link related notes based on metadata
    tokio::spawn({
        let state = state.clone();
        let metadata = metadata_json.clone();
        async move {
            if let Err(err) = create_contextual_links(&state, note_id, &revised_content, &metadata).await {
                tracing::warn!(%note_id, error = %err, "Failed to create contextual links");
            }
        }
    });
    
    tracing::info!(%note_id, "AI revision with metadata generated successfully");
    Ok(())
}

// Parse AI response to separate content and metadata
fn parse_ai_response(response: &str) -> (String, serde_json::Value) {
    // Look for the separator or JSON block
    let separator_markers = ["---\n", "---", "```json", "PART 2", "**PART 2"];
    let mut content_end = response.len();
    
    for marker in &separator_markers {
        if let Some(pos) = response.find(marker) {
            content_end = content_end.min(pos);
        }
    }
    
    let content_part = response[..content_end].trim();
    
    // Aggressively clean up the content - remove ALL possible markers and labels
    let mut enhanced_content = content_part.to_string();
    
    // Remove various forms of PART markers
    let markers_to_remove = [
        "PART 1 – ENHANCED NOTE",
        "PART 1 - ENHANCED NOTE",
        "**PART 1**",
        "PART 1:",
        "PART 1",
        "ENHANCED NOTE:",
        "ENHANCED NOTE",
        "**ENHANCED NOTE**",
        "---METADATA---",
        "METADATA:",
        "```markdown",
        "```",
    ];
    
    for marker in &markers_to_remove {
        if let Some(pos) = enhanced_content.find(marker) {
            // If marker is at the start, remove it and everything before the next line
            if pos == 0 {
                enhanced_content = enhanced_content
                    .splitn(2, '\n')
                    .nth(1)
                    .unwrap_or(&enhanced_content)
                    .to_string();
            } else {
                enhanced_content = enhanced_content.replace(marker, "");
            }
        }
    }
    
    // Clean up any remaining formatting artifacts
    enhanced_content = enhanced_content
        .trim()
        .trim_start_matches("–")
        .trim_start_matches("-")
        .trim_start_matches(":")
        .trim_start_matches("**")
        .trim_end_matches("**")
        .trim()
        .to_string();
    
    // Extract JSON metadata if present
    if let Some(json_start) = response.find("```json") {
        let json_part = response[json_start..]
            .strip_prefix("```json")
            .and_then(|s| s.find("```").map(|end| &s[..end]))
            .unwrap_or("")
            .trim();
        
        let metadata: serde_json::Value = serde_json::from_str(json_part).unwrap_or_else(|e| {
            tracing::warn!("Failed to parse AI metadata: {}", e);
            serde_json::json!({
                "categories": [],
                "topics": [],
                "tags": []
            })
        });
        
        (enhanced_content, metadata)
    } else {
        // No metadata found
        (enhanced_content, serde_json::json!({
            "categories": [],
            "topics": [],
            "tags": []
        }))
    }
}

// Embed note content
async fn embed_note_content(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
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
             VALUES ($1, $2, $3, $4, $5::vector, $6)
             ON CONFLICT (note_id, chunk_index) 
             DO UPDATE SET text = $4, vector = $5::vector",
            embed_id, note_id, idx as i32, chunk, &vector.to_vec() as &Vec<f32>, state.embed_model
        ).execute(&state.pool).await?;
    }
    
    Ok(())
}

// Create contextual links between notes
async fn create_contextual_links(
    state: &AppState, 
    note_id: Uuid, 
    content: &str, 
    metadata: &serde_json::Value
) -> anyhow::Result<()> {
    // Get potential link terms from metadata
    let mut search_terms = Vec::new();
    
    // Add keywords
    if let Some(keywords) = metadata.get("keywords").and_then(|v| v.as_array()) {
        for keyword in keywords {
            if let Some(term) = keyword.as_str() {
                search_terms.push(term.to_string());
            }
        }
    }
    
    // Add potential links
    if let Some(links) = metadata.get("potential_links").and_then(|v| v.as_array()) {
        for link in links {
            if let Some(term) = link.as_str() {
                search_terms.push(term.to_string());
            }
        }
    }
    
    // Add entities
    if let Some(entities) = metadata.get("entities").and_then(|v| v.as_object()) {
        for (_, entity_list) in entities {
            if let Some(list) = entity_list.as_array() {
                for entity in list {
                    if let Some(term) = entity.as_str() {
                        search_terms.push(term.to_string());
                    }
                }
            }
        }
    }
    
    // Find related notes using semantic search
    let content_sample = content.chars().take(500).collect::<String>();
    let embeddings = crate::ollama::embed_texts(vec![content_sample], &state.embed_model).await?;
    
    if let Some(embedding) = embeddings.first() {
        let vector = pgvector::Vector::from(embedding.clone());
        
        // Find similar notes (excluding archived)
        let similar_notes = sqlx::query!(
            "SELECT DISTINCT e.note_id, 1.0 - (e.vector <=> $1::vector) as similarity
             FROM embedding e
             JOIN note n ON n.id = e.note_id
             WHERE e.note_id != $2 
               AND (n.archived IS FALSE OR n.archived IS NULL)
             ORDER BY similarity DESC
             LIMIT 10",
            &vector.to_vec() as &Vec<f32>, note_id
        ).fetch_all(&state.pool).await?;
        
        // Create links for highly related notes (similarity > 0.7)
        for similar in similar_notes {
            if similar.similarity.unwrap_or(0.0) > 0.7 {
                let link_id = Uuid::new_v4();
                sqlx::query!(
                    "INSERT INTO link (id, from_note_id, to_note_id, kind, score, created_at_utc)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT DO NOTHING",
                    link_id, note_id, similar.note_id, "semantic", similar.similarity.unwrap_or(0.0) as f32, Utc::now()
                ).execute(&state.pool).await?;
            }
        }
    }
    
    // Search for notes containing the search terms (excluding archived)
    for term in search_terms.iter().take(5) {  // Limit to avoid too many links
        let results = sqlx::query!(
            "SELECT DISTINCT n.id 
             FROM note n
             JOIN note_revised_current nrc ON nrc.note_id = n.id
             WHERE n.id != $1 
             AND nrc.tsv @@ plainto_tsquery('english', $2)
             AND (n.archived IS FALSE OR n.archived IS NULL)
             LIMIT 5",
            note_id, term
        ).fetch_all(&state.pool).await?;
        
        for result in results {
            let link_id = Uuid::new_v4();
            sqlx::query!(
                "INSERT INTO link (id, from_note_id, to_note_id, kind, score, created_at_utc)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT DO NOTHING",
                link_id, note_id, result.id, "keyword", 0.5_f32, Utc::now()
            ).execute(&state.pool).await?;
        }
    }
    
    Ok(())
}

fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
    if text.is_empty() { 
        return vec![]; 
    }
    
    let mut chunks = Vec::new();
    let mut current = String::new();
    
    for line in text.lines() {
        if current.len() + line.len() > max_len && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current = String::new();
        }
        current.push_str(line);
        current.push('\n');
    }
    
    if !current.is_empty() {
        chunks.push(current.trim().to_string());
    }
    
    chunks
}