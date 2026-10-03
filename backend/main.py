import os
import sqlite3
from fastapi import FastAPI
from pydantic import BaseModel

DB_PATH = "/workspace/data/app.db"


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS saved_traces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")


app = FastAPI()
init_db()


class SavedTrace(BaseModel):
    title: str
    payload: str


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/saved-traces")
def list_saved_traces():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, payload, created_at FROM saved_traces ORDER BY id DESC"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/saved-traces")
def save_trace(trace: SavedTrace):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO saved_traces (title, payload) VALUES (?, ?)",
            (trace.title.strip() or "Untitled trace", trace.payload),
        )
        trace_id = cursor.lastrowid
    return {"id": trace_id, "ok": True}
