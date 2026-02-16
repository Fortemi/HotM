# Key Decisions

1. HotM repository scope is client-only.
2. Backend implementation and operations are delegated to Fortemi.
3. API base URI is environment-configurable (`VITE_API_BASE_URL`).
4. Compatibility logic for backend contract differences is handled in `ui/src/api`.
5. CI and contributor workflows prioritize frontend quality gates (`typecheck`, `test`, `build`).
