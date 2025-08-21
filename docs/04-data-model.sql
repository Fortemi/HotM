-- SQLite schema for HotM (v1)

-- Core notes
CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  format TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

-- Immutable original content
CREATE TABLE IF NOT EXISTS note_original (
  note_id TEXT PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL
);

-- Current default view (revised), editable
CREATE TABLE IF NOT EXISTS note_revised_current (
  note_id TEXT PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  last_revision_id TEXT
);

-- Full revision history
CREATE TABLE IF NOT EXISTS note_revision (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  parent_revision_id TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  summary TEXT,
  rationale TEXT
);

-- Provenance edges
CREATE TABLE IF NOT EXISTS provenance_edge (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES note_revision(id) ON DELETE CASCADE,
  source_note_id TEXT,
  source_url TEXT,
  relation TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

-- Dynamic links
CREATE TABLE IF NOT EXISTS link (
  id TEXT PRIMARY KEY,
  from_note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  to_note_id TEXT,
  to_url TEXT,
  kind TEXT NOT NULL,
  score REAL NOT NULL,
  created_at_utc TEXT NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tag ( name TEXT PRIMARY KEY );
CREATE TABLE IF NOT EXISTS note_tag (
  note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL REFERENCES tag(name) ON DELETE CASCADE,
  source TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_name)
);

-- Collections
CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- FTS index over original and revised
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED,
  content_original,
  content_revised,
  tags,
  tokenize='porter'
);

-- Vector embeddings (chunked)
CREATE TABLE IF NOT EXISTS embedding (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  vector BLOB NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL
);

-- Analytics/activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  at_utc TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  note_id TEXT,
  meta JSON
);

-- Triggers to keep FTS synced (examples)
CREATE TRIGGER IF NOT EXISTS trg_note_fts_upsert AFTER INSERT ON note_revised_current BEGIN
  INSERT INTO note_fts(note_id, content_original, content_revised, tags)
  VALUES (
    NEW.note_id,
    (SELECT content FROM note_original WHERE note_id = NEW.note_id),
    NEW.content,
    (
      SELECT GROUP_CONCAT(tag_name, ' ')
      FROM note_tag WHERE note_id = NEW.note_id
    )
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_note_fts_update AFTER UPDATE OF content ON note_revised_current BEGIN
  UPDATE note_fts SET content_revised = NEW.content WHERE note_id = NEW.note_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_note_tag_fts AFTER INSERT ON note_tag BEGIN
  UPDATE note_fts SET tags = (
    SELECT GROUP_CONCAT(tag_name, ' ')
    FROM note_tag WHERE note_id = NEW.note_id
  ) WHERE note_id = NEW.note_id;
END;
