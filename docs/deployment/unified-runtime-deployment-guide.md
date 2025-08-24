# HotM Unified Runtime Deployment Guide

## Executive Summary

HotM's unified runtime architecture represents a fundamental shift from the current dual-binary approach (Tauri frontend + Axum server) to a single, adaptable Rust binary capable of operating in multiple deployment modes. This document provides a comprehensive overview of the unified runtime approach and serves as the primary guide for understanding deployment options, configuration, and migration strategies.

## Documentation Overview

This deployment guide consists of several interconnected documents that provide complete coverage of the unified runtime:

### Core Architecture Documents
- **[Unified Runtime Architecture](./unified-runtime-architecture.md)** - Technical architecture, component design, and service abstraction
- **[Deployment Architecture Diagrams](./deployment-architecture-diagrams.md)** - Visual representations of all deployment modes and data flows

### Deployment and Configuration Guides  
- **[Deployment Scenarios](./deployment-scenarios.md)** - Detailed deployment patterns for different use cases and environments
- **[Unified Runtime Configuration](./unified-runtime-configuration.md)** - Complete configuration reference for all deployment modes

### Migration and Security Documentation
- **[Migration and Security Guide](./migration-and-security-guide.md)** - Migration strategies, security considerations, and compliance requirements

## Quick Start by Use Case

### Individual Knowledge Worker
**Recommended**: Enhanced Desktop Mode
```bash
# Download and install unified runtime
curl -L https://github.com/hotm/hotm/releases/download/v0.2.0/HotM-Setup.msi -o HotM-Setup.msi
./HotM-Setup.msi /quiet MODE=DESKTOP

# First run with embedded database and AI
hotm.exe --first-run
```

### Small Team (2-10 people)
**Recommended**: Server Mode with Web UI
```bash
# Docker deployment
curl -L https://github.com/hotm/hotm/releases/download/v0.2.0/docker-compose-server.yml -o docker-compose.yml
docker-compose up -d

# Access web interface at https://localhost:53211/ui
```

### Development Team
**Recommended**: Development Mode
```bash
# Clone and setup development environment
git clone https://github.com/hotm/hotm.git
cd hotm
cargo install --path . --bin hotm

# Start development mode with hot reload
hotm --mode development --hot-reload --config dev-config.toml
```

### Enterprise Deployment
**Recommended**: Cloud-Native Kubernetes
```bash
# Deploy using Helm chart
helm repo add hotm https://hotm.github.io/helm-charts
helm install hotm hotm/hotm --values production-values.yaml
```

## Key Benefits of Unified Runtime

### Simplified Distribution
- **Single Binary**: No more separate desktop and server applications
- **Mode Selection**: Runtime behavior determined by configuration, not separate installations
- **Reduced Complexity**: One codebase, one build process, one deployment pipeline

### Enhanced Capabilities
- **Embedded Services**: SQLite database and lightweight AI models included
- **Hybrid Mode**: Desktop GUI with simultaneous web server capabilities
- **Offline-First**: Full functionality without network dependencies
- **Smart Routing**: Optimal performance for local vs. remote requests

### Operational Advantages
- **Simplified Updates**: Single binary updates across all deployment modes
- **Consistent Behavior**: Same core logic regardless of deployment mode
- **Flexible Migration**: Easy transition between deployment modes without data loss

## Architecture Comparison

### Current Architecture (v0.1.x)
```
┌─────────────────┐    HTTP/WS    ┌─────────────────┐
│  Tauri Desktop  │◄─────────────►│  Axum Server    │
│  React + Rust   │               │  Port 53211     │
└─────────────────┘               └─────────────────┘
                                          │
                                          ▼
                                  ┌─────────────────┐
                                  │   PostgreSQL    │
                                  │   + pgvector    │
                                  └─────────────────┘
```

**Limitations:**
- Requires network layer even for local use
- Complex setup with multiple services
- Separate binary distribution and updates
- No offline capability for desktop clients

### Unified Architecture (v0.2.0+)
```
┌─────────────────────────────────────────────────────────┐
│                   HotM Unified Runtime                  │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Desktop GUI │  │ Web Server  │  │ CLI Tools   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              HotM Core Engine               │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Embedded DB │  │ PostgreSQL  │  │ Embedded AI │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**Advantages:**
- Mode-specific optimization
- Embedded services for offline operation
- Shared core logic across all interfaces
- Flexible deployment without architectural changes

## Deployment Mode Selection Matrix

| Use Case | Users | Network | Collaboration | Recommended Mode | Alternative |
|----------|-------|---------|---------------|------------------|-------------|
| Personal notes | 1 | Optional | None | Desktop | Hybrid |
| Home office | 1-2 | Local | Limited | Hybrid | Desktop |
| Small team | 2-10 | Required | High | Server | Hybrid |
| Development | 1-5 | Required | Medium | Development | Hybrid |
| Organization | 10+ | Required | High | Server | Cloud-Native |
| Enterprise | 100+ | Required | High | Cloud-Native | Server |

## Migration Timeline and Strategy

### Phase 1: Core Refactoring (v0.1.1)
**Timeline**: 2 weeks
**Scope**: Extract business logic into `hotm-core` crate
```rust
// Service trait abstraction
pub trait DatabaseService: Send + Sync {
    async fn create_note(&self, note: CreateNoteRequest) -> Result<Note>;
    // ... other methods
}

pub trait AiService: Send + Sync {
    async fn generate_summary(&self, content: &str) -> Result<String>;
    // ... other methods  
}
```

### Phase 2: Interface Abstraction (v0.1.2)  
**Timeline**: 3 weeks
**Scope**: Create runtime mode selection and interface adapters
```rust
pub enum RuntimeMode {
    Desktop { show_gui: bool, system_tray: bool },
    Server { bind_address: SocketAddr, enable_web_ui: bool },
    Hybrid { desktop_config: DesktopConfig, server_config: ServerConfig },
    Development { hot_reload: bool, debug_apis: bool },
}
```

### Phase 3: Unified Binary (v0.2.0)
**Timeline**: 4 weeks  
**Scope**: Merge binaries, implement embedded services, create installation packages
```toml
# Single configuration file for all modes
[runtime]
mode = "desktop"  # or "server", "hybrid", "development"

[desktop]
show_gui = true
system_tray = true

[database]
type = "embedded"  # or "postgresql"
path = "./data/hotm.db"
```

### Phase 4: Enhancement (v0.2.1+)
**Timeline**: Ongoing
**Scope**: Cloud integrations, distributed features, performance optimizations

## Security Model Summary

### Security by Deployment Mode

#### Desktop Mode Security
- **Data Protection**: Windows DPAPI encryption, BitLocker integration
- **Process Isolation**: Sandboxed workers, least privilege execution
- **Network**: Disabled by default, explicit consent required
- **Authentication**: Local user authentication

#### Server Mode Security  
- **Network**: Mandatory HTTPS, modern TLS ciphers
- **Authentication**: JWT with MFA, API key management
- **Data**: Database encryption, backup encryption
- **Infrastructure**: Container security, secret management

#### Hybrid Mode Security
- **Selective**: Local access without auth, remote access with full auth
- **Smart Routing**: Performance-optimized security controls
- **Conflict Resolution**: Secure merge strategies

## Performance and Resource Requirements

### Resource Usage by Mode

| Mode | RAM Usage | Storage | CPU Usage | Network |
|------|-----------|---------|-----------|---------|
| **Desktop** | 150-400MB | 2-10GB | Low | Optional |
| **Server** | 200-500MB | 100GB+ | Medium | Required |
| **Hybrid** | 300-600MB | 50GB+ | Medium-High | Optional |
| **Development** | 400-800MB | 20GB+ | High | Required |

### Performance Optimizations

#### Desktop Mode Optimizations
```toml
[performance]
worker_threads = 2
cache_size = "50MB"  
batch_size = 10
embedded_models = true
```

#### Server Mode Optimizations
```toml
[performance]
worker_threads = 0  # Use all cores
cache_size = "200MB"
batch_size = 50
connection_pool_size = 20
```

## Monitoring and Observability

### Health Checks
```bash
# Universal health check command
hotm health

# Mode-specific checks
hotm health --database
hotm health --ai-service
hotm health --network
```

### Metrics Collection
```toml
[monitoring]
metrics = true
metrics_endpoint = "/metrics"
prometheus_compatible = true

[logging]
level = "info"
format = "json"
structured_logging = true
```

## Troubleshooting Common Issues

### Installation Issues
```bash
# Verify installation
hotm --version

# Check configuration
hotm config validate

# Test connectivity
hotm test --database --ai-service
```

### Performance Issues
```bash
# Performance profiling
hotm profile --duration 30s

# Resource monitoring
hotm monitor --real-time

# Optimization recommendations
hotm optimize --analyze
```

### Migration Issues
```bash
# Migration status
hotm migrate status

# Rollback if needed
hotm migrate rollback --to v0.1.x

# Data validation
hotm validate --data --config
```

## Getting Started Checklist

### For Individual Users (Desktop Mode)
- [ ] Download HotM unified runtime installer
- [ ] Install with `MODE=DESKTOP` option
- [ ] Run first-time setup wizard
- [ ] Configure system tray and hotkey preferences
- [ ] Test offline functionality

### For Teams (Server Mode)
- [ ] Set up Docker environment with PostgreSQL and Ollama
- [ ] Configure environment variables for security
- [ ] Deploy using Docker Compose
- [ ] Configure user authentication and permissions
- [ ] Set up automated backups
- [ ] Test web interface and API access

### For Developers (Development Mode)
- [ ] Clone repository and install dependencies
- [ ] Set up development database
- [ ] Configure development environment
- [ ] Run development mode with hot reload
- [ ] Set up debugging and testing tools

## Support and Resources

### Documentation
- **[Architecture Documentation](../architecture/)** - Technical deep-dive
- **[API Documentation](../specifications/api-specification.md)** - REST API reference
- **[Configuration Reference](./unified-runtime-configuration.md)** - Complete configuration guide

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community support and questions
- **Wiki**: Community-maintained guides and tips

### Enterprise Support
- **Professional Services**: Migration assistance and custom deployment
- **Priority Support**: Direct access to development team
- **Training Programs**: Team onboarding and best practices

The unified runtime architecture positions HotM for scalable growth while maintaining the simplicity and privacy that users value. This comprehensive deployment strategy ensures smooth transitions and optimal configurations for any use case.