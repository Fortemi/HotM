# Product Designer Memory — HotM

## Project Context
- HotM is a React 19 SPA consuming the Fortemi API (Rust, separate repo)
- Main monolith: `ui/src/components/HallOfMind.tsx` (~2200 lines)
- AppView union type in HallOfMind.tsx controls which view is shown
- API client at `ui/src/api/` — one file per domain (notes.ts, collections.ts, tags.ts, concepts.ts, archives.ts, etc.)

## Key API Patterns
- Note creation: `POST /api/v1/notes` returns `{ note_id }`
- Tags applied after creation: `PUT /api/v1/notes/{id}/tags` with `{ add: [], remove: [] }`
- Collection assignment: `POST /api/v1/notes/{id}/move` with `{ collection_id }`
- Archive routing: `X-Fortemi-Memory` request header (managed via memory-context.ts)
- Concept autocomplete: `GET /api/v1/concepts/autocomplete?q={query}`

## UX Artifacts Produced
- `ux-quick-capture-note-entry.md` — full spec for Quick Capture view (see `.aiwg/requirements/`)
- `ux-persistent-media-player.md` — pop-out / floating media player spec (see `docs/ux/`)

## Design Patterns Confirmed
- Sticky localStorage keys use prefix `hotm.quickCapture.*`
- Component files go in `ui/src/components/{feature}/` with barrel `index.ts`
- Custom hooks extracted to `use{Name}.ts` files within the feature directory
- Radix UI used for all interactive primitives (Select, Popover, RadioGroup)
- TailwindCSS for all styling — no inline styles

## Design Patterns Confirmed (continued)
- Global keyboard shortcuts for floating player use Alt+Key to avoid conflict with note editor text input (Space/Arrow consumed by editor)
- Floating UI renders in a portal at app root level — outside the currentView switching tree — so media element survives view changes
- Mini player z-index 1000; modal dialogs / fullscreen overlays use 1100+
- localStorage prefix pattern for player: `hotm.player.*`
- Docked bar shifts layout (padding-bottom: 64px on main scroll container) rather than floating above content
- Mobile (<640px): no floating player — use docked notification bar only

## Open Questions (unresolved as of 2026-02-22)
- Whether Fortemi API has a dedicated note-concepts endpoint or uses metadata hints
- Canonical collection assignment endpoint: `POST /notes/{id}/move` vs `PUT /notes/{id}/collection`
- Whether tag creation is implicit on first use or requires explicit POST /tags
