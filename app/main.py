from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import sqlite3
import uuid
import time
from typing import Optional, List

DATA_DIR = os.environ.get("HOTM_DATA_DIR", os.path.join(os.getcwd(), "data"))
NOTES_DIR = os.path.join(DATA_DIR, "notes")
DB_PATH = os.path.join(DATA_DIR, "hotm.sqlite3")

os.makedirs(NOTES_DIR, exist_ok=True)

app = FastAPI(title="HotM API", version="0.1.0")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            path TEXT NOT NULL,
            tags TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            id UNINDEXED,
            title,
            content
        )
        """
    )
    conn.commit()
    conn.close()


class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class Note(BaseModel):
    id: str
    title: str
    path: str
    tags: Optional[List[str]]
    created_at: float
    updated_at: float


@app.on_event("startup")
def on_startup():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(NOTES_DIR, exist_ok=True)
    init_db()
    # Mount routers
    try:
        from .routers_llm import router as llm_router
        app.include_router(llm_router)
    except Exception:
        # LLM routes are optional; avoid startup failure if missing deps
        pass


@app.post("/notes", response_model=Note)
def create_note(payload: NoteCreate):
    note_id = str(uuid.uuid4())
    timestamp = time.time()
    filename = f"{note_id}.md"
    file_path = os.path.join(NOTES_DIR, filename)

    front_matter = "---\n" + f"title: {payload.title}\n" + (f"tags: {','.join(payload.tags)}\n" if payload.tags else "") + "---\n\n"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(front_matter + payload.content + "\n")

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notes (id, title, path, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            note_id,
            payload.title,
            file_path,
            ",".join(payload.tags) if payload.tags else None,
            timestamp,
            timestamp,
        ),
    )
    cur.execute(
        "INSERT INTO notes_fts (id, title, content) VALUES (?, ?, ?)",
        (note_id, payload.title, payload.content),
    )
    conn.commit()
    conn.close()

    return Note(
        id=note_id,
        title=payload.title,
        path=file_path,
        tags=payload.tags,
        created_at=timestamp,
        updated_at=timestamp,
    )


@app.get("/notes/{note_id}", response_model=Note)
def get_note(note_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    tags = row["tags"].split(",") if row["tags"] else None
    return Note(
        id=row["id"],
        title=row["title"],
        path=row["path"],
        tags=tags,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.put("/notes/{note_id}", response_model=Note)
def update_note(note_id: str, payload: NoteUpdate):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    title = payload.title if payload.title is not None else row["title"]
    tags_list = payload.tags if payload.tags is not None else (row["tags"].split(",") if row["tags"] else None)

    # Read existing content if not provided
    with open(row["path"], "r", encoding="utf-8") as f:
        existing = f.read()
    # naive split to remove front matter if present
    content_start = existing.find("---\n", 3)
    if content_start != -1:
        content = existing[content_start + 4 :].lstrip()
    else:
        content = existing

    new_content = payload.content if payload.content is not None else content

    # Rewrite file
    front_matter = "---\n" + f"title: {title}\n" + (f"tags: {','.join(tags_list)}\n" if tags_list else "") + "---\n\n"
    with open(row["path"], "w", encoding="utf-8") as f:
        f.write(front_matter + new_content + "\n")

    timestamp = time.time()
    cur.execute(
        "UPDATE notes SET title = ?, tags = ?, updated_at = ? WHERE id = ?",
        (title, ",".join(tags_list) if tags_list else None, timestamp, note_id),
    )
    cur.execute(
        "UPDATE notes_fts SET title = ?, content = ? WHERE id = ?",
        (title, new_content, note_id),
    )
    conn.commit()
    conn.close()

    return Note(
        id=note_id,
        title=title,
        path=row["path"],
        tags=tags_list,
        created_at=row["created_at"],
        updated_at=timestamp,
    )


@app.delete("/notes/{note_id}")
def delete_note(note_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    try:
        os.remove(row["path"])  # Delete file
    except FileNotFoundError:
        pass

    cur.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    cur.execute("DELETE FROM notes_fts WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return JSONResponse({"status": "deleted", "id": note_id})


@app.get("/search")
def search(q: str, limit: int = 20):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT ?",
        (q, limit),
    )
    results = [{"id": r["id"], "title": r["title"]} for r in cur.fetchall()]
    conn.close()
    return {"results": results}
