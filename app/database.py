from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class Database:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS requests (
                    id TEXT PRIMARY KEY,
                    workflow_name TEXT NOT NULL,
                    workflow_version TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    payload_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_stage TEXT,
                    decision TEXT,
                    explanation_json TEXT NOT NULL,
                    last_error TEXT,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(workflow_name, idempotency_key)
                );

                CREATE TABLE IF NOT EXISTS request_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    from_status TEXT,
                    to_status TEXT,
                    stage_id TEXT,
                    message TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(request_id) REFERENCES requests(id)
                );

                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT NOT NULL,
                    workflow_name TEXT NOT NULL,
                    stage_id TEXT,
                    rule_id TEXT,
                    event_type TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    message TEXT NOT NULL,
                    data_refs_json TEXT NOT NULL,
                    details_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(request_id) REFERENCES requests(id)
                );
                """
            )

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        connection = self.connect()
        try:
            connection.execute("BEGIN")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
