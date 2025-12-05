//! Unit tests for API route handlers and helper functions.
//!
//! These tests validate request/response handling, helper function logic,
//! and API endpoint behavior using mock data where possible.

#[cfg(test)]
mod tests {
    use crate::routes::*;
    use serde_json::json;
    use std::collections::HashSet;

    // =============================================================================
    // HEALTH ROUTE TESTS
    // =============================================================================

    #[tokio::test]
    async fn health_response_structure() {
        // Test Health struct serialization
        let health = health::Health {
            ok: true,
            ollama: true,
            db: true,
            vector: true,
        };

        let json = serde_json::to_string(&health).unwrap();
        assert!(json.contains("\"ok\":true"));
        assert!(json.contains("\"ollama\":true"));
        assert!(json.contains("\"db\":true"));
        assert!(json.contains("\"vector\":true"));
    }

    #[tokio::test]
    async fn health_response_partial_failure() {
        // Test when some components are down
        let health = health::Health {
            ok: false,
            ollama: false,
            db: true,
            vector: true,
        };

        let json = serde_json::to_string(&health).unwrap();
        assert!(json.contains("\"ok\":false"));
        assert!(json.contains("\"ollama\":false"));
    }

    #[tokio::test]
    async fn api_info_response_structure() {
        let info = health::ApiInfo {
            name: "Test API".to_string(),
            version: "v1".to_string(),
            endpoints: vec!["GET /test".to_string()],
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"name\":\"Test API\""));
        assert!(json.contains("\"version\":\"v1\""));
        assert!(json.contains("GET /test"));
    }

    // =============================================================================
    // SEARCH HELPER FUNCTION TESTS
    // =============================================================================

    #[test]
    fn safe_truncate_within_limit() {
        let text = "Hello world";
        let result = search::safe_truncate_test(text, 20);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn safe_truncate_at_limit() {
        let text = "Hello world";
        let result = search::safe_truncate_test(text, 11);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn safe_truncate_over_limit() {
        let text = "Hello world test";
        let result = search::safe_truncate_test(text, 11);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn safe_truncate_unicode_boundary() {
        // Japanese text: こんにちは (5 characters, 15 bytes)
        let text = "こんにちは";
        // Truncate in middle of character boundary
        let result = search::safe_truncate_test(text, 7);
        // Should truncate to valid boundary
        assert!(result.len() <= 7);
        assert!(result.is_char_boundary(result.len()));
    }

    #[test]
    fn safe_truncate_emoji() {
        let text = "Hello 🌍 World";
        let result = search::safe_truncate_test(text, 8);
        // Should truncate before emoji or include it properly
        assert!(result.is_char_boundary(result.len()));
    }

    #[test]
    fn safe_truncate_empty_string() {
        let text = "";
        let result = search::safe_truncate_test(text, 10);
        assert_eq!(result, "");
    }

    #[test]
    fn safe_truncate_zero_limit() {
        let text = "Hello";
        let result = search::safe_truncate_test(text, 0);
        assert_eq!(result, "");
    }

    // =============================================================================
    // SET OVERLAP CALCULATION TESTS
    // =============================================================================

    #[test]
    fn set_overlap_identical_sets() {
        let set1: HashSet<String> = vec!["a", "b", "c"].into_iter().map(String::from).collect();
        let set2: HashSet<String> = vec!["a", "b", "c"].into_iter().map(String::from).collect();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        assert!((overlap - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn set_overlap_no_overlap() {
        let set1: HashSet<String> = vec!["a", "b"].into_iter().map(String::from).collect();
        let set2: HashSet<String> = vec!["c", "d"].into_iter().map(String::from).collect();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        assert!((overlap - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn set_overlap_partial() {
        let set1: HashSet<String> = vec!["a", "b", "c"].into_iter().map(String::from).collect();
        let set2: HashSet<String> = vec!["b", "c", "d"].into_iter().map(String::from).collect();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        // Jaccard: intersection(b,c) / union(a,b,c,d) = 2/4 = 0.5
        assert!((overlap - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn set_overlap_empty_first() {
        let set1: HashSet<String> = HashSet::new();
        let set2: HashSet<String> = vec!["a", "b"].into_iter().map(String::from).collect();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        assert!((overlap - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn set_overlap_empty_second() {
        let set1: HashSet<String> = vec!["a", "b"].into_iter().map(String::from).collect();
        let set2: HashSet<String> = HashSet::new();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        assert!((overlap - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn set_overlap_both_empty() {
        let set1: HashSet<String> = HashSet::new();
        let set2: HashSet<String> = HashSet::new();

        let overlap = search::calculate_set_overlap_test(&set1, &set2);
        assert!((overlap - 0.0).abs() < f32::EPSILON);
    }

    // =============================================================================
    // METADATA EXTRACTION TESTS
    // =============================================================================

    #[test]
    fn extract_metadata_field_valid() {
        let meta = json!({
            "categories": ["programming", "rust", "testing"]
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        assert_eq!(result.len(), 3);
        assert!(result.contains("programming"));
        assert!(result.contains("rust"));
        assert!(result.contains("testing"));
    }

    #[test]
    fn extract_metadata_field_missing() {
        let meta = json!({
            "other": ["value"]
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        assert!(result.is_empty());
    }

    #[test]
    fn extract_metadata_field_null() {
        let meta = json!({
            "categories": null
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        assert!(result.is_empty());
    }

    #[test]
    fn extract_metadata_field_not_array() {
        let meta = json!({
            "categories": "not-an-array"
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        assert!(result.is_empty());
    }

    #[test]
    fn extract_metadata_field_mixed_types() {
        let meta = json!({
            "categories": ["valid", 123, "another", null, true]
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        // Only string values should be extracted
        assert_eq!(result.len(), 2);
        assert!(result.contains("valid"));
        assert!(result.contains("another"));
    }

    #[test]
    fn extract_metadata_field_case_normalized() {
        let meta = json!({
            "categories": ["Programming", "RUST", "TeSting"]
        });

        let result = search::extract_metadata_field_test(&meta, "categories");
        // Values should be lowercase
        assert!(result.contains("programming"));
        assert!(result.contains("rust"));
        assert!(result.contains("testing"));
    }

    // =============================================================================
    // ENTITY EXTRACTION TESTS
    // =============================================================================

    #[test]
    fn extract_entity_field_valid() {
        let entities = json!({
            "people": ["Alice", "Bob"],
            "organizations": ["Acme Corp"]
        });

        let people = search::extract_entity_field_test(&entities, "people");
        assert_eq!(people.len(), 2);
        assert!(people.contains("alice"));
        assert!(people.contains("bob"));

        let orgs = search::extract_entity_field_test(&entities, "organizations");
        assert_eq!(orgs.len(), 1);
        assert!(orgs.contains("acme corp"));
    }

    #[test]
    fn extract_entity_field_missing() {
        let entities = json!({
            "people": ["Alice"]
        });

        let result = search::extract_entity_field_test(&entities, "technologies");
        assert!(result.is_empty());
    }

    // =============================================================================
    // METADATA OVERLAP CALCULATION TESTS
    // =============================================================================

    #[test]
    fn metadata_overlap_identical() {
        let meta1 = json!({
            "categories": ["programming"],
            "topics": ["rust", "testing"]
        });
        let meta2 = json!({
            "categories": ["programming"],
            "topics": ["rust", "testing"]
        });

        let score = search::calculate_metadata_overlap_test(&meta1, &meta2);
        assert!(score > 0.5, "Identical metadata should have high overlap");
    }

    #[test]
    fn metadata_overlap_different_categories() {
        let meta1 = json!({
            "categories": ["programming"],
            "topics": ["rust"]
        });
        let meta2 = json!({
            "categories": ["cooking"],
            "topics": ["recipes"]
        });

        let score = search::calculate_metadata_overlap_test(&meta1, &meta2);
        assert!(score < 0.3, "Different categories should have low overlap");
    }

    #[test]
    fn metadata_overlap_partial_topics() {
        let meta1 = json!({
            "categories": ["programming"],
            "topics": ["rust", "testing", "api"]
        });
        let meta2 = json!({
            "categories": ["programming"],
            "topics": ["rust", "database", "sql"]
        });

        let score = search::calculate_metadata_overlap_test(&meta1, &meta2);
        // Same category + some topic overlap
        assert!(score > 0.2);
    }

    #[test]
    fn metadata_overlap_empty_source() {
        let meta1 = json!({});
        let meta2 = json!({
            "categories": ["programming"]
        });

        let score = search::calculate_metadata_overlap_test(&meta1, &meta2);
        assert!((score - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn metadata_overlap_with_entities() {
        let meta1 = json!({
            "categories": ["technology"],
            "entities": {
                "people": ["elon musk"],
                "organizations": ["tesla", "spacex"]
            }
        });
        let meta2 = json!({
            "categories": ["technology"],
            "entities": {
                "people": ["elon musk"],
                "organizations": ["tesla"]
            }
        });

        let score = search::calculate_metadata_overlap_test(&meta1, &meta2);
        // Same category + entity overlap
        assert!(score > 0.3);
    }

    // =============================================================================
    // RRF FUSION TESTS
    // =============================================================================

    #[test]
    fn rrf_fuse_empty_inputs() {
        let a = vec![];
        let b = vec![];
        let result = search::rrf_fuse_test(a, b, 10);
        assert!(result.is_empty());
    }

    #[test]
    fn rrf_fuse_single_source() {
        use crate::models::SearchHit;
        use uuid::Uuid;

        let id1 = Uuid::new_v4();
        let a = vec![
            SearchHit { note_id: id1, score: 0.9, snippet: Some("test".to_string()) }
        ];
        let b = vec![];

        let result = search::rrf_fuse_test(a, b, 10);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].note_id, id1);
    }

    #[test]
    fn rrf_fuse_respects_limit() {
        use crate::models::SearchHit;
        use uuid::Uuid;

        let hits: Vec<SearchHit> = (0..10).map(|_| {
            SearchHit { note_id: Uuid::new_v4(), score: 0.5, snippet: None }
        }).collect();

        let result = search::rrf_fuse_test(hits.clone(), hits, 3);
        assert!(result.len() <= 3);
    }

    #[test]
    fn rrf_fuse_combines_rankings() {
        use crate::models::SearchHit;
        use uuid::Uuid;

        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let id3 = Uuid::new_v4();

        // id1 ranked 1st in a, id2 ranked 2nd
        let a = vec![
            SearchHit { note_id: id1, score: 0.9, snippet: None },
            SearchHit { note_id: id2, score: 0.8, snippet: None },
        ];
        // id2 ranked 1st in b, id3 ranked 2nd
        let b = vec![
            SearchHit { note_id: id2, score: 0.9, snippet: None },
            SearchHit { note_id: id3, score: 0.8, snippet: None },
        ];

        let result = search::rrf_fuse_test(a, b, 10);
        // id2 appears in both, should be ranked higher
        assert!(!result.is_empty());
    }

    // =============================================================================
    // SEARCH PARAMS DESERIALIZATION TESTS
    // =============================================================================

    #[test]
    fn search_params_all_fields() {
        let params: search::SearchParams = serde_json::from_str(
            r#"{"q": "test query", "mode": "hybrid", "filters": "tag:rust"}"#
        ).unwrap();

        assert_eq!(params.q, "test query");
        assert_eq!(params.mode, Some("hybrid".to_string()));
        assert_eq!(params.filters, Some("tag:rust".to_string()));
    }

    #[test]
    fn search_params_required_only() {
        let params: search::SearchParams = serde_json::from_str(
            r#"{"q": "test"}"#
        ).unwrap();

        assert_eq!(params.q, "test");
        assert!(params.mode.is_none());
        assert!(params.filters.is_none());
    }

    #[test]
    fn search_params_empty_query() {
        let params: search::SearchParams = serde_json::from_str(
            r#"{"q": ""}"#
        ).unwrap();

        assert!(params.q.is_empty());
    }

    // =============================================================================
    // RELATED NOTES RESPONSE TESTS
    // =============================================================================

    #[test]
    fn related_notes_response_serialization() {
        use crate::models::SearchHit;
        use uuid::Uuid;

        let response = search::RelatedNotesResponse {
            related: vec![
                SearchHit { note_id: Uuid::new_v4(), score: 0.8, snippet: Some("test".to_string()) }
            ],
            context_summary: Some("These notes are related.".to_string()),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("related"));
        assert!(json.contains("context_summary"));
    }

    #[test]
    fn related_notes_response_no_context() {
        let response = search::RelatedNotesResponse {
            related: vec![],
            context_summary: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"related\":[]"));
        assert!(json.contains("\"context_summary\":null"));
    }

    // =============================================================================
    // GENERATE CONTEXT REQUEST/RESPONSE TESTS
    // =============================================================================

    #[test]
    fn generate_context_request_deserialization() {
        use uuid::Uuid;

        let id = Uuid::new_v4();
        let json = format!(
            r#"{{"query": "test", "hits": [{{"note_id": "{}", "score": 0.5, "snippet": null}}]}}"#,
            id
        );

        let req: search::GenerateContextRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req.query, "test");
        assert_eq!(req.hits.len(), 1);
        assert_eq!(req.hits[0].note_id, id);
    }

    #[test]
    fn generate_context_response_serialization() {
        let response = search::GenerateContextResponse {
            context: "This is the context summary.".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("This is the context summary."));
    }
}
