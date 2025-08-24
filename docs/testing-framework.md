# Testing Framework Strategy

## Overview
Comprehensive testing strategy for HotM using industry-standard frameworks for both Rust backend and React/TypeScript frontend.

## Test Types

### 1. Unit Tests
- **Backend (Rust)**: Built-in `cargo test` with `#[test]` attributes
- **Frontend (React)**: Vitest for component and utility testing
- **Coverage Target**: 70-80% for business logic

### 2. Integration Tests
- **Backend**: Rust integration tests in `tests/` directory
- **Frontend**: Playwright for E2E testing
- **API Testing**: Dedicated integration tests for all endpoints

### 3. System Tests
- **Database**: SQLx compile-time verification + runtime tests
- **Job Queue**: Async job processing tests
- **WebSocket**: Real-time communication tests

## Backend Testing (Rust)

### Framework Setup
```toml
# Cargo.toml additions
[dev-dependencies]
tokio-test = "0.4"
tower = { version = "0.4", features = ["util"] }
hyper = { version = "1.0", features = ["full"] }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json", "migrate", "macros"] }
wiremock = "0.6"  # For mocking external services
fake = "2.9"       # For generating test data
rstest = "0.18"    # For parameterized tests
```

### Test Structure
```
server/
├── src/
│   ├── lib.rs           # Library exports for testing
│   └── *.rs             # Unit tests in same file as code
├── tests/
│   ├── common/
│   │   ├── mod.rs       # Shared test utilities
│   │   ├── fixtures.rs  # Test data fixtures
│   │   └── helpers.rs   # Test helper functions
│   ├── api/
│   │   ├── notes_test.rs
│   │   ├── search_test.rs
│   │   ├── jobs_test.rs
│   │   └── websocket_test.rs
│   └── integration/
│       ├── job_queue_test.rs
│       ├── nlp_pipeline_test.rs
│       └── linking_test.rs
```

### Unit Test Examples

```rust
// src/models.rs
#[cfg(test)]
mod tests {
    use super::*;
    use rstest::*;

    #[rstest]
    #[case("markdown", true)]
    #[case("plaintext", true)]
    #[case("invalid", false)]
    fn test_format_validation(#[case] format: &str, #[case] expected: bool) {
        let result = validate_format(format);
        assert_eq!(result, expected);
    }

    #[tokio::test]
    async fn test_note_creation() {
        let note = NoteMeta {
            id: Uuid::new_v4(),
            format: "markdown".to_string(),
            source: "test".to_string(),
            created_at_utc: Utc::now(),
            updated_at_utc: Utc::now(),
            starred: Some(false),
            archived: Some(false),
            last_accessed_at: None,
            metadata: serde_json::json!({}),
        };
        
        assert_eq!(note.format, "markdown");
    }
}
```

### Integration Test Examples

```rust
// tests/api/notes_test.rs
use hotm_server::{create_app, AppState};
use sqlx::PgPool;
use tower::ServiceExt;
use hyper::{Body, Request, StatusCode};

#[tokio::test]
async fn test_create_note_endpoint() {
    let pool = setup_test_db().await;
    let app = create_app(AppState::new(pool.clone())).await;
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/notes")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"content": "Test note"}"#))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Verify database state
    let count = sqlx::query!("SELECT COUNT(*) as count FROM note")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count.count, Some(1));
}

#[tokio::test]
async fn test_job_queue_processing() {
    let pool = setup_test_db().await;
    let state = AppState::new(pool.clone());
    
    // Queue a job
    let job_id = queue_job(&pool, None, JobType::AiRevision, 5, None).await.unwrap();
    
    // Start job processor
    let manager = JobQueueManager::new(state);
    tokio::spawn(async move {
        manager.run().await;
    });
    
    // Wait for processing
    tokio::time::sleep(Duration::from_secs(5)).await;
    
    // Verify job completed
    let job = sqlx::query!("SELECT status FROM job_queue WHERE id = $1", job_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(job.status, "completed");
}
```

## Frontend Testing

### Framework Setup
```json
// package.json additions
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@vitest/ui": "^1.0.0",
    "vitest": "^1.0.0",
    "jsdom": "^23.0.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"  // Mock Service Worker for API mocking
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  }
}
```

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Component Test Examples

```typescript
// src/components/__tests__/JobQueueIndicator.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueueIndicator } from '../JobQueueIndicator';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.get('/api/v1/ws', (req, res, ctx) => {
    return res(ctx.status(101)); // WebSocket upgrade
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('JobQueueIndicator', () => {
  it('displays idle status when no jobs', () => {
    render(<JobQueueIndicator />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows processing indicator when jobs running', async () => {
    // Mock WebSocket message
    const mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };
    
    global.WebSocket = vi.fn(() => mockWs);
    
    render(<JobQueueIndicator />);
    
    // Simulate WebSocket message
    mockWs.onmessage({
      data: JSON.stringify({
        type: 'QueueStatus',
        running: 2,
        pending: 3,
        total_jobs: 5
      })
    });
    
    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
```

### E2E Test Examples

```typescript
// tests/e2e/note-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Note Creation Flow', () => {
  test('creates and processes a new note', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Create a note
    await page.click('button:has-text("New Note")');
    await page.fill('textarea', '# Test Note\nThis is a test note content');
    await page.click('button:has-text("Save")');
    
    // Wait for processing indicator
    await expect(page.locator('text=Processing')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Idle')).toBeVisible({ timeout: 30000 });
    
    // Verify note appears in list
    await expect(page.locator('text=Test Note')).toBeVisible();
    
    // Verify AI enhancements
    await page.click('text=Test Note');
    await page.click('button:has-text("Metadata")');
    await expect(page.locator('text=Categories')).toBeVisible();
    await expect(page.locator('text=Topics')).toBeVisible();
  });
});
```

## Database Testing

### SQLx Test Database
```rust
// tests/common/mod.rs
use sqlx::postgres::{PgPool, PgPoolOptions};
use uuid::Uuid;

pub async fn setup_test_db() -> PgPool {
    let db_name = format!("test_hotm_{}", Uuid::new_v4().simple());
    let db_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost".to_string());
    
    // Create test database
    let pool = PgPoolOptions::new()
        .connect(&db_url)
        .await
        .expect("Failed to connect to Postgres");
    
    sqlx::query(&format!("CREATE DATABASE {}", db_name))
        .execute(&pool)
        .await
        .expect("Failed to create test database");
    
    // Run migrations
    let test_db_url = format!("{}/{}", db_url, db_name);
    let test_pool = PgPoolOptions::new()
        .connect(&test_db_url)
        .await
        .expect("Failed to connect to test database");
    
    sqlx::migrate!("./migrations")
        .run(&test_pool)
        .await
        .expect("Failed to run migrations");
    
    test_pool
}

pub async fn cleanup_test_db(pool: PgPool, db_name: &str) {
    pool.close().await;
    
    let db_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost".to_string());
    
    let pool = PgPoolOptions::new()
        .connect(&db_url)
        .await
        .expect("Failed to connect to Postgres");
    
    sqlx::query(&format!("DROP DATABASE IF EXISTS {}", db_name))
        .execute(&pool)
        .await
        .expect("Failed to drop test database");
}
```

## Migration from Shell Scripts

### Current Shell Scripts to Convert

1. **test_api.sh** → Integration tests
```rust
// tests/api/health_test.rs
#[tokio::test]
async fn test_health_endpoint() {
    // Implementation
}
```

2. **test_metadata.sh** → NLP pipeline tests
```rust
// tests/integration/nlp_pipeline_test.rs
#[tokio::test]
async fn test_metadata_extraction() {
    // Implementation
}
```

3. **test_star_archive.sh** → Note status tests
```rust
// tests/api/note_status_test.rs
#[tokio::test]
async fn test_star_archive_functionality() {
    // Implementation
}
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Run tests
      run: |
        cd server
        cargo test --all-features
      env:
        TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432
    
    - name: Generate coverage
      run: |
        cargo install cargo-tarpaulin
        cargo tarpaulin --out Xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        cd ui
        npm ci
    
    - name: Run unit tests
      run: |
        cd ui
        npm run test:coverage
    
    - name: Run E2E tests
      run: |
        cd ui
        npx playwright install
        npm run test:e2e
```

## Test Data Management

### Fixtures
```rust
// tests/common/fixtures.rs
use fake::{Fake, Faker};
use uuid::Uuid;

pub fn create_test_note() -> CreateNoteRequest {
    CreateNoteRequest {
        content: Faker.fake(),
        format: Some("markdown".to_string()),
        source: Some("test".to_string()),
    }
}

pub fn create_test_user() -> User {
    User {
        id: Uuid::new_v4(),
        username: Faker.fake(),
        created_at: Utc::now(),
    }
}
```

## Performance Testing

### Load Testing with Artillery
```yaml
# tests/load/notes.yml
config:
  target: 'http://localhost:53211'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Create and retrieve notes"
    flow:
      - post:
          url: "/api/v1/notes"
          json:
            content: "{{ $randomString() }}"
          capture:
            - json: "$.note_id"
              as: "noteId"
      - get:
          url: "/api/v1/notes/{{ noteId }}"
```

## Testing Commands

### Backend
```bash
# Run all tests
cargo test

# Run specific test
cargo test test_note_creation

# Run with coverage
cargo tarpaulin --out Html

# Run integration tests only
cargo test --test '*'

# Run with logging
RUST_LOG=debug cargo test -- --nocapture
```

### Frontend
```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test JobQueueIndicator

# Watch mode
npm test -- --watch
```

## Success Metrics

- **Unit Test Coverage**: ≥70% for business logic
- **Integration Test Coverage**: All API endpoints tested
- **E2E Test Coverage**: Critical user journeys
- **Test Execution Time**: <5 minutes for full suite
- **Flakiness Rate**: <1% test failures due to timing
- **Mock Coverage**: All external dependencies mockable