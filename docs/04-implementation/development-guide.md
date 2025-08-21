# Development Guide

## Prerequisites

### Required Software
- **Rust**: 1.70+ (stable toolchain)
- **Node.js**: 18 LTS or later
- **PostgreSQL**: 14.0+ with pgvector extension
- **Ollama**: Latest version
- **Git**: For version control

### Windows-Specific
- **Visual Studio Build Tools**: C++ workload
- **WebView2**: Runtime (auto-installed by Tauri)

### Development Tools
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install development tools
cargo install cargo-watch
cargo install sqlx-cli
cargo install cargo-expand

# Node tools
npm install -g pnpm
```

## Project Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/hotm.git
cd hotm
```

### 2. Database Setup
```bash
# Create database
createdb hotm_dev

# Set environment variable
export DATABASE_URL="postgres://user:pass@localhost:5432/hotm_dev"

# Enable extensions
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Run migrations
cd server
sqlx migrate run
```

### 3. Ollama Setup
```bash
# Install Ollama (Windows - use installer from ollama.com)
# Linux/WSL:
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve

# Pull required models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text
```

### 4. Environment Configuration
Create `.env` file in project root:
```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/hotm_test

# Server
RUST_LOG=hotm_server=debug,axum=debug
SERVER_PORT=53211
SERVER_HOST=127.0.0.1

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_GENERATION_MODEL=gpt-oss:20b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Security (for v0.2.0+)
JWT_SECRET=your-secret-key-here
API_KEY_SALT=another-secret-key
```

## Development Workflow

### Running the Server
```bash
cd server

# Development mode with auto-reload
cargo watch -x run

# Or manual run
cargo run

# With specific log level
RUST_LOG=debug cargo run
```

### Running the UI
```bash
cd ui

# Install dependencies
npm install

# Development mode
npm run dev

# The Tauri app will open automatically
```

### Running Tests
```bash
# Server tests
cd server
cargo test
cargo test -- --nocapture  # Show println! output

# Integration tests
cargo test --test '*'

# UI tests
cd ui
npm run test
```

## Code Organization

### Server Structure
```
server/
├── src/
│   ├── main.rs           # Entry point
│   ├── lib.rs            # Library root
│   ├── config.rs         # Configuration
│   ├── db.rs             # Database pool
│   ├── error.rs          # Error types
│   ├── models.rs         # Data models
│   ├── routes/           # API endpoints
│   │   ├── mod.rs
│   │   ├── notes.rs
│   │   ├── search.rs
│   │   └── ...
│   ├── services/         # Business logic
│   │   ├── mod.rs
│   │   ├── note_service.rs
│   │   ├── search_service.rs
│   │   └── ...
│   ├── nlp/              # NLP pipeline
│   │   ├── mod.rs
│   │   ├── pipeline.rs
│   │   ├── stages/
│   │   └── ollama.rs
│   ├── mcp/              # MCP server
│   │   ├── mod.rs
│   │   ├── server.rs
│   │   └── tools/
│   └── workers/          # Background jobs
│       ├── mod.rs
│       ├── pool.rs
│       └── jobs/
```

### UI Structure
```
ui/
├── src/
│   ├── main.tsx          # Entry point
│   ├── ui/
│   │   ├── App.tsx       # Main component
│   │   ├── components/   # Reusable components
│   │   ├── hooks/        # Custom hooks
│   │   └── utils/        # Utilities
│   └── api/              # API client
├── src-tauri/            # Tauri backend
│   ├── src/
│   │   └── main.rs       # Tauri entry
│   └── tauri.conf.json   # Tauri config
```

## Coding Standards

### Rust Conventions
```rust
// Use descriptive names
pub struct NoteRepository {
    pool: Arc<PgPool>,
}

// Implement traits for abstraction
impl Repository for NoteRepository {
    type Entity = Note;
    type Id = Uuid;
    
    async fn find_by_id(&self, id: Self::Id) -> Result<Option<Self::Entity>> {
        // Implementation
    }
}

// Use Result for fallible operations
pub async fn process_note(id: Uuid) -> Result<ProcessedNote, ProcessingError> {
    // Implementation
}

// Document public APIs
/// Creates a new note with the given content.
/// 
/// # Arguments
/// * `content` - The note content
/// 
/// # Returns
/// The created note ID
pub async fn create_note(content: String) -> Result<Uuid> {
    // Implementation
}
```

### TypeScript Conventions
```typescript
// Use interfaces for data structures
interface Note {
  id: string;
  content: string;
  createdAt: string;
}

// Use type for unions/aliases
type ViewMode = 'original' | 'revised' | 'provenance';

// Prefer const assertions
const API_ENDPOINTS = {
  notes: '/api/v1/notes',
  search: '/api/v1/search',
} as const;

// Use async/await
async function fetchNote(id: string): Promise<Note> {
  const response = await fetch(`${API_BASE}/notes/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch note: ${response.statusText}`);
  }
  return response.json();
}
```

## SOLID Principles Implementation

### Single Responsibility
```rust
// Good: Each service has one responsibility
pub struct NoteService {
    repository: Arc<dyn NoteRepository>,
}

pub struct SearchService {
    searcher: Arc<dyn Searcher>,
}

// Bad: Mixed responsibilities
pub struct NoteManager {
    // Does everything - creates, searches, processes...
}
```

### Open/Closed
```rust
// Define trait for extension
pub trait PipelineStage: Send + Sync {
    async fn execute(&self, context: &mut PipelineContext) -> Result<()>;
}

// Extend by implementing trait
pub struct CustomStage;
impl PipelineStage for CustomStage {
    // Custom implementation
}
```

### Liskov Substitution
```rust
// Base trait
pub trait Storage {
    async fn save(&self, data: &[u8]) -> Result<String>;
    async fn load(&self, id: &str) -> Result<Vec<u8>>;
}

// Implementations are interchangeable
pub struct FileStorage;
pub struct S3Storage;
pub struct DatabaseStorage;
```

### Interface Segregation
```rust
// Specific interfaces
pub trait Readable {
    async fn read(&self, id: Uuid) -> Result<Note>;
}

pub trait Writable {
    async fn write(&self, note: Note) -> Result<()>;
}

// Compose as needed
impl Readable for NoteRepository { }
impl Writable for NoteRepository { }
```

### Dependency Inversion
```rust
// Depend on abstractions
pub struct NoteService {
    repository: Arc<dyn Repository>,  // Interface, not concrete
    cache: Arc<dyn Cache>,
}

// Inject dependencies
impl NoteService {
    pub fn new(repository: Arc<dyn Repository>, cache: Arc<dyn Cache>) -> Self {
        Self { repository, cache }
    }
}
```

## Testing Patterns

### Unit Testing
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::mock;
    
    mock! {
        Repository {}
        
        impl Repository for Repository {
            async fn find_by_id(&self, id: Uuid) -> Result<Option<Note>>;
        }
    }
    
    #[tokio::test]
    async fn test_get_note() {
        let mut mock_repo = MockRepository::new();
        mock_repo
            .expect_find_by_id()
            .returning(|_| Ok(Some(Note::default())));
        
        let service = NoteService::new(Arc::new(mock_repo));
        let result = service.get_note(Uuid::new_v4()).await;
        
        assert!(result.is_ok());
    }
}
```

### Integration Testing
```rust
// tests/integration.rs
use hotm_server::test_helpers::*;

#[tokio::test]
async fn test_create_and_retrieve_note() {
    let app = setup_test_app().await;
    
    // Create note
    let response = app
        .post("/api/v1/notes")
        .json(&json!({ "content": "Test note" }))
        .send()
        .await;
    
    assert_eq!(response.status(), 201);
    
    let body: CreateNoteResponse = response.json().await;
    
    // Retrieve note
    let response = app
        .get(&format!("/api/v1/notes/{}", body.note_id))
        .send()
        .await;
    
    assert_eq!(response.status(), 200);
}
```

## Debugging

### Server Debugging
```bash
# Enable debug logging
RUST_LOG=debug cargo run

# Use debugger (VS Code)
# Install CodeLLDB extension
# Add launch.json configuration

# Print debugging
dbg!(&variable);
println!("Debug: {:?}", variable);
```

### UI Debugging
```javascript
// Browser DevTools
console.log('Debug:', data);
console.table(arrayData);
debugger; // Breakpoint

// React DevTools
// Install browser extension for component inspection
```

### Database Debugging
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM notes
WHERE tsv @@ plainto_tsquery('search term');

-- Monitor active queries
SELECT pid, query, state
FROM pg_stat_activity
WHERE state != 'idle';
```

## Performance Profiling

### Rust Profiling
```bash
# CPU profiling with flamegraph
cargo install flamegraph
cargo flamegraph --bin hotm-server

# Memory profiling
cargo install cargo-instruments
cargo instruments --template 'Allocations'
```

### Database Profiling
```sql
-- Enable query timing
\timing on

-- Analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Common Issues

### Issue: Database connection errors
```bash
# Solution: Check PostgreSQL is running
pg_isready

# Check connection string
psql $DATABASE_URL -c "SELECT 1"
```

### Issue: Ollama not responding
```bash
# Solution: Check Ollama service
curl http://localhost:11434/api/tags

# Restart Ollama
systemctl restart ollama  # Linux
# Or restart from system tray on Windows
```

### Issue: Build errors
```bash
# Solution: Clear cache and rebuild
cargo clean
cargo build

# Update dependencies
cargo update
```

## Git Workflow

### Branch Strategy
```bash
# Feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature
```

### Commit Convention
```
type(scope): description

feat: New feature
fix: Bug fix
docs: Documentation
style: Formatting
refactor: Code restructuring
test: Tests
chore: Maintenance
```

## Resources

### Documentation
- [Rust Book](https://doc.rust-lang.org/book/)
- [Axum Docs](https://docs.rs/axum/)
- [Tauri Guides](https://tauri.app/guides/)
- [React Docs](https://react.dev/)

### Tools
- [SQLx CLI](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli)
- [cargo-watch](https://github.com/watchexec/cargo-watch)
- [Postman](https://www.postman.com/) - API testing
- [TablePlus](https://tableplus.com/) - Database GUI