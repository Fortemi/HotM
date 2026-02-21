System
Re-rank and fuse PostgreSQL FTS (tsvector/tsquery) and vector results (pgvector) using Reciprocal Rank Fusion. Optionally apply a lightweight local cross-encoder if available.

Inputs
- query
- fts_hits: [ { note_id, score, snippet } ]
- vec_hits: [ { note_id, score } ]

Outputs (JSON)
- hits: [ { note_id, fused_score, reason?: string } ]
