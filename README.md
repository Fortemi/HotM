# HotM Frontend

[![Version](https://img.shields.io/badge/version-0.1.2-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

HotM is the frontend client for the Fortemi memory platform. This repository contains the Tauri + React application and related UI tooling.

## Status
- Current: v0.1.2
- Scope: Client application only (no backend components in this repo)
- Runtime backend: configurable Fortemi API endpoint via `VITE_API_BASE_URL`

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Rust toolchain (for Tauri desktop build)

### Run UI
```bash
cd ui
npm install
npm run dev
```

### Configure API Base URI
Create `ui/.env`:
```env
VITE_API_BASE_URL=https://memory.integrolabs.net
```

## Build & Test
```bash
cd ui
npm run typecheck
npm run test -- --run
npm run build
```

## Project Structure
```text
hotm/
├── ui/              # Tauri + React client
│   ├── src/         # React frontend
│   └── src-tauri/   # Tauri desktop backend
├── docs/            # Documentation
└── scripts/         # Dev and release utilities
```

## Documentation
- Main index: `docs/index.md`
- API client docs: `ui/src/api/README.md`

## Contributing
1. Create a feature branch.
2. Add/update tests with your change.
3. Ensure `npm run test`, `npm run typecheck`, and `npm run build` pass in `ui/`.
4. Open a PR with screenshots for UI changes.
