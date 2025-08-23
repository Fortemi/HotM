use fake::{Fake, Faker};
use serde_json::json;
use uuid::Uuid;

pub fn create_test_note_json() -> serde_json::Value {
    json!({
        "content": "# Test Note\n\nThis is a test note with some content.",
        "format": "markdown",
        "source": "test"
    })
}

pub fn create_random_note_json() -> serde_json::Value {
    let title: String = Faker.fake();
    let body: String = Faker.fake();
    
    json!({
        "content": format!("# {}\n\n{}", title, body),
        "format": "markdown",
        "source": "test"
    })
}

pub fn create_test_tag_json() -> serde_json::Value {
    json!({
        "add": ["test-tag", "integration"],
        "remove": []
    })
}

pub fn create_test_link_json(to_note_id: Uuid) -> serde_json::Value {
    json!({
        "to_note_id": to_note_id.to_string()
    })
}