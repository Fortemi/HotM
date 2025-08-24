# System Constraints

## Technical Constraints

### Platform Constraints
- **Operating System**: Windows 11 (22H2+) required
- **Architecture**: x64 or ARM64 only
- **WebView2**: Must be installed for UI rendering
- **Display**: Minimum 1280x720 resolution

### Database Constraints
- **PostgreSQL Version**: 14.0+ required
- **Extensions Required**: 
  - `vector` extension for pgvector
  - `pg_trgm` optional for fuzzy search
- **DocumentDB Compatibility**: Must support PostgreSQL wire protocol
- **Connection**: Direct TCP connection required (no proxy)

### Runtime Dependencies
- **Ollama**: Required for NLP features
  - Models: `gpt-oss:20b`, `nomic-embed-text`
  - Minimum 16GB RAM for model loading
  - CUDA/ROCm optional for GPU acceleration
- **Network**: Localhost access for Ollama API

### Development Constraints
- **Rust**: 1.70+ with stable toolchain
- **Node.js**: 18 LTS for UI development
- **Build Tools**: Visual Studio C++ Build Tools on Windows

## Business Constraints

### Licensing
- **Open Source**: MIT or Apache 2.0 license
- **Dependencies**: Must use compatible licenses
- **Commercial Use**: No restrictions

### Budget
- **Development**: Self-funded/community driven
- **Infrastructure**: User provides own hardware
- **Third-party Services**: None required

### Timeline
- **v0.1.0 Alpha**: Core functionality (Q1 2025)
- **v0.2.0 Beta**: MCP integration (Q2 2025)
- **v1.0.0 Release**: Production ready (Q4 2025)

## Design Constraints

### Architectural Patterns
- **SOLID Principles**: Required for all components
- **Separation of Concerns**: UI, API, and NLP layers
- **Dependency Injection**: For testability
- **Event-Driven**: Background job processing

### Data Model
- **Immutable Originals**: Never modify source content
- **Event Sourcing**: Track all revisions
- **JSONB Storage**: For flexible schema evolution
- **UTC Timestamps**: All dates stored in UTC

### API Design
- **RESTful**: Follow REST conventions
- **Versioning**: URL path versioning (/api/v1)
- **OpenAPI**: Document all endpoints
- **Idempotency**: Safe retry semantics

## Operational Constraints

### Deployment
- **Local-First**: Must work without internet
- **Single Binary**: Server as standalone executable
- **MSI Installer**: Windows deployment via Tauri
- **No Admin Rights**: Run in user space

### Performance
- **Startup Time**: < 5 seconds
- **Memory Limit**: < 2GB without models
- **Disk Usage**: < 100MB base installation
- **Database Size**: Support up to 100GB

### Maintenance
- **Backward Compatibility**: Preserve data format
- **Migration Path**: Automated schema updates
- **Logging**: Configurable log levels
- **Diagnostics**: Built-in health checks

## Security Constraints

### Data Protection
- **Local Storage**: No cloud dependency
- **Encryption**: Optional, user-controlled
- **No Telemetry**: Zero external communication
- **Audit Trail**: Log all data modifications

### Access Control
- **Single User**: Local access by default
- **Network Mode**: Explicit opt-in required
- **API Keys**: For programmatic access
- **Rate Limiting**: Prevent abuse

## Regulatory Constraints

### Privacy
- **GDPR Compliance**: Data portability and deletion
- **No PII Leakage**: Sanitize logs and errors
- **User Consent**: Explicit for any external calls
- **Data Sovereignty**: User controls all data

### Accessibility
- **WCAG 2.1**: Level AA compliance target
- **Keyboard Navigation**: Full functionality
- **Screen Reader**: Compatible markup
- **High Contrast**: Windows theme support

## External Interface Constraints

### API Compatibility
- **HTTP/1.1**: Minimum protocol version
- **JSON**: Primary data format
- **UTF-8**: Character encoding
- **ISO 8601**: Date/time format

### Integration Points
- **Ollama API**: HTTP REST on port 11434
- **PostgreSQL**: Standard wire protocol
- **MCP Server**: JSON-RPC 2.0
- **WebSocket**: For real-time events

## Quality Constraints

### Code Quality
- **Linting**: Must pass clippy/ESLint
- **Formatting**: rustfmt/prettier enforced
- **Documentation**: All public APIs documented
- **Examples**: Usage examples required

### Testing
- **Unit Tests**: Minimum 60% coverage
- **Integration Tests**: API endpoints covered
- **E2E Tests**: Critical user flows
- **Performance Tests**: Baseline metrics

## Future Compatibility

### Extensibility Points
- **Plugin System**: Reserved for future
- **Theme Support**: UI customization
- **Language Packs**: i18n preparation
- **Model Providers**: Abstract LLM interface

### Migration Considerations
- **Data Format**: Version schema changes
- **API Evolution**: Deprecation policy
- **Feature Flags**: Gradual rollout
- **Rollback**: Support downgrade path