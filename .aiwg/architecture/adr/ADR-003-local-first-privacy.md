# ADR-003: Local-First Privacy Architecture

## Status
Accepted

## Context

HotM is a personal knowledge management tool storing potentially sensitive personal notes, thoughts, and reflections. Users need absolute confidence that their data remains private and under their control.

Privacy has been identified as the #1 priority for the HotM project. Users are expected to store intimate personal information, including:
- Personal reflections and thoughts
- Health and wellness information
- Financial notes and planning
- Relationship reflections
- Career development and aspirations
- Sensitive business insights

The fundamental question: How do we ensure user privacy while still providing AI-powered features like semantic search, summarization, and content organization?

## Decision

We adopt a **local-first privacy architecture** where:

1. **All data stays local**: PostgreSQL runs on localhost only by default, with no remote connections in MVP
2. **All AI processing stays local**: Ollama runs locally on user's machine, no cloud AI APIs (OpenAI, Claude, etc.)
3. **No telemetry**: Zero analytics, tracking, diagnostics, or "phone home" communication
4. **No cloud sync (MVP)**: Data exists exclusively on user's device
5. **Future sync via P2P only**: When sync capability is added, it will use peer-to-peer protocols with end-to-end encryption, never through central servers or cloud intermediaries

This decision is reflected in:
- Architecture: API server and database both localhost-only in standard deployment
- Technology: Local Ollama for all NLP operations
- Deployment: Windows service for API server, local Tauri app for UI
- Release model: No telemetry or update checking (manual updates only)

## Consequences

### Positive
- Complete data sovereignty - users have absolute control of their information
- No privacy policy needed - no data collection means no privacy compliance burden
- Works fully offline - no internet connection required for core functionality
- No subscription costs - no recurring fees or service dependencies
- User trust by design - users can verify code and audit their local setup
- GDPR/privacy regulation compliance - by design, not by policy
- No data breach risk from third-party servers

### Negative
- No cross-device sync in MVP - users cannot access notes from multiple devices in v0.1
- User responsible for backups - must manually backup PostgreSQL or export data
- Requires local compute resources - Ollama needs GPU/CPU for timely inference (minimum 8GB RAM recommended)
- Cannot leverage cutting-edge cloud AI - Ollama models may lag behind latest frontier LLMs
- Limited scalability - constrained by single user's hardware resources
- User support complexity - each installation is unique; debugging requires understanding their local setup

### Risks
- Data loss risk if user doesn't backup PostgreSQL database
- Suboptimal AI quality if user has limited hardware resources
- User perception of being "isolated" compared to cloud-native competitors
- Long-term model maintenance - Ollama community support may vary

## Alternatives Considered

### 1. Cloud-based AI with cloud storage
- Send all notes to OpenAI, Claude, or similar API for processing
- Store data in Firebase, AWS, or similar cloud platform
- **Rejected**: Directly violates the #1 priority (user privacy). Would require sending potentially sensitive personal information to third-party servers. Incompatible with HotM's core value proposition.

### 2. Hybrid approach (local storage, cloud AI)
- Keep PostgreSQL local but send content to cloud AI services for processing
- Store processing results locally
- **Rejected**: Still requires sending sensitive content externally. Privacy breach occurs at the point of transmission, not storage. Users cannot trust data sent to cloud APIs. Violates principle of data sovereignty.

### 3. Cloud sync with encryption
- Encrypt locally before syncing to cloud storage (e.g., encrypted S3, Vault)
- Retain end-to-end encryption keys locally
- **Considered but rejected for MVP**:
  - Adds significant architectural complexity
  - Still requires trust in cloud provider (even with encryption)
  - Introduces new attack surface (encryption key management)
  - Better solved with P2P approach after MVP stabilizes
  - Defers simpler, local-first design

### 4. On-premise deployment with remote server
- Deploy API server to user's own server infrastructure (on-prem)
- Multiple users connect to private server
- **Rejected for MVP**: Out of scope for single-user personal knowledge tool. May revisit for enterprise deployments later.

## Trade-off Analysis

| Factor | Local-First | Cloud Hybrid | Cloud Native |
|--------|------------|-------------|--------------|
| Privacy | Excellent | Poor | Poor |
| Data Control | User | Provider | Provider |
| Offline Access | Full | Partial | Limited |
| Sync Across Devices | No (MVP) | Yes | Yes |
| Cost | One-time | Subscription | Subscription |
| Compute Requirements | Local GPU | None | None |
| Complexity | Medium | Medium | Low |
| User Trust | High | Medium | Low |

## Implementation Notes

### Phase 1: Local-First Foundation (v0.1-v0.2)
- PostgreSQL on localhost only
- Ollama locally for all NLP
- No telemetry or phoning-home
- Manual backups recommended in docs
- Works offline completely

### Phase 2: Optional P2P Sync (v0.3+, if pursued)
- Peer-to-peer protocol (Syncthing-like or custom)
- End-to-end encryption with user-controlled keys
- Never touches central servers
- Experimental/opt-in initially

## Related Decisions

- **ADR-001**: Client-Server Architecture - describes how local API server isolates from external systems
- **ADR-002**: Greenfield Schema Rebuild - describes local PostgreSQL schema design without cloud assumptions
- **ADR-004** (future): Backup Strategy - will define user backup and recovery mechanisms

## Compliance & Standards

This architecture achieves:
- **GDPR**: No personal data collected, processed, or transferred
- **CCPA**: User has absolute right to their data (it's on their device)
- **Privacy by Design**: Core architecture principle, not afterthought
- **Zero-Knowledge**: System has no knowledge of user data
- **Open Source Ready**: Can be audited to verify no telemetry

## Decision Date

Recorded: December 2024
