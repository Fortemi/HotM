-- 0001: Initial schema (matches docs/04-data-model-pg.sql minus extensions)

CREATE TABLE IF NOT EXISTS note (
  id UUID PRIMARY KEY,
  collection_id UUID,
  format TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL,
  updated_at_utc TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS note_original (
  note_id UUID PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_revised_current (
  note_id UUID PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  last_revision_id UUID,
  tsv tsvector
);

CREATE TABLE IF NOT EXISTS note_revision (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  parent_revision_id UUID,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL,
  summary TEXT,
  rationale TEXT
);

CREATE TABLE IF NOT EXISTS provenance_edge (
  id UUID PRIMARY KEY,
  revision_id UUID NOT NULL REFERENCES note_revision(id) ON DELETE CASCADE,
  source_note_id UUID,
  source_url TEXT,
  relation TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS link (
  id UUID PRIMARY KEY,
  from_note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  to_note_id UUID,
  to_url TEXT,
  kind TEXT NOT NULL,
  score REAL NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tag ( name CITEXT PRIMARY KEY );
CREATE TABLE IF NOT EXISTS note_tag (
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  tag_name CITEXT NOT NULL REFERENCES tag(name) ON DELETE CASCADE,
  source TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_name)
);

CREATE TABLE IF NOT EXISTS collection (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS embedding (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  vector vector(768) NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY,
  at_utc TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  note_id UUID,
  meta JSONB
);

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

CREATE INDEX IF NOT EXISTS idx_note_tsv ON note_revised_current USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_embedding_note_chunk ON embedding (note_id, chunk_index);
