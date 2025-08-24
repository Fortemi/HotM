# Testing Strategy

## Overview
Comprehensive testing approach targeting 60-80% code coverage across unit, integration, and end-to-end tests following SOLID principles.

## Testing Pyramid

```
         /\
        /E2E\        5%  - Critical user journeys
       /------\
      /Integration\  25% - API and service integration
     /------------\
    /   Unit Tests  \ 70% - Business logic and components
   /________________\
```

## Test Organization

### Server Test Structure
```
server/
├── src/
│   └── *.rs                    # Unit tests in source files
├── tests/
│   ├── common/
│   │   ├── mod.rs              # Shared test utilities
│   │   ├── fixtures.rs         # Test data fixtures
│   │   └── helpers.rs          # Helper functions
│   ├── api_integration.rs      # API endpoint tests
│   ├── search_integration.rs   # Search functionality
│   ├── nlp_integration.rs      # NLP pipeline tests
│   └── mcp_integration.rs      # MCP server tests
└── benches/
    └── search_bench.rs         # Performance benchmarks
```

### UI Test Structure
```
ui/
├── src/
│   └── **/*.test.tsx           # Component unit tests
├── tests/
│   ├── e2e/
│   │   ├── smoke.spec.ts      # Smoke tests
│   │   ├── notes.spec.ts      # Note management
│   │   └── search.spec.ts     # Search functionality
│   └── fixtures/
│       └── test-data.ts       # Test data
```

## Unit Testing

### Rust Unit Tests

#### Basic Test Structure
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_synchronous_function() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
    
    #[tokio::test]
    async fn test_async_function() {
        let result = fetch_data().await;
        assert!(result.is_ok());
    }
}
```

#### Mocking Dependencies
```rust
use mockall::*;

#[automock]
#[async_trait]
pub trait NoteRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Note>>;
    async fn save(&self, note: &Note) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_note_service() {
        let mut mock_repo = MockNoteRepository::new();
        
        mock_repo
            .expect_find_by_id()
            .with(eq(test_id))
            .times(1)
            .returning(|_| Ok(Some(test_note())));
        
        let service = NoteService::new(Arc::new(mock_repo));
        let result = service.get_note(test_id).await;
        
        assert!(result.is_ok());
    }
}
```

#### Testing Error Cases
```rust
#[tokio::test]
async fn test_error_handling() {
    let mut mock_repo = MockNoteRepository::new();
    
    mock_repo
        .expect_find_by_id()
        .returning(|_| Err(DatabaseError::ConnectionLost));
    
    let service = NoteService::new(Arc::new(mock_repo));
    let result = service.get_note(Uuid::new_v4()).await;
    
    assert!(matches!(result, Err(ServiceError::Database(_))));
}
```

### TypeScript Unit Tests

#### Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEditor } from './NoteEditor';

describe('NoteEditor', () => {
  it('should render with initial content', () => {
    render(<NoteEditor initialContent="Test content" />);
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
  
  it('should handle save action', async () => {
    const onSave = jest.fn();
    render(<NoteEditor onSave={onSave} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New content' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(onSave).toHaveBeenCalledWith('New content');
  });
});
```

#### Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useNotes } from './useNotes';

describe('useNotes', () => {
  it('should fetch notes on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotes());
    
    expect(result.current.loading).toBe(true);
    
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.notes).toHaveLength(3);
  });
});
```

## Integration Testing

### API Integration Tests
```rust
// tests/api_integration.rs
use hotm_server::test_helpers::*;
use sqlx::PgPool;

#[tokio::test]
async fn test_note_lifecycle() {
    let pool = setup_test_database().await;
    let app = setup_test_app(pool.clone()).await;
    
    // Create note
    let create_response = app
        .post("/api/v1/notes")
        .json(&json!({
            "content": "Integration test note",
            "format": "markdown"
        }))
        .send()
        .await;
    
    assert_eq!(create_response.status(), 201);
    let created: CreateNoteResponse = create_response.json().await;
    
    // Retrieve note
    let get_response = app
        .get(&format!("/api/v1/notes/{}", created.note_id))
        .send()
        .await;
    
    assert_eq!(get_response.status(), 200);
    let note: NoteFull = get_response.json().await;
    assert_eq!(note.original.content, "Integration test note");
    
    // Update note
    let update_response = app
        .put(&format!("/api/v1/notes/{}/revised", created.note_id))
        .json(&json!({
            "content": "Updated content"
        }))
        .send()
        .await;
    
    assert_eq!(update_response.status(), 200);
    
    // Delete note
    let delete_response = app
        .delete(&format!("/api/v1/notes/{}", created.note_id))
        .send()
        .await;
    
    assert_eq!(delete_response.status(), 204);
    
    // Verify deletion
    let verify_response = app
        .get(&format!("/api/v1/notes/{}", created.note_id))
        .send()
        .await;
    
    assert_eq!(verify_response.status(), 404);
}
```

### Database Integration Tests
```rust
#[tokio::test]
async fn test_search_functionality() {
    let pool = setup_test_database().await;
    let service = SearchService::new(pool.clone());
    
    // Insert test data
    insert_test_notes(&pool).await;
    
    // Test full-text search
    let fts_results = service
        .search(SearchQuery {
            query: "machine learning".to_string(),
            mode: SearchMode::FullText,
            limit: 10,
        })
        .await
        .unwrap();
    
    assert!(!fts_results.hits.is_empty());
    
    // Test vector search
    let vector_results = service
        .search(SearchQuery {
            query: "artificial intelligence concepts".to_string(),
            mode: SearchMode::Vector,
            limit: 10,
        })
        .await
        .unwrap();
    
    assert!(!vector_results.hits.is_empty());
    
    // Test hybrid search
    let hybrid_results = service
        .search(SearchQuery {
            query: "neural networks".to_string(),
            mode: SearchMode::Hybrid,
            limit: 10,
        })
        .await
        .unwrap();
    
    assert!(hybrid_results.hits.len() >= fts_results.hits.len());
}
```

### NLP Pipeline Integration
```rust
#[tokio::test]
async fn test_nlp_pipeline() {
    let ollama = setup_mock_ollama().await;
    let pipeline = setup_test_pipeline(ollama).await;
    
    let note = Note {
        id: Uuid::new_v4(),
        content: "This is a test note about machine learning.".to_string(),
    };
    
    let result = pipeline.process_note(note).await.unwrap();
    
    assert!(result.revised_content.is_some());
    assert!(!result.tags.is_empty());
    assert!(!result.embeddings.is_empty());
    assert!(result.summary.is_some());
}
```

## End-to-End Testing

### Playwright E2E Tests
```typescript
// tests/e2e/notes.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Note Management', () => {
  test('should create and search for a note', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Create a note
    await page.fill('[placeholder="Paste or type notes..."]', 'E2E test note');
    await page.click('button:has-text("Save")');
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Search for the note
    await page.fill('[placeholder="Search"]', 'E2E test');
    await page.click('button:has-text("Search")');
    
    // Verify note appears in results
    await expect(page.locator('.search-result')).toContainText('E2E test');
    
    // Open the note
    await page.click('.search-result:first-child');
    
    // Verify content
    await expect(page.locator('.note-content')).toContainText('E2E test note');
  });
  
  test('should switch between note views', async ({ page }) => {
    // Assume note is already created and opened
    await page.goto('http://localhost:1420/notes/test-id');
    
    // Check revised view (default)
    await expect(page.locator('button:has-text("Revised")')).toBeDisabled();
    
    // Switch to original
    await page.click('button:has-text("Original")');
    await expect(page.locator('button:has-text("Original")')).toBeDisabled();
    
    // Switch to provenance
    await page.click('button:has-text("Provenance")');
    await expect(page.locator('.provenance-tree')).toBeVisible();
  });
});
```

### API E2E Tests
```bash
#!/bin/bash
# scripts/e2e_api_smoke.sh

API_BASE="http://127.0.0.1:53211/api/v1"

# Health check
curl -f "$API_BASE/health" || exit 1

# Create note
NOTE_ID=$(curl -X POST "$API_BASE/notes" \
  -H "Content-Type: application/json" \
  -d '{"content":"E2E test"}' \
  | jq -r '.noteId')

# Retrieve note
curl -f "$API_BASE/notes/$NOTE_ID" || exit 1

# Search
curl -f "$API_BASE/search?q=E2E" || exit 1

echo "E2E tests passed!"
```

## Test Data Management

### Fixtures
```rust
// tests/common/fixtures.rs
pub fn test_note() -> Note {
    Note {
        id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
        content: "Test note content".to_string(),
        format: "markdown".to_string(),
        created_at_utc: Utc::now(),
    }
}

pub async fn seed_test_database(pool: &PgPool) {
    sqlx::query("INSERT INTO note (id, content) VALUES ($1, $2)")
        .bind(test_note().id)
        .bind(test_note().content)
        .execute(pool)
        .await
        .unwrap();
}
```

### Test Database
```rust
// tests/common/helpers.rs
pub async fn setup_test_database() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://test:test@localhost:5432/hotm_test".to_string());
    
    let pool = PgPool::connect(&url).await.unwrap();
    
    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .unwrap();
    
    // Clean existing data
    sqlx::query("TRUNCATE TABLE note CASCADE")
        .execute(&pool)
        .await
        .unwrap();
    
    pool
}
```

## Mocking Strategies

### Mock Ollama Service
```rust
pub struct MockOllamaClient {
    responses: HashMap<String, String>,
}

impl MockOllamaClient {
    pub fn new() -> Self {
        let mut responses = HashMap::new();
        responses.insert(
            "summarize".to_string(),
            "This is a summary.".to_string(),
        );
        responses.insert(
            "revise".to_string(),
            "This is revised content.".to_string(),
        );
        Self { responses }
    }
}

#[async_trait]
impl OllamaService for MockOllamaClient {
    async fn generate(&self, prompt: &str) -> Result<String> {
        Ok(self.responses.get("summarize").unwrap().clone())
    }
    
    async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        Ok(vec![0.1, 0.2, 0.3]) // Mock embedding
    }
}
```

## Coverage Requirements

### Target Coverage
- **Overall**: 60-80%
- **Business Logic**: 80-90%
- **API Routes**: 70-80%
- **NLP Pipeline**: 70-80%
- **UI Components**: 60-70%
- **Utilities**: 50-60%

### Coverage Tools
```bash
# Rust coverage with tarpaulin
cargo install cargo-tarpaulin
cargo tarpaulin --out Html --output-dir coverage

# TypeScript coverage with Jest
npm run test -- --coverage

# View coverage report
open coverage/index.html
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  rust-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rust-lang/setup-rust-toolchain@v1
      
      - name: Run tests
        env:
          TEST_DATABASE_URL: postgres://postgres:test@localhost:5432/test
        run: |
          cd server
          cargo test --all-features
      
      - name: Generate coverage
        run: |
          cargo tarpaulin --out Xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd ui
          npm ci
      
      - name: Run tests
        run: |
          cd ui
          npm run test -- --coverage
      
      - name: Run E2E tests
        run: |
          cd ui
          npx playwright install
          npm run test:e2e
```

## Test Execution

### Running Specific Tests
```bash
# Run single test
cargo test test_create_note

# Run tests matching pattern
cargo test search

# Run with output
cargo test -- --nocapture

# Run in parallel
cargo test -- --test-threads=4

# Run ignored tests
cargo test -- --ignored
```

### Test Organization
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    mod note_tests {
        use super::*;
        
        #[test]
        fn test_create() { }
        
        #[test]
        fn test_update() { }
    }
    
    mod search_tests {
        use super::*;
        
        #[test]
        fn test_fts() { }
        
        #[test]
        fn test_vector() { }
    }
}
```

## Performance Testing

### Benchmark Tests
```rust
// benches/search_bench.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn search_benchmark(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let service = rt.block_on(setup_search_service());
    
    c.bench_function("fts_search", |b| {
        b.to_async(&rt).iter(|| async {
            service.search("test query").await
        });
    });
    
    c.bench_function("vector_search", |b| {
        b.to_async(&rt).iter(|| async {
            service.semantic_search("test query").await
        });
    });
}

criterion_group!(benches, search_benchmark);
criterion_main!(benches);
```

### Load Testing
```javascript
// k6 load test
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
};

export default function() {
  let response = http.get('http://localhost:53211/api/v1/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```