# HotM Documentation Index

## Overview

HotM (Hall of the Mind) is a React SPA that consumes the Fortemi API for note-taking, knowledge exploration, and analysis.

- **Architecture**: React 19 + Vite + TailwindCSS + Radix UI
- **Backend**: Fortemi API (separate repository)
- **License**: BUSL-1.1

## Getting Started

- [Quick Start](quick-start.md) — prerequisites, setup, first run
- [Development Guide](implementation/development-guide.md) — client development workflow
- [Testing Strategy](implementation/testing-strategy.md) — test approach and tooling

## Architecture & Design

- [Architecture Overview](architecture-overview.md) — high-level client-server separation
- [System Architecture](architecture/system-architecture.md) — component boundaries
- [Vision](vision.md) — product principles and scope
- [Key Decisions](decisions.md) — architectural decision summary

## API & Specifications

- [API Specification](specifications/api-specification.md) — Fortemi REST API (v2)
- [Semantic Graph Contract](graph/semantic-graph-contract.md) — knowledge graph API
- [Graph Tuning](graph/semantic-graph-tuning.md) — graph rendering presets

## UX & Design

- [UX Design Overview](ux/README.md) — feature design specs
- [Feature Overview](ux/feature-overview.md) — wireframes and interaction patterns
- [Wireframes](ux/wireframes/README.md) — component-level wireframes
- [Accessibility Specification](ux/accessibility-specification.md) — WCAG 2.1 AA compliance
- [Fortemi Integration UX](ux/fortemi-integration-ux-design.md) — master integration design

## Requirements

- [Functional Requirements](requirements/functional-requirements.md) — feature matrix and user stories
- [Non-Functional Requirements](requirements/non-functional-requirements.md) — performance, security, usability
- [Constraints](requirements/constraints.md) — technical and operational constraints

## Operations

- [Operating Policies](OPERATING_POLICIES.md) — branching, review, release policies
- [SDLC Process](SDLC.md) — development lifecycle phases
- [Release SOP](sops/release.md) — release checklist
- [Governance SOP](sops/governance.md) — cadences and RACI
- [Incident Response SOP](sops/incident-response.md) — incident handling

## Releases

- [Changelog](../CHANGELOG.md) — version history
- [Release Notes](releases/) — detailed release announcements

## Scope Rules

- No backend runtime, migration, or bootstrap procedures are maintained in this repo
- Backend contracts and operations belong to the Fortemi repository
- Desktop-era and Stage 2 documents are archived in `.aiwg/archive/`
