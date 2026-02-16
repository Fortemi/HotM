# Quick Start

HotM is a client application that connects to Fortemi.

## Prerequisites
- Node.js 20+
- npm 10+
- Rust toolchain (only if building/running Tauri desktop)

## Configure API
Create `ui/.env.local`:

```env
VITE_API_BASE_URL=https://memory.integrolabs.net
```

## Run
```bash
cd ui
npm install
npm run dev
```

## Validate
```bash
cd ui
npm run typecheck
npm run test -- --run
npm run build
```
