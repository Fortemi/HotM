# HotM Documentation Index

## Overview
HotM is a local-first notes and analysis tool with immutable originals, NLP-powered revisions, and hybrid search capabilities. Built with Rust (Axum API server) and Tauri (React/TypeScript desktop client) for Windows 11.

## Documentation Structure

### 1. Requirements & Specifications
- [Functional Requirements](01-requirements/functional-requirements.md) - User stories, use cases, and features
- [Non-Functional Requirements](01-requirements/non-functional-requirements.md) - Performance, security, reliability
- [System Constraints](01-requirements/constraints.md) - Technical and business constraints

### 2. Technical Specifications
- [API Specification v1](02-specifications/api-specification.md) - Original REST API design
- [API Specification v2](02-specifications/api-specification-v2.md) - **Current implementation with WebSocket**
- [Data Model](02-specifications/data-model.md) - Database schema and relationships
- [MCP Server Tools](02-specifications/mcp-tools-spec.md) - Model Context Protocol integration
- [UI Specification](02-specifications/ui-specification.md) - User interface components and flows

### 3. Architecture
- [System Architecture](03-architecture/system-architecture.md) - High-level system design
- [Component Design](03-architecture/component-design.md) - Detailed component architecture
- [NLP Pipeline](03-architecture/nlp-pipeline.md) - Natural language processing workflows
- [Search Architecture](03-architecture/search-architecture.md) - Hybrid search implementation
- [Security Architecture](03-architecture/security-architecture.md) - Authentication and data protection

### 4. Implementation Guides
- [Development Guide](04-implementation/development-guide.md) - Setup and development workflow
- [Testing Strategy](04-implementation/testing-strategy.md) - Original testing approach
- [Testing Framework](09-testing-framework.md) - **Comprehensive testing implementation guide**
- [Code Standards](04-implementation/code-standards.md) - Rust and TypeScript conventions
- [Background Workers](04-implementation/background-workers.md) - Async job processing

### 5. Deployment & Operations
- [Installation Guide](05-deployment/installation-guide.md) - End-user installation instructions
- [Configuration Guide](05-deployment/configuration.md) - Environment and runtime configuration
- [Docker Deployment](05-deployment/docker-deployment.md) - Containerized server deployment
- [Operations Guide](05-deployment/operations-guide.md) - Monitoring and maintenance
- [Troubleshooting](05-deployment/troubleshooting.md) - Common issues and solutions

### 6. Project Management
- [Feature Roadmap](06-roadmap/feature-roadmap.md) - Planned features and enhancements
- [Technical Debt](06-roadmap/technical-debt.md) - Known issues and improvements
- [Release Planning](06-roadmap/release-plan.md) - Version milestones and schedule

### 7. Architectural Decisions
- [ADR-001: Platform and Framework](decisions/ADR-001-platform-framework.md)
- [ADR-002: Storage Engine](decisions/ADR-002-storage-engine.md)
- [ADR-003: NLP Runtime](decisions/ADR-003-nlp-runtime.md)
- [ADR-004: Search Strategy](decisions/ADR-004-search-strategy.md)
- [ADR-005: Security & Privacy](decisions/ADR-005-security-privacy.md)
- [ADR-006: MCP Integration](decisions/ADR-006-mcp-integration.md)
- [ADR-007: Authentication Strategy](decisions/ADR-007-authentication.md)

## Quick Links
- [CLAUDE.md](../CLAUDE.md) - Quick reference for Claude Code
- [README.md](../README.md) - Project overview
- [API Health Check](http://127.0.0.1:53211/api/v1/health) - Runtime status

## Version
Current Version: 0.1.0 (Alpha)
Documentation Last Updated: 2025-08-23

## Recent Updates
- Added WebSocket API for real-time job monitoring
- Implemented job queue with priority-based processing
- Added link metadata for keyword tracking
- Enhanced UI with job status indicators
- Created comprehensive testing framework documentation