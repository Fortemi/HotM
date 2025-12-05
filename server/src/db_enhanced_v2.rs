use crate::db::AppState;
// Job queue imports removed as they are not used in this file
use chrono::Utc;
use pgvector;
use serde_json::json;
use uuid::Uuid;

/// Generate AI-enhanced version of a note with separate calls for each component
pub async fn generate_ai_revision_with_metadata(
    state: &AppState,
    note_id: Uuid,
    content: &str,
) -> anyhow::Result<()> {
    tracing::info!(%note_id, "Starting AI enhancement process");

    // Step 1: Parse explicit tags and topics from original content
    let (parsed_tags, parsed_topics) = parse_explicit_tags_and_topics(content);
    tracing::info!(
        "Parsed from original content - tags: {:?}, topics: {:?}",
        parsed_tags,
        parsed_topics
    );

    // Step 2: Get related notes for contextual enhancement
    let related_notes = get_related_notes_for_enhancement(state, note_id, content).await?;
    
    // Step 3: Generate enhanced content with related notes context
    let enhanced_content = generate_enhanced_content_with_context(state, content, &related_notes).await?;

    // Step 4: Extract metadata from the content (separate AI call)
    let mut metadata = extract_metadata(state, content, &enhanced_content).await?;

    // Step 5: Generate tags based on existing tags in the system, including parsed ones
    let mut ai_tags = generate_tags(state, &enhanced_content).await?;

    // Step 6: Merge parsed tags and topics with AI-generated ones
    ai_tags.extend(parsed_tags);
    if let Some(topics_array) = metadata.get_mut("topics").and_then(|v| v.as_array_mut()) {
        for topic in parsed_topics {
            topics_array.push(serde_json::Value::String(topic));
        }
    }

    // Step 7: Store everything in the database
    store_enhanced_note(state, note_id, &enhanced_content, &metadata, &ai_tags).await?;

    // AI revision job is complete - embedding and linking will be handled by separate jobs

    tracing::info!(%note_id, "AI enhancement completed successfully");
    Ok(())
}

/// Get related notes with >50% similarity for contextual enhancement
async fn get_related_notes_for_enhancement(
    state: &AppState,
    note_id: Uuid,
    content: &str,
) -> anyhow::Result<Vec<crate::models::SearchHit>> {
    // Generate embedding for the current note to find related notes
    let embeddings = crate::ollama::embed_texts(vec![content.to_string()], &state.embed_model).await?;
    let query_vec = embeddings
        .into_iter()
        .next()
        .unwrap_or_else(|| vec![0.0_f32; 768]);

    // Find related notes with >50% similarity
    let related_notes = crate::db::search_vector_filtered(state, query_vec, None, 10).await?;
    let high_quality_related: Vec<_> = related_notes
        .into_iter()
        .filter(|hit| hit.score > 0.5 && hit.note_id != note_id)
        .take(5)
        .collect();

    Ok(high_quality_related)
}

/// Generate enhanced content with context from related notes for more holistic enhancement
async fn generate_enhanced_content_with_context(
    state: &AppState,
    content: &str,
    related_notes: &[crate::models::SearchHit],
) -> anyhow::Result<String> {
    // Build context from related notes
    let mut related_context = String::new();
    if !related_notes.is_empty() {
        related_context.push_str("Related concepts from the knowledge base:\n");
        for hit in related_notes.iter().take(3) {
            if let Some(snippet) = &hit.snippet {
                related_context.push_str(&format!("- {}\n", snippet.chars().take(150).collect::<String>()));
            }
        }
        related_context.push_str("\n");
    }

    let prompt = format!(
        r#"You are an intelligent note-taking assistant. Your task is to enhance the following note by leveraging related concepts from the knowledge base to create a more holistic and contextual revision.

Original Note:
{}

{}Please provide an enhanced version that:
1. Preserves ALL original information and meaning
2. Improves clarity and organization with proper markdown formatting
3. Identifies and highlights key concepts
4. Makes connections to related concepts where relevant (without overwhelming the original content)
5. Adds contextual insights that help place this note within the broader knowledge landscape
6. Maintains a professional yet accessible tone
7. Formats any code blocks, math expressions, or diagrams properly

Guidelines:
- Only reference related concepts when they genuinely enhance understanding
- Do not force connections that don't make sense
- Keep the focus on the original note's content
- Add value through context, not just length

Output the enhanced note in clean markdown format. Do not add any labels, markers, or metadata."#,
        content,
        related_context
    );

    let enhanced = crate::ollama::generate(&state.gen_model, &prompt).await?;

    // Clean up any accidental markers
    Ok(clean_enhanced_content(&enhanced))
}

/// Extract metadata from the content
async fn extract_metadata(
    state: &AppState,
    original: &str,
    enhanced: &str,
) -> anyhow::Result<serde_json::Value> {
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
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(|r| r.name)
        .collect::<Vec<_>>();

    let tags_context = if existing_tags.is_empty() {
        "No existing tags in the system yet.".to_string()
    } else {
        format!("Existing tags in the system: {}", existing_tags.join(", "))
    };

    let prompt = format!(
        r#"You are a precise tagging system. Read the note content and generate relevant tags.

[NOTE CONTENT]
{}

[CONTEXT]
{}

Generate 3-7 relevant tags for this specific note content. Tags should be:
- Lowercase with hyphens (e.g. "machine-learning")
- Specific to the note content (not generic terms)
- Based on actual topics, technologies, or concepts mentioned
- Reuse existing tags when appropriate

Respond with ONLY a comma-separated list of tags, no other text or explanation:
"#,
        content, tags_context
    );

    let response = crate::ollama::generate(&state.gen_model, &prompt).await?;

    // Parse tags from response - be more strict about filtering
    let tags: Vec<String> = response
        .split(',')
        .map(|s| s.trim().to_lowercase().replace(' ', "-"))
        .filter(|s| !s.is_empty() && s.len() > 2 && s.len() < 50)
        .filter(|s| !s.contains("knowledge") && !s.contains("engine") && !s.contains("system"))
        .take(7) // Limit to max 7 tags
        .collect();

    tracing::info!("Generated {} tags: {:?}", tags.len(), tags);
    Ok(tags)
}

/// Store the enhanced note and metadata in the database
async fn store_enhanced_note(
    state: &AppState,
    note_id: Uuid,
    enhanced_content: &str,
    metadata: &serde_json::Value,
    tags: &[String],
) -> anyhow::Result<()> {
    let revision_id = Uuid::new_v4();
    let now = Utc::now();

    let mut tx = state.pool.begin().await?;

    // Get the next revision number
    let revision_number: i32 = sqlx::query_scalar!(
        "SELECT COALESCE(MAX(revision_number), 0) + 1 FROM note_revision WHERE note_id = $1",
        note_id
    )
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(1);

    // Insert revision record
    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, revision_number, created_at_utc, rationale, content, type, model) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        revision_id, note_id, revision_number, now, "AI-enhanced revision", enhanced_content, "ai_enhancement", state.gen_model
    ).execute(&mut *tx).await?;

    // Update current revised content with metadata
    sqlx::query!(
        "UPDATE note_revised_current 
         SET content = $1, last_revision_id = $2, ai_metadata = $3 
         WHERE note_id = $4",
        enhanced_content,
        revision_id,
        metadata,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    // Process tags
    for tag_name in tags {
        // Insert tag if it doesn't exist
        sqlx::query!(
            "INSERT INTO tag (name, created_at_utc) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
            tag_name,
            Utc::now()
        )
        .execute(&mut *tx)
        .await?;

        // Link tag to note
        sqlx::query!(
            "INSERT INTO note_tag (note_id, tag_name, source) 
             VALUES ($1, $2, 'ai') 
             ON CONFLICT (note_id, tag_name) DO NOTHING",
            note_id,
            tag_name
        )
        .execute(&mut *tx)
        .await?;
    }

    // Update note's updated_at timestamp
    sqlx::query!(
        "UPDATE note SET updated_at_utc = $1 WHERE id = $2",
        now,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Create contextual links to related notes (both semantic and keyword-based)
pub async fn create_contextual_links(
    state: &AppState,
    note_id: Uuid,
    content: &str,
    metadata: &serde_json::Value,
) -> anyhow::Result<()> {
    tracing::info!("Creating contextual links for note {}", note_id);

    // Part 1: Semantic linking using embeddings
    let content_sample = content.chars().take(500).collect::<String>();
    let embeddings = crate::ollama::embed_texts(vec![content_sample], &state.embed_model).await?;

    if let Some(embedding) = embeddings.first() {
        let vector = pgvector::Vector::from(embedding.clone());

        // Find similar notes
        let similar_notes = sqlx::query!(
            "SELECT DISTINCT e.note_id, 1.0 - (e.vector <=> $1::vector) as similarity
             FROM embedding e
             JOIN note n ON n.id = e.note_id
             WHERE e.note_id != $2 
             AND (n.archived IS FALSE OR n.archived IS NULL)
             ORDER BY similarity DESC
             LIMIT 10",
            &vector.to_vec() as &Vec<f32>,
            note_id
        )
        .fetch_all(&state.pool)
        .await?;

        tracing::info!("Found {} semantically similar notes", similar_notes.len());

        // Create reciprocal semantic links for highly similar notes
        for similar in similar_notes {
            if similar.similarity.unwrap_or(0.0) > 0.7 {
                // Forward link (new -> old)
                let link_id_forward = Uuid::new_v4();
                sqlx::query!(
                    "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc)
                     SELECT $1, $2, $3, NULL, 'semantic', $4, $5
                     WHERE NOT EXISTS (
                         SELECT 1 FROM link 
                         WHERE from_note_id = $2 AND to_note_id = $3 AND kind = 'semantic'
                     )",
                    link_id_forward, note_id, similar.note_id, similar.similarity.unwrap_or(0.0) as f32, Utc::now()
                ).execute(&state.pool).await?;

                // Backward link (old -> new)
                let link_id_backward = Uuid::new_v4();
                sqlx::query!(
                    "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc)
                     SELECT $1, $2, $3, NULL, 'semantic', $4, $5
                     WHERE NOT EXISTS (
                         SELECT 1 FROM link 
                         WHERE from_note_id = $2 AND to_note_id = $3 AND kind = 'semantic'
                     )",
                    link_id_backward, similar.note_id, note_id, similar.similarity.unwrap_or(0.0) as f32, Utc::now()
                ).execute(&state.pool).await?;

                tracing::info!(
                    "Created reciprocal semantic links between {} and {:?}",
                    note_id,
                    similar.note_id
                );
            }
        }
    }

    // Part 2: Keyword-based linking
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

    tracing::info!(
        "Searching for keyword links with {} terms",
        search_terms.len()
    );

    // Search for related notes using each term
    for term in search_terms.iter().take(5) {
        let results = sqlx::query!(
            "SELECT DISTINCT n.id 
             FROM note n
             JOIN note_revised_current nrc ON nrc.note_id = n.id
             WHERE n.id != $1 
             AND nrc.tsv @@ plainto_tsquery('english', $2)
             AND (n.archived IS FALSE OR n.archived IS NULL)
             LIMIT 5",
            note_id,
            term
        )
        .fetch_all(&state.pool)
        .await?;

        for result in results {
            // Create metadata with the keyword that created this link
            let link_metadata = serde_json::json!({
                "keywords": [term.clone()]
            });

            // Forward link (new -> old)
            let link_id_forward = Uuid::new_v4();
            sqlx::query!(
                "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc, metadata)
                 SELECT $1, $2, $3, NULL, 'keyword', 0.5, $4, $5
                 WHERE NOT EXISTS (
                     SELECT 1 FROM link 
                     WHERE from_note_id = $2 AND to_note_id = $3 AND kind = 'keyword'
                 )",
                link_id_forward, note_id, result.id, Utc::now(), link_metadata
            ).execute(&state.pool).await?;

            // Backward link (old -> new)
            let link_id_backward = Uuid::new_v4();
            sqlx::query!(
                "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc, metadata)
                 SELECT $1, $2, $3, NULL, 'keyword', 0.5, $4, $5
                 WHERE NOT EXISTS (
                     SELECT 1 FROM link 
                     WHERE from_note_id = $2 AND to_note_id = $3 AND kind = 'keyword'
                 )",
                link_id_backward, result.id, note_id, Utc::now(), link_metadata
            ).execute(&state.pool).await?;

            tracing::info!(
                "Created reciprocal keyword links between {} and {} for keyword: {}",
                note_id,
                result.id,
                term
            );
        }
    }

    tracing::info!("Finished creating contextual links for note {}", note_id);
    Ok(())
}

/// Update the AI-enhanced content with context from linked notes
pub async fn update_with_linked_context(state: &AppState, note_id: Uuid) -> anyhow::Result<()> {
    tracing::info!("Updating note {} with linked context", note_id);

    // Get the best semantic links
    let links = sqlx::query!(
        "SELECT l.to_note_id, l.score, nrc.content
         FROM link l
         JOIN note_revised_current nrc ON nrc.note_id = l.to_note_id
         WHERE l.from_note_id = $1 AND l.kind = 'semantic' AND l.score > 0.75
         ORDER BY l.score DESC
         LIMIT 3",
        note_id
    )
    .fetch_all(&state.pool)
    .await?;

    if links.is_empty() {
        tracing::info!("No high-quality links found for context update");
        return Ok(());
    }

    // Get current enhanced content
    let current = sqlx::query!(
        "SELECT content FROM note_revised_current WHERE note_id = $1",
        note_id
    )
    .fetch_one(&state.pool)
    .await?;

    // Build context from linked notes
    let mut linked_context = String::new();
    for link in links {
        // Take first 200 chars as context
        let preview = link.content.chars().take(200).collect::<String>();
        linked_context.push_str(&format!(
            "\n- Related note (similarity {:.0}%): {}\n",
            link.score * 100.0,
            preview
        ));
    }

    // Generate updated content with context
    let prompt = format!(
        "You have an enhanced note that has been linked to related notes. \
Add a 'Related Context' section at the end that briefly mentions the connections.\n\n\
Current Enhanced Note:\n{}\n\n\
Related Notes Found:\n{}\n\n\
Add a brief '## Related Context' section at the end that mentions these connections naturally.\n\
Keep it concise (2-3 sentences). Output the full note with the new section added.",
        current.content, linked_context
    );

    let updated_content = crate::ollama::generate(&state.gen_model, &prompt).await?;

    // Update the enhanced content
    sqlx::query!(
        "UPDATE note_revised_current SET content = $1 WHERE note_id = $2",
        updated_content,
        note_id
    )
    .execute(&state.pool)
    .await?;

    tracing::info!("Successfully updated note {} with linked context", note_id);
    Ok(())
}

/// Generate embeddings for the note content
pub async fn embed_note_content(
    state: &AppState,
    note_id: Uuid,
    content: &str,
) -> anyhow::Result<()> {
    // Delete previous embeddings
    sqlx::query!("DELETE FROM embedding WHERE note_id = $1", note_id)
        .execute(&state.pool)
        .await?;

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
            embed_id,
            note_id,
            idx as i32,
            chunk,
            &vector.to_vec() as &Vec<f32>,
            state.embed_model
        )
        .execute(&state.pool)
        .await?;
    }

    Ok(())
}

/// Clean up enhanced content to remove any accidental markers
fn clean_enhanced_content(content: &str) -> String {
    let mut cleaned = content.to_string();

    // Remove common markers that might slip through
    let markers = [
        "PART 1",
        "PART 2",
        "ENHANCED NOTE",
        "METADATA",
        "---",
        "```json",
        "```markdown",
        "```",
    ];

    for marker in &markers {
        if cleaned.starts_with(marker) {
            cleaned = cleaned
                .split_once('\n')
                .map(|x| x.1)
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

/// Parse explicit tags and topics from content
fn parse_explicit_tags_and_topics(content: &str) -> (Vec<String>, Vec<String>) {
    use regex::Regex;

    // Parse tags like #tag-name or #tagname
    let tag_regex = Regex::new(r"#([a-zA-Z][a-zA-Z0-9_-]*)").unwrap();
    let tags: Vec<String> = tag_regex
        .captures_iter(content)
        .map(|cap| cap[1].to_lowercase().replace('_', "-"))
        .filter(|tag| tag.len() > 1 && tag.len() < 50)
        .collect();

    // Parse topics like [Topic Name] or [topic]
    let topic_regex = Regex::new(r"\[([^\]]+)\]").unwrap();
    let topics: Vec<String> = topic_regex
        .captures_iter(content)
        .map(|cap| cap[1].trim().to_string())
        .filter(|topic| !topic.is_empty() && topic.len() > 2 && topic.len() < 100)
        .filter(|topic| !topic.contains("http") && !topic.contains("www")) // Exclude URLs
        .collect();

    (tags, topics)
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

/// Generate a contextual title for a note based on its content, metadata, and related notes
pub async fn generate_note_title(
    state: &AppState,
    content: &str,
    metadata: &serde_json::Value,
    related_notes: &[crate::models::SearchHit],
) -> anyhow::Result<String> {
    // Build context from related notes
    let mut related_context = String::new();
    if !related_notes.is_empty() {
        related_context.push_str("Related concepts from your knowledge base:\n");
        for hit in related_notes.iter().take(3) {
            if let Some(snippet) = &hit.snippet {
                related_context.push_str(&format!("- {}\n", snippet.chars().take(100).collect::<String>()));
            }
        }
        related_context.push('\n');
    }

    // Extract key topics and categories from metadata
    let topics = metadata.get("topics")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(3)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());

    let categories = metadata.get("categories")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(2)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());

    // Build metadata context
    let mut metadata_context = String::new();
    if let Some(topics_str) = topics {
        metadata_context.push_str(&format!("Key topics: {}\n", topics_str));
    }
    if let Some(categories_str) = categories {
        metadata_context.push_str(&format!("Categories: {}\n", categories_str));
    }

    let content_preview = content.chars().take(500).collect::<String>();
    
    let prompt = format!(
        r#"You are an expert at creating concise, descriptive titles for notes and documents. Your task is to generate a clear, informative title that captures the essence of the content and its place in the broader knowledge base.

Content to title:
{}

{}{}

Guidelines for the title:
1. Keep it between 3-8 words
2. Be specific and descriptive
3. Capture the main concept or purpose
4. Consider the context of related notes
5. Use natural, readable language
6. Avoid generic words like "Note", "Document", "Text"
7. Focus on the actual subject matter

Examples of good titles:
- "Machine Learning Model Deployment Pipeline"
- "React State Management Patterns"  
- "Database Index Optimization Strategies"
- "Team Meeting Notes - Project Alpha"
- "Python Data Processing Workflow"

Generate only the title, no quotes, no explanations."#,
        content_preview,
        metadata_context,
        related_context
    );

    let title = crate::ollama::generate(&state.gen_model, &prompt).await?;
    
    // Clean up the title
    let cleaned_title = title
        .trim()
        .replace('\n', " ")
        .replace('"', "")
        .chars()
        .take(80) // Max 80 characters
        .collect::<String>()
        .trim()
        .to_string();

    // Fallback if title is too short or empty
    if cleaned_title.len() < 3 {
        Ok(format!("Note from {}", chrono::Utc::now().format("%Y-%m-%d")))
    } else {
        Ok(cleaned_title)
    }
}

/// Check if a title already exists in the database (case-insensitive)
async fn title_exists(state: &AppState, title: &str, exclude_note_id: Option<Uuid>) -> anyhow::Result<bool> {
    let count = if let Some(note_id) = exclude_note_id {
        let result = sqlx::query!(
            "SELECT COUNT(*) as count FROM note WHERE LOWER(title) = LOWER($1) AND id != $2",
            title,
            note_id
        )
        .fetch_one(&state.pool)
        .await?;
        result.count.unwrap_or(0)
    } else {
        let result = sqlx::query!(
            "SELECT COUNT(*) as count FROM note WHERE LOWER(title) = LOWER($1)",
            title
        )
        .fetch_one(&state.pool)
        .await?;
        result.count.unwrap_or(0)
    };
    
    Ok(count > 0)
}

/// Generate a unique, context-aware title with retry logic
pub async fn generate_unique_title(
    state: &AppState,
    note_id: Uuid,
    content: &str,
    metadata: &serde_json::Value,
    related_notes: &[crate::models::SearchHit],
) -> anyhow::Result<String> {
    const MAX_RETRIES: usize = 3;
    let mut attempt = 0;

    while attempt < MAX_RETRIES {
        attempt += 1;
        
        tracing::info!("Title generation attempt {} for note {}", attempt, note_id);
        
        // Generate title with enhanced context awareness
        let title = generate_contextual_unique_title(state, content, metadata, related_notes, attempt).await?;
        
        // Check if this title already exists
        if !title_exists(state, &title, Some(note_id)).await? {
            tracing::info!(%note_id, title = %title, attempt, "Generated unique title");
            return Ok(title);
        }
        
        tracing::warn!(%note_id, title = %title, attempt, "Title already exists, retrying");
    }
    
    // If all retries failed, generate a fallback title with timestamp
    let fallback_title = generate_fallback_unique_title(content).await?;
    tracing::warn!(%note_id, title = %fallback_title, "Using fallback title after {} attempts", MAX_RETRIES);
    Ok(fallback_title)
}

/// Generate a contextually-aware unique title
async fn generate_contextual_unique_title(
    state: &AppState,
    content: &str,
    metadata: &serde_json::Value,
    related_notes: &[crate::models::SearchHit],
    attempt: usize,
) -> anyhow::Result<String> {
    // Build enhanced context from related notes
    let mut related_context = String::new();
    if !related_notes.is_empty() {
        related_context.push_str("Related concepts and their titles for differentiation:\n");
        for hit in related_notes.iter().take(5) {
            if let Some(snippet) = &hit.snippet {
                related_context.push_str(&format!("- {}\n", snippet.chars().take(120).collect::<String>()));
            }
        }
        related_context.push('\n');
    }

    // Extract key topics and categories from metadata for uniqueness
    let topics = metadata.get("topics")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(4)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());

    let categories = metadata.get("categories")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(3)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());

    let keywords = metadata.get("keywords")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(3)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());

    // Build metadata context
    let mut metadata_context = String::new();
    if let Some(topics_str) = topics {
        metadata_context.push_str(&format!("Key topics: {}\n", topics_str));
    }
    if let Some(categories_str) = categories {
        metadata_context.push_str(&format!("Categories: {}\n", categories_str));
    }
    if let Some(keywords_str) = keywords {
        metadata_context.push_str(&format!("Important keywords: {}\n", keywords_str));
    }

    let content_preview = content.chars().take(600).collect::<String>();
    
    let uniqueness_guidance = match attempt {
        1 => "Focus on the most distinctive aspect of this content.",
        2 => "Emphasize specific technical details or unique angles that set this apart.",
        _ => "Include specific terminology, methodologies, or unique identifiers to ensure distinctiveness.",
    };
    
    let prompt = format!(
        r#"You are an expert at creating highly distinctive, unique titles for technical notes and documents. Your task is to generate a title that is both informative and completely unique within a knowledge base.

Content to title:
{content_preview}

{metadata_context}{related_context}CRITICAL REQUIREMENTS for uniqueness:
1. The title MUST be highly specific and distinctive
2. Include technical terminology or specific concepts that make it unique
3. Avoid generic terms like "Introduction", "Overview", "Guide", "Basics"
4. Use specific methodologies, frameworks, or unique aspects mentioned in the content
5. {uniqueness_guidance}
6. Length: 3-8 words maximum
7. Be precise and technical rather than broad

Examples of GOOD distinctive titles:
- "LSTM Backpropagation Through Time Implementation"
- "Redis Pub/Sub vs Apache Kafka Event Streaming"
- "PostgreSQL MVCC Transaction Isolation Levels"
- "React useEffect Cleanup Pattern Memory Leaks"
- "Kubernetes StatefulSet Pod Disruption Budgets"

Examples of BAD generic titles to AVOID:
- "Machine Learning Basics"
- "Database Overview" 
- "Web Development Guide"
- "Programming Concepts"
- "Introduction to AI"

Generate only the title, no quotes, no explanations. Make it as specific and technically distinctive as possible."#,
        content_preview = content_preview,
        metadata_context = metadata_context,
        related_context = related_context,
        uniqueness_guidance = uniqueness_guidance
    );

    let title = crate::ollama::generate(&state.gen_model, &prompt).await?;

    // Clean up the title - more conservative cleaning
    let mut cleaned_title = title
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .replace("\n", " ");
    
    // Remove any prompt artifacts that might have leaked through
    let artifacts_to_remove = [
        "Title Output", "Output", "Title:", "Generated Title:", "Result:", 
        "Answer:", "Test", "Example", "Sample", "Demo"
    ];
    
    for artifact in &artifacts_to_remove {
        if cleaned_title.starts_with(artifact) {
            cleaned_title = cleaned_title.strip_prefix(artifact)
                .unwrap_or(&cleaned_title)
                .trim()
                .to_string();
        }
    }
    
    // Filter characters and normalize whitespace
    let cleaned_title = cleaned_title
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || ":-&()[]{}.,!?/".contains(*c))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");
        
    tracing::debug!("Title before cleaning: '{}'", title.trim());
    tracing::debug!("Title after cleaning: '{}'", cleaned_title);

    // Ensure minimum length for distinctiveness
    if cleaned_title.len() < 10 {
        return Err(anyhow::anyhow!("Generated title too short: {}", cleaned_title));
    }

    Ok(cleaned_title)
}

/// Generate a fallback title with timestamp to ensure uniqueness
async fn generate_fallback_unique_title(content: &str) -> anyhow::Result<String> {
    let first_words: String = content
        .split_whitespace()
        .take(4)
        .collect::<Vec<&str>>()
        .join(" ");
    
    let timestamp = chrono::Utc::now().format("%H%M%S").to_string();
    Ok(format!("{} [{}]", first_words, timestamp))
}

/// Store the generated title for a note
pub async fn store_note_title(
    state: &AppState,
    note_id: Uuid,
    title: &str,
) -> anyhow::Result<()> {
    // Update the note title
    sqlx::query!(
        "UPDATE note SET title = $1, updated_at_utc = NOW() WHERE id = $2",
        title,
        note_id
    )
    .execute(&state.pool)
    .await?;

    tracing::info!(%note_id, title = %title, "Updated note title");
    Ok(())
}
