# HotM — Personal Notes, Interaction, and Analysis

[![Version](https://img.shields.io/badge/version-0.2.0-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%2011-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

HotM is a local-first notes and analysis tool with immutable originals, NLP-powered revisions, and hybrid search. Built with unified Rust architecture supporting multiple deployment modes for Windows 11.

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
- **Current**: v0.2.0 Beta - Unified runtime with Windows installer
- **Architecture**: Unified Rust binary with multiple deployment modes
- **Database**: Embedded PostgreSQL with pgvector extension
- **NLP**: Embedded Ollama AI service with model management
- **Installer**: Professional Windows MSI with service management
- **Next**: Windows Store deployment, MCP server enhancements

## Quick Start

### End Users (Desktop Mode)

**Download & Install:**
1. Download `HotM-Setup.msi` from [releases](https://github.com/jmagly/hotm/releases)
2. Run installer: `HotM-Setup.msi /quiet DEPLOYMENT_MODE=desktop`
3. Launch HotM from Start Menu or Desktop
4. Global hotkey: `Ctrl+Alt+H`

### Developers (Linux/WSL)

**Prerequisites:** Rust 1.70+, Node.js 18+, PostgreSQL with pgvector

```bash
# Clone unified runtime branch
git clone -b unified-runtime https://github.com/jmagly/hotm.git
cd hotm

# Setup database
export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run unified binary in server mode (development)
cargo run --bin hotm-unified -- --mode server --config-file dev.toml

# Access web UI at http://localhost:53211
```

### Windows MSI Development Build

```powershell
# Build and test desktop installer (see docs/deployment/desktop-development-guide.md)
.\scripts\build-desktop-msi.ps1 -RunTests
```

## Documentation

📚 **[Complete Documentation](docs/index.md)**

### Key Sections
- [Requirements & Specifications](docs/requirements/) - Functional and non-functional requirements
- [API Specification](docs/specifications/api-specification.md) - REST API reference
- [MCP Tools](docs/specifications/mcp-tools-spec.md) - AI assistant integration
- [System Architecture](docs/architecture/system-architecture.md) - High-level design
- [NLP Pipeline](docs/architecture/nlp-pipeline.md) - Text processing architecture
- [Development Guide](docs/implementation/development-guide.md) - Setup and workflow
- [Testing Strategy](docs/implementation/testing-strategy.md) - Test approach and coverage
- [Docker Deployment](docs/deployment/docker-deployment.md) - Container deployment

## Project Structure

```
hotm/
├── hotm-core/           # Shared business logic library
├── hotm-server/         # HTTP server implementation
├── hotm-desktop/        # Desktop GUI implementation
├── hotm-unified/        # Unified runtime binary
├── installer/           # Windows MSI installer (WiX)
│   ├── hotm-installer.wxs
│   ├── hotm-postgresql.wxs
│   └── custom-actions/
├── tests/               # Comprehensive test suite
│   └── installer/       # Installer validation tests
├── scripts/             # Build and deployment scripts
├── ui/                  # React/TypeScript frontend
└── docs/                # Architecture and deployment docs
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

See [Development Guide](docs/implementation/development-guide.md) for detailed instructions.

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

- 📖 [Documentation](docs/index.md)
- 🐛 [Issue Tracker](https://github.com/yourusername/hotm/issues)
- 💬 [Discussions](https://github.com/yourusername/hotm/discussions)

## Acknowledgments

- [Ollama](https://ollama.com) for local LLM inference
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search
- [Tauri](https://tauri.app) for native desktop apps
- [Model Context Protocol](https://modelcontextprotocol.io) for AI integration
