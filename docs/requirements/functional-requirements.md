# Functional Requirements

## Overview
This document defines the functional requirements for HotM, a local-first notes and analysis system with NLP-powered enhancements.

## User Stories

### Core Note Management

#### US-001: Create Note
**As a** user  
**I want to** quickly capture notes from anywhere  
**So that** I can record thoughts without interrupting my workflow  

**Acceptance Criteria:**
- Global hotkey (Ctrl+Alt+H) opens capture window
- Support plaintext, markdown, and web clips
- Auto-save with UTC timestamps
- Immediate storage of immutable original

#### US-002: View Notes
**As a** user  
**I want to** view my notes in different formats  
**So that** I can see both original and enhanced versions  

**Acceptance Criteria:**
- Toggle between Original/Revised/Provenance views
- Revised view is default
- Display creation and modification timestamps in local time
- Show dynamic links and tags

#### US-003: Search Notes
**As a** user  
**I want to** search my notes using various methods  
**So that** I can quickly find relevant information  

**Acceptance Criteria:**
- Full-text keyword search
- Semantic similarity search
- Hybrid search combining both methods
- Filter by tags, collections, date ranges
- Search syntax: `tag:work`, `collection:projects`, `before:2024-01-01`

### NLP Enhancement Features

#### US-004: Automatic Revision
**As a** user  
**I want** my notes to be automatically enhanced  
**So that** they are more concise and useful  

**Acceptance Criteria:**
- Automatic summarization on note creation
- Grammar and clarity improvements
- Preserve original meaning
- Track revision history with rationale

#### US-005: Smart Tagging
**As a** user  
**I want** automatic tag suggestions  
**So that** my notes are organized without manual effort  

**Acceptance Criteria:**
- Extract entities and topics
- Suggest relevant tags
- Allow manual tag addition/removal
- Distinguish auto vs manual tags

#### US-006: Dynamic Linking
**As a** user  
**I want** automatic link detection  
**So that** I can discover connections between notes  

**Acceptance Criteria:**
- Detect related notes by content similarity
- Identify mentions and references
- Show confidence scores
- Support external URL links

### Organization Features

#### US-007: Collections
**As a** user  
**I want to** organize notes into collections  
**So that** I can group related content  

**Acceptance Criteria:**
- Create named collections
- Assign notes to collections
- Search within collections
- Collection descriptions

#### US-008: Provenance Tracking
**As a** user  
**I want to** see how my notes evolved  
**So that** I understand the revision history  

**Acceptance Criteria:**
- View revision timeline
- See parent-child relationships
- Track external sources
- Understand revision rationale

### System Integration

#### US-009: MCP Tool Access
**As a** developer/power user  
**I want to** access notes via MCP tools  
**So that** I can integrate with AI assistants  

**Acceptance Criteria:**
- Standard MCP tool implementation
- Deterministic tool operations
- Full CRUD capabilities
- Search and analytics tools

#### US-010: API Access
**As a** developer  
**I want to** access notes via REST API  
**So that** I can build custom integrations  

**Acceptance Criteria:**
- RESTful API with OpenAPI documentation
- API key authentication
- Rate limiting
- WebSocket events for real-time updates

## Feature Matrix

| Feature | Priority | Release | Status |
|---------|----------|---------|--------|
| Note Creation | P0 | 0.1.0 | Implemented |
| Note Viewing | P0 | 0.1.0 | Implemented |
| Basic Search | P0 | 0.1.0 | Implemented |
| Auto Revision | P0 | 0.1.0 | Planned |
| Smart Tagging | P1 | 0.1.0 | Partial |
| Dynamic Links | P1 | 0.1.0 | Planned |
| Collections | P1 | 0.1.0 | Partial |
| Provenance | P1 | 0.1.0 | Planned |
| MCP Server | P1 | 0.2.0 | Planned |
| API Auth | P1 | 0.2.0 | Planned |
| Hybrid Search | P0 | 0.1.0 | Partial |
| Global Hotkey | P0 | 0.1.0 | Planned |
| Tray App | P0 | 0.1.0 | Planned |

## Use Cases

### UC-001: Quick Capture Workflow
1. User presses Ctrl+Alt+H
2. Capture window appears
3. User types/pastes content
4. System saves note
5. Background NLP processing begins
6. User continues working
7. Revised version available when accessed

### UC-002: Research Workflow
1. User searches for topic
2. System returns hybrid results
3. User reviews revised summaries
4. User clicks dynamic links to explore connections
5. User creates new note with findings
6. System links new note to sources

### UC-003: Review Workflow
1. User opens note
2. Views revised version by default
3. Switches to original to see raw content
4. Checks provenance for revision history
5. Adds manual tags for organization
6. Assigns to collection

## Functional Constraints

1. **Immutability**: Original notes must never be modified
2. **Local-First**: Core features must work offline
3. **Privacy**: No data leaves local machine without explicit user action
4. **Performance**: Search results within 500ms for up to 100k notes
5. **Transparency**: All NLP operations must be explainable via provenance
