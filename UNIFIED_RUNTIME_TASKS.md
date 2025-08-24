# Unified Rust Runtime Refactor - Task Breakdown

This document provides detailed task breakdowns for implementing the unified Rust runtime refactor based on comprehensive technical research by the tech-lead and ui-engineer agents.

## Implementation Overview

**Architecture**: Cargo workspace with 4 components (hotm-core, hotm-server, hotm-desktop, hotm-unified)  
**Timeline**: 4 phases, 1-2 weeks each  
**Team Structure**: Senior Rust devs, Frontend devs, Junior devs, DevOps specialists  
**Delivery**: Incremental with maintained functionality  

## Phase 1: Foundation & Core Abstraction (Week 1-2)

### P1.1: Workspace Structure Setup
**Description**: Create Cargo workspace root and initial component structure  
**Prerequisites**: Current codebase understanding, Git workflow  
**Dependencies**: None  
**Skill Level**: Mid  
**Risk Level**: Low  
**Estimated Effort**: 4-6 hours  

**Acceptance Criteria**:
- [ ] Cargo.toml workspace file created with 4 members
- [ ] Directory structure: hotm-core/, hotm-server/, hotm-desktop/, hotm-unified/
- [ ] Each component has basic Cargo.toml with proper dependencies
- [ ] Workspace builds successfully with `cargo build`
- [ ] CI/CD updated to handle workspace structure

**Tasks**:
1. Create workspace Cargo.toml
2. Setup component directories with stub Cargo.toml files
3. Update .github/workflows/ for workspace builds
4. Update scripts to handle workspace structure

---

### P1.2: Core Domain Models
**Description**: Extract shared domain models and business logic into hotm-core  
**Prerequisites**: Understanding of current data models  
**Dependencies**: P1.1 (Workspace Structure)  
**Skill Level**: Senior  
**Risk Level**: Medium  
**Estimated Effort**: 12-16 hours  

**Acceptance Criteria**:
- [ ] Note, Tag, Collection models moved to hotm-core/src/models/
- [ ] Search, analytics types abstracted
- [ ] Database schema types (no DB-specific code)
- [ ] Error types with proper propagation
- [ ] All models have comprehensive tests (80%+ coverage)
- [ ] Documentation for all public APIs

**Tasks**:
1. Create hotm-core/src/models/ with Note, Tag, Collection
2. Abstract search and analytics domain types
3. Design error hierarchy for cross-component use
4. Write unit tests for all domain logic
5. Generate API documentation

**Blocking**: P1.3, P1.4, P1.5 (all need core models)

---

### P1.3: Database Abstraction Layer
**Description**: Create DatabaseProvider trait with PostgreSQL implementation  
**Prerequisites**: SQLx experience, async Rust  
**Dependencies**: P1.2 (Core Models)  
**Skill Level**: Senior  
**Risk Level**: High  
**Estimated Effort**: 16-20 hours  

**Acceptance Criteria**:
- [ ] DatabaseProvider trait with full CRUD operations
- [ ] PostgresProvider implementation with existing functionality
- [ ] Connection pooling abstracted
- [ ] Transaction support maintained
- [ ] Migration system works with abstraction
- [ ] All existing database tests pass
- [ ] Performance benchmarks show no regression

**Tasks**:
1. Design DatabaseProvider trait interface
2. Implement PostgresProvider with SQLx
3. Abstract connection pool management
4. Ensure transaction support works
5. Run performance tests vs current implementation
6. Update all database tests to use abstraction

**Blocking**: P2.1, P2.2 (server components need DB abstraction)

---

### P1.4: Ollama Service Abstraction
**Description**: Create OllamaProvider trait for NLP operations  
**Prerequisites**: Understanding of current Ollama integration  
**Dependencies**: P1.2 (Core Models)  
**Skill Level**: Mid-Senior  
**Risk Level**: Medium  
**Estimated Effort**: 8-12 hours  

**Acceptance Criteria**:
- [ ] OllamaProvider trait with generation and embedding methods
- [ ] HTTP client implementation preserved
- [ ] Error handling for network failures
- [ ] Model management abstracted
- [ ] All NLP pipeline tests pass
- [ ] Mock implementation for testing

**Tasks**:
1. Define OllamaProvider trait interface
2. Extract HTTP client logic from server
3. Create mock provider for tests
4. Ensure all NLP functionality works
5. Add integration tests with real Ollama

**Blocking**: P2.1, P2.3 (NLP processing in server)

---

### P1.5: EventBus System
**Description**: Implement event-driven communication between components  
**Prerequisites**: Async Rust, pub-sub patterns  
**Dependencies**: P1.2 (Core Models)  
**Skill Level**: Senior  
**Risk Level**: Medium  
**Estimated Effort**: 10-14 hours  

**Acceptance Criteria**:
- [ ] EventBus trait with pub/sub interface
- [ ] In-memory implementation for single process
- [ ] Event types for all major operations (notes, search, etc.)
- [ ] Async event handling with proper error propagation
- [ ] Event replay capability for debugging
- [ ] Performance tests show low overhead

**Tasks**:
1. Design EventBus trait and event types
2. Implement in-memory EventBus
3. Create event types for all domain operations
4. Add event replay for debugging
5. Performance test event throughput
6. Integration tests for event flow

**Blocking**: P2.4, P3.1 (desktop and unified need events)

---

### P1.6: Configuration System
**Description**: Unified configuration management across all components  
**Prerequisites**: Serde, environment variable handling  
**Dependencies**: P1.1 (Workspace Structure)  
**Skill Level**: Mid  
**Risk Level**: Low  
**Estimated Effort**: 6-8 hours  

**Acceptance Criteria**:
- [ ] Unified Config struct in hotm-core
- [ ] Environment variable loading with defaults
- [ ] File-based configuration support
- [ ] Validation for all config values
- [ ] Component-specific config sections
- [ ] Configuration documentation

**Tasks**:
1. Create Config struct with all settings
2. Implement environment and file loading
3. Add validation for database URLs, ports, etc.
4. Create config documentation
5. Update all components to use unified config

**Blocking**: P2.1, P2.2, P2.4 (all components need config)

---

## Phase 2: Server Component Migration (Week 3-4)

### P2.1: Server Core Migration
**Description**: Migrate existing Axum server to use hotm-core abstractions  
**Prerequisites**: Current server codebase understanding  
**Dependencies**: P1.3 (Database), P1.4 (Ollama), P1.6 (Config)  
**Skill Level**: Senior  
**Risk Level**: High  
**Estimated Effort**: 20-24 hours  

**Acceptance Criteria**:
- [ ] All existing API endpoints work identically
- [ ] Uses DatabaseProvider instead of direct SQLx
- [ ] Uses OllamaProvider for NLP operations
- [ ] All integration tests pass
- [ ] WebSocket functionality preserved
- [ ] MCP server functionality preserved
- [ ] Performance benchmarks match current server

**Tasks**:
1. Update dependency injection to use providers
2. Migrate all route handlers to use abstractions
3. Ensure WebSocket events work with EventBus
4. Update MCP server integration
5. Run full integration test suite
6. Performance testing vs current server

**Blocking**: P2.2, P3.2 (other server features need this)

---

### P2.2: API Transport Layer
**Description**: Create ApiTransport trait for flexible API communication  
**Prerequisites**: HTTP client experience, trait design  
**Dependencies**: P2.1 (Server Core), P1.2 (Core Models)  
**Skill Level**: Mid-Senior  
**Risk Level**: Medium  
**Estimated Effort**: 8-12 hours  

**Acceptance Criteria**:
- [ ] ApiTransport trait with all API operations
- [ ] HTTP implementation using reqwest
- [ ] Error handling for network failures
- [ ] Authentication support (API keys)
- [ ] All existing API functionality accessible
- [ ] Mock implementation for testing

**Tasks**:
1. Design ApiTransport trait interface
2. Implement HTTP transport with reqwest
3. Add authentication handling
4. Create mock transport for tests
5. Ensure all API operations work
6. Integration tests with real server

**Blocking**: P2.4, P3.1 (desktop needs API transport)

---

### P2.3: Enhanced WebSocket System
**Description**: Improve WebSocket handling with EventBus integration  
**Prerequisites**: WebSocket experience, current WS implementation  
**Dependencies**: P1.5 (EventBus), P2.1 (Server Core)  
**Skill Level**: Senior  
**Risk Level**: Medium  
**Estimated Effort**: 10-14 hours  

**Acceptance Criteria**:
- [ ] WebSocket events integrate with EventBus
- [ ] Real-time note updates work seamlessly
- [ ] Connection management improved
- [ ] Event replay for missed messages
- [ ] All existing WebSocket tests pass
- [ ] Load testing shows improved performance

**Tasks**:
1. Integrate WebSocket handlers with EventBus
2. Implement event replay for reconnections
3. Improve connection lifecycle management
4. Add load testing for WebSocket performance
5. Update client-side WebSocket handling

**Blocking**: P3.1, P3.2 (desktop and unified need WS)

---

### P2.4: MCP Server Enhancement
**Description**: Enhance MCP server with new abstractions  
**Prerequisites**: Current MCP implementation understanding  
**Dependencies**: P2.1 (Server Core), P1.5 (EventBus)  
**Skill Level**: Mid-Senior  
**Risk Level**: Low  
**Estimated Effort**: 6-10 hours  

**Acceptance Criteria**:
- [ ] MCP server uses provider abstractions
- [ ] All existing MCP tools work identically
- [ ] Event-driven MCP operations
- [ ] Improved error handling
- [ ] All MCP integration tests pass
- [ ] Documentation updated

**Tasks**:
1. Update MCP handlers to use providers
2. Integrate with EventBus for real-time updates
3. Improve error messages and handling
4. Run all MCP integration tests
5. Update MCP documentation

**Blocking**: None (enhancement only)

---

## Phase 3: Desktop Migration & Web Interface (Week 5-6)

### P3.1: Desktop Component Architecture
**Description**: Migrate Tauri desktop to unified architecture  
**Prerequisites**: Tauri experience, current desktop understanding  
**Dependencies**: P2.2 (API Transport), P1.5 (EventBus), P1.6 (Config)  
**Skill Level**: Senior  
**Risk Level**: High  
**Estimated Effort**: 18-22 hours  

**Acceptance Criteria**:
- [ ] Desktop app uses ApiTransport for server communication
- [ ] Local mode uses direct provider access
- [ ] Network mode uses HTTP transport
- [ ] All existing desktop functionality preserved
- [ ] Global hotkey and tray functionality work
- [ ] MSI installer builds successfully
- [ ] All desktop E2E tests pass

**Tasks**:
1. Implement mode switching (local vs network)
2. Use ApiTransport for all server communication
3. Preserve Tauri-specific functionality
4. Update build process for new structure
5. Run full E2E test suite
6. Test MSI installer with new architecture

**Blocking**: P3.3 (unified component needs desktop)

---

### P3.2: Web Interface Foundation
**Description**: Create Leptos-based web interface foundation  
**Prerequisites**: Leptos framework knowledge, WASM experience  
**Dependencies**: P2.2 (API Transport), P1.2 (Core Models)  
**Skill Level**: Mid-Senior (Frontend + Rust)  
**Risk Level**: Medium  
**Estimated Effort**: 16-20 hours  

**Acceptance Criteria**:
- [ ] Basic Leptos app structure created
- [ ] Authentication flow implemented
- [ ] Note list and detail views functional
- [ ] Search interface working
- [ ] Responsive design for mobile/desktop
- [ ] WebSocket integration for real-time updates
- [ ] WASM build optimized for size

**Tasks**:
1. Setup Leptos project structure
2. Implement authentication UI and flow
3. Create core note management views
4. Build search interface
5. Add WebSocket client for real-time updates
6. Optimize WASM bundle size
7. Responsive CSS for all screen sizes

**Blocking**: P3.3 (unified needs web interface)

---

### P3.3: Advanced Web Features
**Description**: Implement advanced web interface features  
**Prerequisites**: JavaScript interop, advanced Leptos  
**Dependencies**: P3.2 (Web Foundation)  
**Skill Level**: Senior (Frontend + Rust)  
**Risk Level**: Medium  
**Estimated Effort**: 12-16 hours  

**Acceptance Criteria**:
- [ ] Rich text editing functionality
- [ ] Drag-and-drop file uploads
- [ ] Advanced search with filters
- [ ] Tag and collection management UI
- [ ] Export functionality
- [ ] Keyboard shortcuts
- [ ] Offline capability with service worker

**Tasks**:
1. Integrate rich text editor (TinyMCE or similar)
2. Implement drag-and-drop file handling
3. Build advanced search UI with filters
4. Create tag and collection management
5. Add export functionality (PDF, Markdown)
6. Implement keyboard shortcuts
7. Create service worker for offline usage

**Blocking**: P4.1 (unified component needs advanced features)

---

## Phase 4: Unified Runtime & Production (Week 7-8)

### P4.1: Unified Runtime Integration
**Description**: Combine all components into unified hotm runtime  
**Prerequisites**: All previous phases completed  
**Dependencies**: P3.1 (Desktop), P3.2 (Web), P2.1 (Server)  
**Skill Level**: Senior  
**Risk Level**: High  
**Estimated Effort**: 16-20 hours  

**Acceptance Criteria**:
- [ ] Single binary with mode selection (server/desktop/unified)
- [ ] Feature flags control component inclusion
- [ ] Configuration system handles all modes
- [ ] Performance matches specialized builds
- [ ] All integration tests pass in unified mode
- [ ] Binary size optimized with feature gates

**Tasks**:
1. Create unified main.rs with mode selection
2. Implement feature flags for components
3. Ensure proper dependency management
4. Performance test against individual binaries
5. Run full integration test suite
6. Optimize binary size with conditional compilation

**Blocking**: P4.2, P4.3 (deployment needs unified runtime)

---

### P4.2: Migration Tooling
**Description**: Create tools for migrating from current to unified architecture  
**Prerequisites**: Database migration experience  
**Dependencies**: P4.1 (Unified Runtime), P1.3 (Database Abstraction)  
**Skill Level**: Mid-Senior  
**Risk Level**: Medium  
**Estimated Effort**: 10-14 hours  

**Acceptance Criteria**:
- [ ] Data migration script for database changes
- [ ] Configuration migration tool
- [ ] Desktop app settings migration
- [ ] Backup and rollback procedures
- [ ] Migration validation tools
- [ ] Comprehensive migration documentation

**Tasks**:
1. Create database migration scripts
2. Build configuration migration tool
3. Handle desktop app settings migration
4. Implement backup/restore functionality
5. Create migration validation scripts
6. Write detailed migration guide

**Blocking**: P4.4 (production deployment needs migration)

---

### P4.3: Production Configuration
**Description**: Setup production configurations and deployment options  
**Prerequisites**: DevOps experience, containerization  
**Dependencies**: P4.1 (Unified Runtime), P1.6 (Configuration)  
**Skill Level**: Mid-Senior (DevOps)  
**Risk Level**: Medium  
**Estimated Effort**: 12-16 hours  

**Acceptance Criteria**:
- [ ] Docker configurations for all deployment modes
- [ ] Kubernetes manifests for cloud deployment
- [ ] Windows Service configuration updated
- [ ] Environment-specific config templates
- [ ] Health check endpoints for all modes
- [ ] Monitoring and logging configuration

**Tasks**:
1. Create Docker images for each mode
2. Write Kubernetes deployment manifests
3. Update Windows Service installation
4. Create config templates for different environments
5. Implement health checks and metrics
6. Setup logging and monitoring configuration

**Blocking**: P4.4 (deployment needs production configs)

---

### P4.4: Integration Testing & Documentation
**Description**: Comprehensive testing and documentation for production readiness  
**Prerequisites**: Testing framework knowledge  
**Dependencies**: P4.1 (Unified), P4.2 (Migration), P4.3 (Production)  
**Skill Level**: Mid  
**Risk Level**: Low  
**Estimated Effort**: 14-18 hours  

**Acceptance Criteria**:
- [ ] Full integration test suite for unified runtime
- [ ] Performance benchmarks vs current system
- [ ] Load testing for all deployment modes
- [ ] Security audit of new architecture
- [ ] Complete API documentation
- [ ] Deployment guide for all scenarios
- [ ] Troubleshooting guide

**Tasks**:
1. Create comprehensive integration test suite
2. Run performance benchmarks and comparisons
3. Load test all deployment configurations
4. Conduct security review of new architecture
5. Generate complete API documentation
6. Write deployment and troubleshooting guides
7. Create migration playbook

**Blocking**: None (final deliverable)

---

## Team Assignment Strategy

### Senior Rust Developers
- **Primary**: P1.3 (Database), P1.5 (EventBus), P2.1 (Server Migration), P3.1 (Desktop), P4.1 (Unified)
- **Secondary**: P1.4 (Ollama), P2.3 (WebSocket), P3.2 (Web Foundation)

### Frontend Developers (React/TypeScript + Rust Learning)
- **Primary**: P3.2 (Web Foundation), P3.3 (Advanced Web), P1.6 (Configuration)
- **Secondary**: P3.1 (Desktop Migration - Tauri parts), P2.4 (MCP Enhancement)

### Mid-Level Developers
- **Primary**: P1.2 (Core Models), P2.2 (API Transport), P4.2 (Migration Tools)
- **Secondary**: P1.1 (Workspace), P1.6 (Configuration), P2.4 (MCP)

### DevOps/Deployment Specialists
- **Primary**: P4.3 (Production Config), P4.4 (Testing & Docs)
- **Secondary**: P1.1 (Workspace CI/CD), P4.2 (Migration Tools)

### Junior Developers
- **Primary**: P1.1 (Workspace Setup), P1.6 (Configuration), P4.4 (Documentation)
- **Secondary**: Testing tasks across all phases, documentation updates

---

## Risk Mitigation

### High Risk Tasks
- **P1.3 (Database Abstraction)**: Create PostgreSQL implementation first, extensive testing
- **P2.1 (Server Migration)**: Incremental migration with feature flags
- **P3.1 (Desktop Migration)**: Maintain current Tauri app in parallel during migration
- **P4.1 (Unified Runtime)**: Thorough integration testing before production

### Parallel Work Streams
1. **Phase 1**: P1.1, P1.2, P1.6 can run in parallel
2. **Phase 1-2 Overlap**: P1.4, P1.5 can start while P2.1 is in progress
3. **Phase 2-3 Overlap**: P2.3, P2.4 can run while P3.2 starts
4. **Phase 3-4 Overlap**: P3.3 can run while P4.1 begins

### Quality Gates
- All phases require passing integration tests before proceeding
- Performance benchmarks must match or exceed current system
- Security review required before P4.4 completion
- Migration testing required before production deployment

## Success Metrics

1. **Functionality**: All existing features work identically
2. **Performance**: No regression in API response times or throughput
3. **Reliability**: Integration test suite maintains >95% pass rate
4. **Maintainability**: Reduced code duplication by >40%
5. **Deployment**: All deployment scenarios work without manual intervention
6. **Team Velocity**: Development speed increases after 4-week adjustment period