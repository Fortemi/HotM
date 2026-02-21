# Functional Requirements

## Overview

This document defines the functional requirements for HotM, a React SPA consuming the Fortemi API for note-taking, knowledge exploration, and analysis.

**Scope**: HotM is a client-only application. All NLP processing, search, storage, and data operations are delegated to the Fortemi API. Requirements below describe the client-side user experience.

## User Stories

### Core Note Management

#### US-001: Create Note
**As a** user
**I want to** quickly capture notes
**So that** I can record thoughts without interrupting my workflow

**Acceptance Criteria:**
- Quick Capture view with dedicated textarea and keyboard shortcuts (Shift+Enter to commit)
- Support plaintext and markdown formats
- Sticky classification settings (archive, collection, concept, tags, format)
- AI enhancement level selection (full/light/none)
- Document type classification (auto-detect or explicit)
- File attachment support with drag-and-drop
- "Attachment-as-note" — submit files with auto-generated content from filenames
- Session log showing captured notes with metadata

#### US-002: View Notes
**As a** user
**I want to** view my notes in different formats
**So that** I can see both original and enhanced versions

**Acceptance Criteria:**
- Toggle between Original/Revised views
- Revised view is default
- Display creation and modification timestamps in local time
- Show tags, concepts, and linked notes
- Inline markdown preview with LaTeX, Mermaid, and PlantUML rendering

#### US-003: Search Notes
**As a** user
**I want to** search my notes using various methods
**So that** I can quickly find relevant information

**Acceptance Criteria:**
- Full-text keyword search
- Semantic similarity search via embeddings
- Hybrid search (FTS + semantic with RRF fusion)
- Advanced search with multi-field filters (tags, collections, date ranges, starred status)
- Federated search across archives
- Memory search (location and temporal)

### NLP Enhancement Features (via Fortemi API)

#### US-004: Automatic Revision
**As a** user
**I want** my notes to be automatically enhanced
**So that** they are more concise and useful

**Acceptance Criteria:**
- Configurable revision mode (full contextual expansion, light formatting, none)
- Regenerate AI enhancement on demand with mode selection dropdown
- Track revision history with rationale
- Preserve immutable original

#### US-005: Smart Tagging
**As a** user
**I want** automatic tag suggestions
**So that** my notes are organized without manual effort

**Acceptance Criteria:**
- Auto-extracted tags from NLP pipeline
- Manual tag addition/removal
- Tag management interface with usage counts
- Tag cooccurrence analysis

#### US-006: Dynamic Linking
**As a** user
**I want** automatic link detection
**So that** I can discover connections between notes

**Acceptance Criteria:**
- Detect related notes by content similarity
- Display related notes panel with confidence scores
- Knowledge graph visualization (Sigma.js + Graphology)
- ForceAtlas2 layout with interactive exploration

### Organization Features

#### US-007: Collections
**As a** user
**I want to** organize notes into collections
**So that** I can group related content

**Acceptance Criteria:**
- Create, rename, delete collections
- Assign notes to collections
- Browse notes within collections

#### US-008: SKOS Concepts
**As a** user
**I want to** explore NLP-extracted concepts
**So that** I understand the knowledge structure of my notes

**Acceptance Criteria:**
- Browse concept schemes and hierarchies
- View concept details with related notes
- Tag notes with specific concepts
- Concept governance (candidate, approved, deprecated)

#### US-009: Templates
**As a** user
**I want to** use note templates
**So that** I can capture structured content consistently

**Acceptance Criteria:**
- Create and manage templates
- Variable substitution in templates
- Instantiate notes from templates

#### US-010: Archives
**As a** user
**I want to** manage multiple memory archives
**So that** I can separate different knowledge domains

**Acceptance Criteria:**
- Create, clone, delete archives
- Set default archive
- View per-archive statistics
- Archive-scoped browsing

### Visualization & Exploration

#### US-011: Knowledge Graph
**As a** user
**I want to** explore my notes as an interactive graph
**So that** I can discover hidden connections

**Acceptance Criteria:**
- Force-directed graph visualization
- Node hover labels and click-to-explore
- Back/forward navigation through selections
- Filter by tags and concepts
- Configurable density presets (sparse, balanced, dense)

#### US-012: Timeline
**As a** user
**I want to** view my notes chronologically
**So that** I can understand temporal patterns

**Acceptance Criteria:**
- Chronological note display with filtering
- Date-based navigation

#### US-013: Version History
**As a** user
**I want to** see how my notes evolved
**So that** I understand the revision history

**Acceptance Criteria:**
- View revision timeline per note
- Diff view between versions
- Restore previous versions

### System & Operations

#### US-014: System Health
**As a** user
**I want to** monitor system health
**So that** I know everything is working correctly

**Acceptance Criteria:**
- Health dashboard with API status
- Orphan tag detection
- Stale note identification
- Per-archive health metrics

#### US-015: Backup & Restore
**As a** user
**I want to** back up and restore my data
**So that** I don't lose my knowledge base

**Acceptance Criteria:**
- Database snapshots
- Knowledge shard export/import
- Backup status monitoring

## Feature Matrix

| Feature | Priority | Status | Version |
|---------|----------|--------|---------|
| Note CRUD | P0 | Implemented | 2026.1.0 |
| Markdown Editor/Preview | P0 | Implemented | 2026.1.0 |
| Quick Capture | P0 | Implemented | 2026.2.0 |
| File Attachments | P1 | Implemented | 2026.2.3 |
| AI Enhancement Selection | P1 | Implemented | 2026.2.3 |
| Document Type Classification | P1 | Implemented | 2026.2.3 |
| Hybrid Search (FTS+Semantic) | P0 | Implemented | 2026.1.0 |
| Advanced Search Filters | P1 | Implemented | 2026.2.0 |
| Memory Search | P1 | Implemented | 2026.2.0 |
| Federated Search | P2 | Implemented | 2026.2.0 |
| Collections | P1 | Implemented | 2026.1.0 |
| Tag Management | P1 | Implemented | 2026.1.0 |
| SKOS Concept Browser | P1 | Implemented | 2026.2.0 |
| Knowledge Graph | P1 | Implemented | 2026.2.0 |
| Timeline View | P2 | Implemented | 2026.2.0 |
| Templates | P2 | Implemented | 2026.2.0 |
| Version History | P1 | Implemented | 2026.2.0 |
| Archives Management | P1 | Implemented | 2026.2.0 |
| Health Dashboard | P2 | Implemented | 2026.2.0 |
| Backup/Restore | P2 | Implemented | 2026.2.0 |
| Job Queue Monitoring | P2 | Implemented | 2026.2.0 |
| Admin Panel | P2 | Implemented | 2026.2.0 |
| Related Notes Panel | P1 | Implemented | 2026.1.0 |
| Realtime Events (SSE/WS) | P1 | Implemented | 2026.2.0 |
| Mobile Read Mode | P2 | Implemented | 2026.2.0 |
| MCP Integration | P1 | Implemented | Fortemi |
| Authentication (OIDC) | P1 | Deferred | Post-MVP |
| PWA / Offline Mode | P2 | Deferred | Post-MVP |
| Dark Mode | P2 | Deferred | Post-MVP |

## Use Cases

### UC-001: Quick Capture Workflow
1. User navigates to Capture view
2. Classification bar pre-filled from previous session (sticky settings)
3. User selects AI enhancement level and optional document type
4. User types or pastes content
5. User optionally attaches files via drag-and-drop or file picker
6. User commits with Shift+Enter
7. Note created via API with selected pipeline options
8. Attachments uploaded to created note
9. Session log updated with result
10. User continues capturing (textarea cleared, focus restored)

### UC-002: Research Workflow
1. User searches for topic (hybrid mode by default)
2. System returns ranked results combining FTS and semantic matches
3. User reviews revised summaries in note panel
4. User explores related notes via similarity panel
5. User opens knowledge graph to discover hidden connections
6. User creates new note with findings
7. System processes note through NLP pipeline

### UC-003: Review Workflow
1. User opens note from list
2. Views revised version by default
3. Switches to original to see raw content
4. Checks version history for revision timeline
5. Adds manual tags for organization
6. Assigns to collection

## Functional Constraints

1. **Immutability**: Original notes must never be modified (enforced by Fortemi API)
2. **Client-Only**: HotM performs no data processing — all logic delegated to Fortemi API
3. **Privacy**: No user data leaves the configured API endpoint
4. **Performance**: Search results within 1.5s P95 via API
5. **Transparency**: All NLP operations traceable via provenance API
