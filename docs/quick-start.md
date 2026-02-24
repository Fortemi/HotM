# Quick Start

HotM is a React SPA that connects to Fortemi.

## Prerequisites
- Node.js 20+
- npm 10+
- A running Fortemi API instance

## Configure API
Create `ui/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000
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
