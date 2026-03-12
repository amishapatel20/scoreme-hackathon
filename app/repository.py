from __future__ import annotations

import json
import sqlite3
from typing import Any

from app.database import Database
from app.models import AuditEvent, DecisionExplanation, DecisionSnapshot, HistoryEvent, OperationalOverview, WorkflowOperationalActivity


def _dump_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True)


class DecisionRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def insert_request(
        self,
        connection: sqlite3.Connection,
        *,
        request_id: str,
        workflow_name: str,
        workflow_version: str,
        idempotency_key: str,
        payload: dict[str, Any],
        payload_hash: str,
        status: str,
        current_stage: str | None,
        decision: str | None,
        explanation: DecisionExplanation,
        retry_count: int,
        created_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO requests (
                id,
                workflow_name,
                workflow_version,
                idempotency_key,
                payload_json,
                payload_hash,
                status,
                current_stage,
                decision,
                explanation_json,
                last_error,
                retry_count,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_id,
                workflow_name,
                workflow_version,
                idempotency_key,
                _dump_json(payload),
                payload_hash,
                status,
                current_stage,
                decision,
                _dump_json(explanation.model_dump(mode="json")),
                None,
                retry_count,
                created_at,
                created_at,
            ),
        )

    def update_request(
        self,
        connection: sqlite3.Connection,
        request_id: str,
        *,
        status: str,
        current_stage: str | None,
        decision: str | None,
        explanation: DecisionExplanation,
        updated_at: str,
        last_error: str | None,
        retry_count: int,
    ) -> None:
        connection.execute(
            """
            UPDATE requests
            SET status = ?,
                current_stage = ?,
                decision = ?,
                explanation_json = ?,
                last_error = ?,
                retry_count = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                status,
                current_stage,
                decision,
                _dump_json(explanation.model_dump(mode="json")),
                last_error,
                retry_count,
                updated_at,
                request_id,
            ),
        )

    def record_history(
        self,
        connection: sqlite3.Connection,
        *,
        request_id: str,
        event_type: str,
        from_status: str | None,
        to_status: str | None,
        stage_id: str | None,
        message: str,
        metadata: dict[str, Any],
        created_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO request_history (
                request_id,
                event_type,
                from_status,
                to_status,
                stage_id,
                message,
                metadata_json,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_id,
                event_type,
                from_status,
                to_status,
                stage_id,
                message,
                _dump_json(metadata),
                created_at,
            ),
        )

    def record_audit(
        self,
        connection: sqlite3.Connection,
        *,
        request_id: str,
        workflow_name: str,
        stage_id: str | None,
        rule_id: str | None,
        event_type: str,
        outcome: str,
        message: str,
        data_refs: list[str],
        details: dict[str, Any],
        created_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_events (
                request_id,
                workflow_name,
                stage_id,
                rule_id,
                event_type,
                outcome,
                message,
                data_refs_json,
                details_json,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_id,
                workflow_name,
                stage_id,
                rule_id,
                event_type,
                outcome,
                message,
                _dump_json(data_refs),
                _dump_json(details),
                created_at,
            ),
        )

    def find_by_idempotency(self, workflow_name: str, idempotency_key: str) -> DecisionSnapshot | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM requests WHERE workflow_name = ? AND idempotency_key = ?",
                (workflow_name, idempotency_key),
            ).fetchone()
            if row is None:
                return None
            return self._build_snapshot(connection, row)

    def get_request(self, request_id: str) -> DecisionSnapshot | None:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
            if row is None:
                return None
            return self._build_snapshot(connection, row)

    def get_operational_overview(self) -> OperationalOverview:
        with self.database.connect() as connection:
            request_counts = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_requests,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS successful_decisions,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_decisions,
                    SUM(CASE WHEN status = 'retry_pending' THEN 1 ELSE 0 END) AS active_retry_queue,
                    SUM(CASE WHEN status = 'manual_review' THEN 1 ELSE 0 END) AS manual_review_queue,
                    SUM(CASE WHEN status = 'validation_failed' THEN 1 ELSE 0 END) AS validation_failures,
                    COUNT(DISTINCT workflow_name) AS workflows_with_activity,
                    MAX(updated_at) AS latest_updated_at
                FROM requests
                """
            ).fetchone()
            audit_count = connection.execute("SELECT COUNT(*) AS total FROM audit_events").fetchone()
            history_count = connection.execute("SELECT COUNT(*) AS total FROM request_history").fetchone()
            activity_rows = connection.execute(
                """
                SELECT
                    r.workflow_name AS workflow_name,
                    COUNT(*) AS total_requests,
                    SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) AS successful_decisions,
                    SUM(CASE WHEN r.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_decisions,
                    SUM(CASE WHEN r.status = 'retry_pending' THEN 1 ELSE 0 END) AS retry_pending,
                    SUM(CASE WHEN r.status = 'manual_review' THEN 1 ELSE 0 END) AS manual_review,
                    SUM(CASE WHEN r.status = 'validation_failed' THEN 1 ELSE 0 END) AS validation_failures,
                    (
                        SELECT r2.status
                        FROM requests AS r2
                        WHERE r2.workflow_name = r.workflow_name
                        ORDER BY r2.updated_at DESC, r2.created_at DESC
                        LIMIT 1
                    ) AS latest_status,
                    MAX(r.updated_at) AS latest_updated_at
                FROM requests AS r
                GROUP BY r.workflow_name
                ORDER BY total_requests DESC, r.workflow_name ASC
                """
            ).fetchall()

        return OperationalOverview(
            total_requests=request_counts["total_requests"] or 0,
            successful_decisions=request_counts["successful_decisions"] or 0,
            rejected_decisions=request_counts["rejected_decisions"] or 0,
            active_retry_queue=request_counts["active_retry_queue"] or 0,
            manual_review_queue=request_counts["manual_review_queue"] or 0,
            validation_failures=request_counts["validation_failures"] or 0,
            audit_events=audit_count["total"] or 0,
            lifecycle_events=history_count["total"] or 0,
            workflows_with_activity=request_counts["workflows_with_activity"] or 0,
            latest_updated_at=request_counts["latest_updated_at"],
            workflow_activity=[
                WorkflowOperationalActivity(
                    workflow_name=row["workflow_name"],
                    total_requests=row["total_requests"] or 0,
                    successful_decisions=row["successful_decisions"] or 0,
                    rejected_decisions=row["rejected_decisions"] or 0,
                    retry_pending=row["retry_pending"] or 0,
                    manual_review=row["manual_review"] or 0,
                    validation_failures=row["validation_failures"] or 0,
                    latest_status=row["latest_status"],
                    latest_updated_at=row["latest_updated_at"],
                )
                for row in activity_rows
            ],
        )

    def _build_snapshot(self, connection: sqlite3.Connection, row: sqlite3.Row) -> DecisionSnapshot:
        history_rows = connection.execute(
            "SELECT * FROM request_history WHERE request_id = ? ORDER BY id ASC",
            (row["id"],),
        ).fetchall()
        audit_rows = connection.execute(
            "SELECT * FROM audit_events WHERE request_id = ? ORDER BY id ASC",
            (row["id"],),
        ).fetchall()

        history = [
            HistoryEvent(
                event_type=history_row["event_type"],
                from_status=history_row["from_status"],
                to_status=history_row["to_status"],
                stage_id=history_row["stage_id"],
                message=history_row["message"],
                metadata=json.loads(history_row["metadata_json"]),
                created_at=history_row["created_at"],
            )
            for history_row in history_rows
        ]

        audit_trail = [
            AuditEvent(
                workflow_name=audit_row["workflow_name"],
                stage_id=audit_row["stage_id"],
                rule_id=audit_row["rule_id"],
                event_type=audit_row["event_type"],
                outcome=audit_row["outcome"],
                message=audit_row["message"],
                data_refs=json.loads(audit_row["data_refs_json"]),
                details=json.loads(audit_row["details_json"]),
                created_at=audit_row["created_at"],
            )
            for audit_row in audit_rows
        ]

        return DecisionSnapshot(
            request_id=row["id"],
            workflow_name=row["workflow_name"],
            workflow_version=row["workflow_version"],
            idempotency_key=row["idempotency_key"],
            payload=json.loads(row["payload_json"]),
            status=row["status"],
            current_stage=row["current_stage"],
            decision=row["decision"],
            retry_count=row["retry_count"],
            last_error=row["last_error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            explanation=DecisionExplanation.model_validate(json.loads(row["explanation_json"])),
            history=history,
            audit_trail=audit_trail,
            payload_hash=row["payload_hash"],
        )
