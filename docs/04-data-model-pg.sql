-- PostgreSQL/DocumentDB schema for HotM (v1)
-- Requires extensions: pgvector, pg_trgm (optional), and standard FTS

-- Enable extensions (run with superuser/admin once per DB)
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE EXTENSION IF NOT EXISTS pg_trgm; -- optional for similarity

-- Core notes (relational metadata)
CREATE TABLE IF NOT EXISTS note (
  id UUID PRIMARY KEY,
  collection_id UUID,
  format TEXT NOT NULL,         -- 'plaintext' | 'markdown' | 'webclip' | ...
  source TEXT NOT NULL,         -- 'manual' | 'import' | 'clip' | 'api'
  created_at_utc TIMESTAMPTZ NOT NULL,
  updated_at_utc TIMESTAMPTZ NOT NULL
);

-- Immutable original content (document)
CREATE TABLE IF NOT EXISTS note_original (
  note_id UUID PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL
);

-- Current default view (revised), editable
CREATE TABLE IF NOT EXISTS note_revised_current (
  note_id UUID PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  last_revision_id UUID
);

-- Full revision history
CREATE TABLE IF NOT EXISTS note_revision (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  parent_revision_id UUID,
  content TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'auto' | 'manual'
  created_at_utc TIMESTAMPTZ NOT NULL,
  summary TEXT,
  rationale TEXT
);

-- Provenance edges
CREATE TABLE IF NOT EXISTS provenance_edge (
  id UUID PRIMARY KEY,
  revision_id UUID NOT NULL REFERENCES note_revision(id) ON DELETE CASCADE,
  source_note_id UUID,
  source_url TEXT,
  relation TEXT NOT NULL,       -- 'cites' | 'refers_to' | 'derived_from' | ...
  created_at_utc TIMESTAMPTZ NOT NULL
);

-- Dynamic links
CREATE TABLE IF NOT EXISTS link (
  id UUID PRIMARY KEY,
  from_note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  to_note_id UUID,
  to_url TEXT,
  kind TEXT NOT NULL,           -- 'related' | 'mention' | 'reference' | 'task'
  score REAL NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tag ( name CITEXT PRIMARY KEY );
CREATE TABLE IF NOT EXISTS note_tag (
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  tag_name CITEXT NOT NULL REFERENCES tag(name) ON DELETE CASCADE,
  source TEXT NOT NULL,         -- 'auto' | 'manual'
  PRIMARY KEY (note_id, tag_name)
);

-- Collections
CREATE TABLE IF NOT EXISTS collection (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- FTS support: materialized tsvector over original + revised + tags
ALTER TABLE IF EXISTS note_revised_current ADD COLUMN IF NOT EXISTS tsv tsvector;

CREATE OR REPLACE FUNCTION refresh_note_tsv(note UUID) RETURNS void AS $$
BEGIN
  UPDATE note_revised_current nrc SET tsv =
    setweight(to_tsvector('english', COALESCE((SELECT content FROM note_original no WHERE no.note_id = nrc.note_id), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(nrc.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE((
      SELECT string_agg(tag_name, ' ') FROM note_tag nt WHERE nt.note_id = nrc.note_id
    ), '')), 'C')
  WHERE nrc.note_id = note;
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep FTS in sync
CREATE OR REPLACE FUNCTION trg_refresh_tsv_after_revised() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_note_tsv(NEW.note_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_revised_tsv ON note_revised_current;
CREATE TRIGGER t_revised_tsv AFTER INSERT OR UPDATE OF content ON note_revised_current
FOR EACH ROW EXECUTE FUNCTION trg_refresh_tsv_after_revised();

CREATE OR REPLACE FUNCTION trg_refresh_tsv_after_tag() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_note_tsv(NEW.note_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_note_tag_tsv ON note_tag;
CREATE TRIGGER t_note_tag_tsv AFTER INSERT OR UPDATE OR DELETE ON note_tag
FOR EACH ROW EXECUTE FUNCTION trg_refresh_tsv_after_tag();

-- GIN index for FTS
CREATE INDEX IF NOT EXISTS idx_note_tsv ON note_revised_current USING GIN (tsv);

-- Embeddings with pgvector
-- For HNSW (pgvector >= 0.6.0) use: USING hnsw (vector) WITH (m=16, ef_construction=200)
CREATE TABLE IF NOT EXISTS embedding (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  vector vector(768) NOT NULL,   -- adjust dim per model
  model TEXT NOT NULL
);

-- Recommended indexes
CREATE INDEX IF NOT EXISTS idx_embedding_note_chunk ON embedding (note_id, chunk_index);
-- IVF/Flat example: CREATE INDEX IF NOT EXISTS idx_embedding_vec ON embedding USING ivfflat (vector) WITH (lists = 100);
-- HNSW example: CREATE INDEX IF NOT EXISTS idx_embedding_vec ON embedding USING hnsw (vector);

-- Analytics/activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY,
  at_utc TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  note_id UUID,
  meta JSONB
);
