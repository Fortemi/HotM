# HotM — Personal Notes, Interaction, and Analysis

[![Version](https://img.shields.io/badge/version-0.1.1-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%2011-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

HotM is a local-first notes and analysis tool with immutable originals, NLP-powered revisions, and hybrid search. Built with Rust (Axum API) and Tauri (React/TypeScript UI) for Windows 11.

## Key Features
- ✨ **Immutable Originals**: Your content is never modified, only enhanced
- 🤖 **Local NLP**: Ollama-powered revision, summarization, and tagging
- 🔍 **Hybrid Search**: Combines full-text and semantic vector search
- 🔗 **Smart Linking**: Automatic discovery of related notes
- 🏷️ **Auto-tagging**: AI-generated tags and entity extraction
- 🪟 **Windows 11 Native**: Mica/Acrylic effects, system tray, global hotkey (Ctrl+Alt+H)
- 🤝 **MCP Integration**: AI assistant compatible via Model Context Protocol
- 🔒 **Privacy-First**: All data and processing stays local

## Status
- **Current**: v0.1.0 Alpha - Core functionality implemented
- **Architecture**: Rust API server + Tauri desktop app
- **Database**: PostgreSQL/DocumentDB with pgvector
- **NLP**: Ollama integration for local processing
- **Next**: MCP server implementation, authentication, Docker deployment

## Quick Start

### Prerequisites
- Windows 11 (primary) or Linux/macOS (development)
- PostgreSQL 14+ with pgvector extension
- Rust 1.70+ and Node.js 18+
- Ollama (for NLP features)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/hotm.git
cd hotm

# Setup database
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Pull Ollama models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text

# Run server (auto-runs migrations)
cd server
cargo run

# Run UI (separate terminal)
cd ui
npm install
npm run dev
```

### Docker Deployment

```bash
# Run full stack with Docker Compose
docker-compose up -d

# Access at http://localhost:53211
```

## Documentation

📚 **[Complete Documentation](docs/00-index.md)**

### Key Sections
- [Requirements & Specifications](docs/01-requirements/) - Functional and non-functional requirements
- [API Specification](docs/02-specifications/api-specification.md) - REST API reference
- [MCP Tools](docs/02-specifications/mcp-tools-spec.md) - AI assistant integration
- [System Architecture](docs/03-architecture/system-architecture.md) - High-level design
- [NLP Pipeline](docs/03-architecture/nlp-pipeline.md) - Text processing architecture
- [Development Guide](docs/04-implementation/development-guide.md) - Setup and workflow
- [Testing Strategy](docs/04-implementation/testing-strategy.md) - Test approach and coverage
- [Docker Deployment](docs/05-deployment/docker-deployment.md) - Container deployment

## Project Structure

```
hotm/
├── server/          # Rust API server (Axum)
│   ├── src/
│   │   ├── routes/  # API endpoints
│   │   ├── nlp/     # NLP pipeline
│   │   ├── mcp/     # MCP server (planned)
│   │   └── workers/ # Background jobs
│   └── tests/       # Integration tests
├── ui/              # Tauri desktop app
│   ├── src/         # React frontend
│   └── src-tauri/   # Rust backend
├── docs/            # Comprehensive documentation
└── scripts/         # Development utilities
```

## Configuration

Create `.env` file:

```env
# Required
DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev

# Optional
RUST_LOG=hotm_server=info
OLLAMA_URL=http://localhost:11434
OLLAMA_GENERATION_MODEL=gpt-oss:20b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## Development

```bash
# Run tests
cd server && cargo test
cd ui && npm run test

# Format code
cd server && cargo fmt
cd ui && npm run format

# Lint
cd server && cargo clippy
cd ui && npm run lint
```

See [Development Guide](docs/04-implementation/development-guide.md) for detailed instructions.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards in the development guide
4. Write tests for new functionality
5. Ensure all tests pass
6. Submit a Pull Request

## Privacy & Security

- **Local-First**: All data and processing stays on your machine
- **No Telemetry**: Zero external communication without explicit user action
- **Encryption**: Optional Windows DPAPI encryption for data at rest
- **Audit Trail**: All modifications logged for accountability

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/00-index.md)
- 🐛 [Issue Tracker](https://github.com/yourusername/hotm/issues)
- 💬 [Discussions](https://github.com/yourusername/hotm/discussions)

## Acknowledgments

- [Ollama](https://ollama.com) for local LLM inference
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search
- [Tauri](https://tauri.app) for native desktop apps
- [Model Context Protocol](https://modelcontextprotocol.io) for AI integration
