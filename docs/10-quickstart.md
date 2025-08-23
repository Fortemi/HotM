# Quick Start Guide

## Prerequisites

### System Requirements
- Windows 11 (primary) or Linux with WSL2
- 8GB RAM minimum (16GB recommended)
- PostgreSQL 16+ with pgvector extension
- Ollama for local LLM inference
- Node.js 20+ and Rust 1.75+

### Required Models
```bash
# Install Ollama models
ollama pull gpt-oss:20b        # For text generation
ollama pull nomic-embed-text   # For embeddings
```

## Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/jmagly/hotm.git
cd hotm
```

### 2. Database Setup
```bash
# Create database with pgvector
psql -U postgres -c "CREATE DATABASE hotm_dev;"
psql -U postgres -d hotm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Set environment variable
export DATABASE_URL="postgresql://postgres:password@localhost:5432/hotm_dev"

# Run migrations
cd server
sqlx migrate run
```

### 3. Backend Setup
```bash
cd server

# Install dependencies and build
cargo build

# Prepare SQLx offline mode
cargo sqlx prepare

# Run development server
RUST_LOG=hotm_server=info,axum=info cargo run
# Server starts on http://localhost:53211
```

### 4. Frontend Setup
```bash
cd ui

# Install dependencies
npm install

# Run development server
npm run dev
# UI starts on http://localhost:5173

# Or build Tauri app
npm run tauri dev
```

## Quick Test

### 1. Health Check
```bash
curl http://localhost:53211/api/v1/health
```

### 2. Create a Note
```bash
curl -X POST http://localhost:53211/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "# Test Note\nThis is a test note for HotM."}'
```

### 3. View in UI
1. Open http://localhost:5173
2. Click on your test note
3. Watch the job queue indicator as AI processing happens
4. View enhanced content in the preview tab
5. Check metadata tab for extracted topics and categories

## Key Features to Try

### Job Queue Monitoring
- Look for the status indicator in the top-right
- Click it to see detailed job progress
- Jobs process sequentially (single GPU constraint)

### AI Enhancement Pipeline
1. **Create Note**: Original content is saved immutably
2. **AI Revision**: Enhanced version with better structure
3. **Embedding**: Semantic search vectors generated
4. **Linking**: Automatic discovery of related notes

### Search Capabilities
- **Hybrid Search**: Combines keyword and semantic search
- **Tag Search**: Use `#tagname` to filter by tags
- **Quick Filters**: Star, archive, and sort options

### Metadata Extraction
- **Categories**: High-level classification
- **Topics**: Specific subjects discussed
- **Entities**: People, organizations, technologies
- **Keywords**: Important terms for linking

## Common Tasks

### Run Tests
```bash
# Backend tests
cd server
cargo test

# Frontend tests
cd ui
npm test
```

### Update Documentation
```bash
# Documentation is in /docs
# Update CLAUDE.md for AI assistant context
```

### Database Operations
```bash
# Create new migration
cd server
sqlx migrate add description_here

# Reset database
sqlx database drop
sqlx database create
sqlx migrate run
```

### Build for Production
```bash
# Backend
cd server
cargo build --release

# Frontend (creates Windows installer)
cd ui
npm run build
```

## Troubleshooting

### Database Connection Issues
```bash
# Verify PostgreSQL is running
pg_isready

# Check pgvector extension
psql -d hotm_dev -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Ollama Connection Issues
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check models are available
ollama list
```

### Port Conflicts
- Backend uses port 53211
- Frontend dev uses port 5173
- Ollama uses port 11434
- PostgreSQL uses port 5432

### SQLx Offline Mode
```bash
# If queries fail, regenerate cache
cd server
rm -rf .sqlx
cargo sqlx prepare
```

## Environment Variables

Create `.env` file in project root:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hotm_dev
RUST_LOG=hotm_server=info,axum=info
OLLAMA_URL=http://localhost:11434
OLLAMA_GENERATION_MODEL=gpt-oss:20b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## Next Steps

1. Review [API Specification v2](02-specifications/api-specification-v2.md)
2. Explore [Testing Framework](09-testing-framework.md)
3. Check [Development Guide](04-implementation/development-guide.md)
4. Read [CLAUDE.md](../CLAUDE.md) for project conventions

## Support

- GitHub Issues: https://github.com/jmagly/hotm/issues
- Documentation: /docs directory
- API Health: http://localhost:53211/api/v1/health