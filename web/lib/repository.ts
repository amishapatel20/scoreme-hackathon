import type { Db } from "./db";
import type {
  AuditEvent,
  DecisionExplanation,
  DecisionSnapshot,
  DecisionStatus,
  HistoryEvent,
  OperationalOverview,
  WorkflowOperationalActivity,
} from "./types";
import { mapStatusToOutcome } from "./types";

function dumpJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export class DecisionRepository {
  constructor(private readonly db: Db) {}

  insertRequest(params: {
    request_id: string;
    workflow_name: string;
    workflow_version: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
    payload_hash: string;
    status: DecisionStatus;
    current_stage: string | null;
    decision: string | null;
    explanation: DecisionExplanation;
    retry_count: number;
    created_at: string;
  }): void {
    this.db
      .prepare(
        `
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
        `
      )
      .run(
        params.request_id,
        params.workflow_name,
        params.workflow_version,
        params.idempotency_key,
        dumpJson(params.payload),
        params.payload_hash,
        params.status,
        params.current_stage,
        params.decision,
        dumpJson(params.explanation),
        null,
        params.retry_count,
        params.created_at,
        params.created_at
      );
  }

  updateRequest(
    requestId: string,
    params: {
      status: DecisionStatus;
      current_stage: string | null;
      decision: string | null;
      explanation: DecisionExplanation;
      updated_at: string;
      last_error: string | null;
      retry_count: number;
    }
  ): void {
    this.db
      .prepare(
        `
        UPDATE requests
        SET status = ?,
            current_stage = ?,
            decision = ?,
            explanation_json = ?,
            last_error = ?,
            retry_count = ?,
            updated_at = ?
        WHERE id = ?
        `
      )
      .run(
        params.status,
        params.current_stage,
        params.decision,
        dumpJson(params.explanation),
        params.last_error,
        params.retry_count,
        params.updated_at,
        requestId
      );
  }

  recordHistory(params: {
    request_id: string;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    stage_id: string | null;
    message: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }): void {
    this.db
      .prepare(
        `
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
        `
      )
      .run(
        params.request_id,
        params.event_type,
        params.from_status,
        params.to_status,
        params.stage_id,
        params.message,
        dumpJson(params.metadata),
        params.created_at
      );
  }

  recordAudit(params: {
    request_id: string;
    workflow_name: string;
    stage_id: string | null;
    rule_id: string | null;
    event_type: string;
    outcome: string;
    message: string;
    data_refs: string[];
    details: Record<string, unknown>;
    created_at: string;
  }): void {
    this.db
      .prepare(
        `
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
        `
      )
      .run(
        params.request_id,
        params.workflow_name,
        params.stage_id,
        params.rule_id,
        params.event_type,
        params.outcome,
        params.message,
        dumpJson(params.data_refs),
        dumpJson(params.details),
        params.created_at
      );
  }

  findByIdempotency(workflowName: string, idempotencyKey: string): DecisionSnapshot | null {
    const row = this.db
      .prepare("SELECT * FROM requests WHERE workflow_name = ? AND idempotency_key = ?")
      .get(workflowName, idempotencyKey) as any;

    if (!row) {
      return null;
    }

    return this.buildSnapshot(row);
  }

  getRequest(requestId: string): DecisionSnapshot | null {
    const row = this.db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId) as any;
    if (!row) {
      return null;
    }
    return this.buildSnapshot(row);
  }

  getOperationalOverview(): OperationalOverview {
    const requestCounts =
      (this.db
        .prepare(
          `
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
          `
        )
        .get() as any) ?? {};

    const auditCount = (this.db.prepare("SELECT COUNT(*) AS total FROM audit_events").get() as any) ?? {};
    const historyCount = (this.db.prepare("SELECT COUNT(*) AS total FROM request_history").get() as any) ?? {};

    const activityRows =
      (this.db
        .prepare(
          `
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
          `
        )
        .all() as any[]) ?? [];

    const workflowActivity: WorkflowOperationalActivity[] = activityRows.map((row) => ({
      workflow_name: row.workflow_name,
      total_requests: row.total_requests ?? 0,
      successful_decisions: row.successful_decisions ?? 0,
      rejected_decisions: row.rejected_decisions ?? 0,
      retry_pending: row.retry_pending ?? 0,
      manual_review: row.manual_review ?? 0,
      validation_failures: row.validation_failures ?? 0,
      latest_status: row.latest_status ?? null,
      latest_updated_at: row.latest_updated_at ?? null,
    }));

    return {
      total_requests: requestCounts.total_requests ?? 0,
      successful_decisions: requestCounts.successful_decisions ?? 0,
      rejected_decisions: requestCounts.rejected_decisions ?? 0,
      active_retry_queue: requestCounts.active_retry_queue ?? 0,
      manual_review_queue: requestCounts.manual_review_queue ?? 0,
      validation_failures: requestCounts.validation_failures ?? 0,
      audit_events: auditCount.total ?? 0,
      lifecycle_events: historyCount.total ?? 0,
      workflows_with_activity: requestCounts.workflows_with_activity ?? 0,
      latest_updated_at: requestCounts.latest_updated_at ?? null,
      workflow_activity: workflowActivity,
    };
  }

  private buildSnapshot(row: any): DecisionSnapshot {
    const historyRows =
      (this.db
        .prepare("SELECT * FROM request_history WHERE request_id = ? ORDER BY id ASC")
        .all(row.id) as any[]) ?? [];

    const auditRows =
      (this.db.prepare("SELECT * FROM audit_events WHERE request_id = ? ORDER BY id ASC").all(row.id) as any[]) ??
      [];

    const history: HistoryEvent[] = historyRows.map((h) => ({
      event_type: h.event_type,
      from_status: h.from_status,
      to_status: h.to_status,
      stage_id: h.stage_id,
      message: h.message,
      metadata: parseJson<Record<string, unknown>>(h.metadata_json),
      created_at: h.created_at,
    }));

    const auditTrail: AuditEvent[] = auditRows.map((a) => ({
      workflow_name: a.workflow_name,
      stage_id: a.stage_id,
      rule_id: a.rule_id,
      event_type: a.event_type,
      outcome: a.outcome,
      message: a.message,
      data_refs: parseJson<string[]>(a.data_refs_json),
      details: parseJson<Record<string, unknown>>(a.details_json),
      created_at: a.created_at,
    }));

    const status = row.status as DecisionStatus;

    return {
      request_id: row.id,
      workflow_name: row.workflow_name,
      workflow_version: row.workflow_version,
      idempotency_key: row.idempotency_key,
      payload: parseJson<Record<string, unknown>>(row.payload_json),
      status,
      current_stage: row.current_stage,
      decision: row.decision,
      retry_count: row.retry_count ?? 0,
      last_error: row.last_error,
      created_at: row.created_at,
      updated_at: row.updated_at,
      explanation: parseJson<DecisionExplanation>(row.explanation_json),
      history,
      audit_trail: auditTrail,
      idempotent_replay: false,
      outcome: mapStatusToOutcome(status),
      payload_hash: row.payload_hash,
    };
  }
}
