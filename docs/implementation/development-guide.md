# Development Guide

## Scope
This repository is client-only (HotM UI). Backend services are provided by Fortemi.

## Local Development
1. Configure API endpoint:

```env
# ui/.env.local
VITE_API_BASE_URL=https://memory.integrolabs.net
```

2. Start UI:

```bash
cd ui
npm install
npm run dev
```

## Quality Checks
```bash
cd ui
npm run typecheck
npm run test -- --run
npm run build
```

## Notes
- Do not add backend runtime, migrations, or database bootstrap steps to this repo.
- If an API contract change is needed, implement/update it in the Fortemi repository and consume it from this client.
