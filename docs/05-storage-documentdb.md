# Storage: Microsoft DocumentDB (PostgreSQL-compatible)

We adopt Microsoft DocumentDB as the primary store for v1. It combines PostgreSQL reliability and tooling with document-centric JSONB and first-class extensions.

Why
- Document-first with relational where it fits (links, tags, revisions)
- Strong Windows story and operational features (backup/DR, PITR)
- Mature FTS (tsvector/GIN) and vectors via pgvector (HNSW/IVFFlat)
- PostgreSQL ecosystem and drivers

Modeling
- Documents: `note_original.content`, `note_revised_current.content` (TEXT/JSONB)
- Relations: `note`, `note_revision`, `provenance_edge`, `link`, `tag`, `note_tag`, `collection`
- Search: `note_revised_current.tsv` GIN index; `embedding.vector` with pgvector index

Setup
1) Install DocumentDB and create a database
2) Enable extensions (once per DB):
   - `CREATE EXTENSION IF NOT EXISTS vector;`
   - `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (optional)
3) Apply schema in `docs/04-data-model-pg.sql`

Search
- Keyword: `to_tsvector('english', ...)` with GIN, use `plainto_tsquery`/`to_tsquery`
- Vector: `SELECT ... ORDER BY vector <-> query_vec LIMIT k;`
- Hybrid: run both, fuse with Reciprocal Rank Fusion, optional rerank

Backup/DR
- Use standard PostgreSQL tooling (e.g., pg_dump, base backups, WAL archiving). Follow DocumentDB guidance for PITR and disaster recovery.

Notes
- We do not keep a SQLite fallback; the stack standardizes on DocumentDB/PostgreSQL for all environments.
