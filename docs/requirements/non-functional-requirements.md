# Non-Functional Requirements

## Performance Requirements

### Response Times
- **Note Creation**: < 100ms to save original
- **Search Results**: < 500ms for up to 100k notes
- **UI Responsiveness**: < 50ms for user interactions
- **NLP Processing**: < 5s for revision generation (async)
- **Embedding Generation**: < 2s per note chunk
- **API Response**: < 200ms for simple queries

### Throughput
- **Concurrent Users**: 1 (local) or 10 (network deployment)
- **Notes per Second**: 10 write, 100 read
- **Search Queries**: 50 per second
- **Background Jobs**: 20 concurrent NLP tasks

### Resource Usage
- **Memory**: < 500MB base, < 2GB with models loaded
- **CPU**: < 10% idle, < 50% during NLP processing
- **Disk**: < 100MB base install, ~10KB per note
- **Network**: Local-only by default, < 10Mbps for Ollama

## Reliability Requirements

### Availability
- **Target Uptime**: 99.9% for local instance
- **Graceful Degradation**: System remains functional without:
  - Ollama (no NLP features)
  - Network (local-only mode)
  - Vector extension (no semantic search)

### Data Integrity
- **ACID Compliance**: All database operations
- **Immutable Originals**: Write-once guarantee
- **Backup Support**: Standard PostgreSQL backup tools
- **Data Validation**: Input sanitization and type checking

### Error Handling
- **Graceful Failures**: No data loss on crash
- **Error Reporting**: Structured logging with levels
- **Recovery**: Automatic retry for transient failures
- **User Feedback**: Clear error messages

## Security Requirements

### Authentication & Authorization
- **Admin Interface**: Username/password for web UI
- **API Access**: Bearer token authentication
- **API Key Management**: Generate, revoke, rotate keys
- **Rate Limiting**: 100 requests/minute per key

### Data Protection
- **Encryption at Rest**: Optional via Windows DPAPI
- **Encryption in Transit**: TLS 1.3 for network mode
- **Input Validation**: Prevent SQL injection, XSS
- **Audit Logging**: Track all data modifications

### Privacy
- **Local-First**: No telemetry or external calls
- **Data Isolation**: User data remains on device
- **Secure Deletion**: Overwrite sensitive data
- **GDPR Compliance**: Data export and deletion

## Usability Requirements

### User Interface
- **Windows 11 Native**: Mica/Acrylic effects, rounded corners
- **Keyboard Navigation**: Full keyboard support
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Responsive Design**: Adapt to window resizing

### User Experience
- **Learning Curve**: < 5 minutes to basic proficiency
- **Error Messages**: Clear, actionable guidance
- **Help System**: In-app documentation
- **Undo/Redo**: For user-initiated changes

## Compatibility Requirements

### Platform Support
- **Primary**: Windows 11 (version 22H2+)
- **Architecture**: x64, ARM64
- **WebView2**: Required for UI
- **.NET Runtime**: Not required (native)

### Database Compatibility
- **PostgreSQL**: 14.0+ with extensions
- **DocumentDB**: Azure Cosmos DB for PostgreSQL
- **pgvector**: 0.5.0+ for embeddings
- **Required Extensions**: vector, pg_trgm (optional)

### Integration Compatibility
- **Ollama**: 0.1.0+ with REST API
- **MCP Protocol**: 1.0 specification
- **OpenAPI**: 3.0 specification
- **WebSocket**: RFC 6455

## Scalability Requirements

### Vertical Scaling
- **Notes**: Support 1M+ notes per instance
- **Collections**: 1000+ collections
- **Tags**: 10,000+ unique tags
- **Embeddings**: 10M+ vectors

### Horizontal Scaling (Future)
- **Multi-User**: Database connection pooling
- **Load Balancing**: Stateless API design
- **Caching**: Redis for frequent queries
- **Queue**: Background job distribution

## Maintainability Requirements

### Code Quality
- **Test Coverage**: 60-80% target
- **Documentation**: Inline comments, API docs
- **Code Standards**: Rust clippy, ESLint
- **Modularity**: SOLID principles

### Monitoring
- **Health Checks**: `/health` endpoint
- **Metrics**: Response times, error rates
- **Logging**: Structured JSON logs
- **Debugging**: Source maps, debug symbols

### Deployment
- **Installation**: One-click MSI installer
- **Updates**: Automatic update checks
- **Configuration**: Environment variables, JSON config
- **Backup**: Database export scripts

## Compliance Requirements

### Standards
- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **OpenAPI**: 3.0 specification
- **MCP**: Model Context Protocol 1.0
- **REST**: RESTful API design principles

### Documentation
- **User Manual**: Installation and usage
- **API Documentation**: OpenAPI/Swagger
- **Developer Guide**: Architecture and setup
- **Change Log**: Version history

## Quality Attributes Priority

| Attribute | Priority | Rationale |
|-----------|----------|-----------|
| Reliability | Critical | Data integrity is paramount |
| Performance | High | User experience depends on speed |
| Security | High | Personal knowledge requires protection |
| Usability | High | Target non-technical users |
| Maintainability | Medium | Long-term sustainability |
| Scalability | Low | Single-user focus initially |