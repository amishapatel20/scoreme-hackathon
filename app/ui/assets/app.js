const presets = {
  application_success: {
    label: "Application approval",
    description: "Automated approval path",
    workflow: "application_approval",
    idempotencyKey: "ui-success-001",
    payload: {
      applicant_id: "APP-001",
      applicant_name: "Aditi Rao",
      requested_amount: 100000,
      monthly_income: 6000,
      credit_score: 720,
      employment_type: "salaried",
      dependency_mode: "pass",
    },
  },
  application_invalid: {
    label: "Validation failure",
    description: "Schema error with persisted audit evidence",
    workflow: "application_approval",
    idempotencyKey: "ui-invalid-001",
    payload: {
      applicant_id: "APP-002",
      applicant_name: null,
      requested_amount: 100000,
      monthly_income: 6000,
      credit_score: 720,
      employment_type: "salaried",
      dependency_mode: "pass",
    },
  },
  application_retry: {
    label: "Retry scenario",
    description: "Transient dependency failure and recovery",
    workflow: "application_approval",
    idempotencyKey: "ui-retry-001",
    payload: {
      applicant_id: "APP-003",
      applicant_name: "Ishita Das",
      requested_amount: 100000,
      monthly_income: 6000,
      credit_score: 720,
      employment_type: "salaried",
      dependency_mode: "transient_error",
    },
  },
  claim_success: {
    label: "Claim processing",
    description: "Same engine, different workflow definition",
    workflow: "claim_processing",
    idempotencyKey: "ui-claim-001",
    payload: {
      claim_id: "CLM-001",
      claimant_name: "Neha Singh",
      claim_amount: 45000,
      incident_type: "medical",
      document_count: 3,
      prior_claims_count: 1,
      dependency_mode: "pass",
    },
  },
  vendor_review: {
    label: "Vendor review",
    description: "Manual review routing from workflow configuration",
    workflow: "vendor_approval",
    idempotencyKey: "ui-vendor-001",
    payload: {
      vendor_id: "V-100",
      vendor_name: "Aster Supplies",
      annual_contract_value: 650000,
      years_in_business: 6,
      compliance_status: "verified",
    },
  },
};

const state = {
  currentRequestId: null,
  lastSubmission: null,
  selectedWorkflowConfig: null,
  workflowSummaries: [],
  workflowConfigs: {},
};

const elements = {
  workflowList: document.getElementById("workflow-list"),
  workflowSelect: document.getElementById("workflow-select"),
  idempotencyKey: document.getElementById("idempotency-key"),
  payloadInput: document.getElementById("payload-input"),
  requestForm: document.getElementById("request-form"),
  presetGrid: document.getElementById("preset-grid"),
  replayButton: document.getElementById("replay-button"),
  retryButton: document.getElementById("retry-button"),
  explanationButton: document.getElementById("explanation-button"),
  lookupRequestId: document.getElementById("lookup-request-id"),
  lookupButton: document.getElementById("lookup-button"),
  loadSuccessDemo: document.getElementById("load-success-demo"),
  metricWorkflows: document.getElementById("metric-workflows"),
  metricRequest: document.getElementById("metric-request"),
  metricOutcome: document.getElementById("metric-outcome"),
  serviceHealth: document.getElementById("service-health"),
  serviceHealthDetail: document.getElementById("service-health-detail"),
  footprintWorkflows: document.getElementById("footprint-workflows"),
  footprintStages: document.getElementById("footprint-stages"),
  footprintRules: document.getElementById("footprint-rules"),
  footprintDependencies: document.getElementById("footprint-dependencies"),
  footprintResilience: document.getElementById("footprint-resilience"),
  footprintFields: document.getElementById("footprint-fields"),
  opsTotalRequests: document.getElementById("ops-total-requests"),
  opsSuccessfulDecisions: document.getElementById("ops-successful-decisions"),
  opsRetryQueue: document.getElementById("ops-retry-queue"),
  opsManualReviewQueue: document.getElementById("ops-manual-review-queue"),
  opsValidationFailures: document.getElementById("ops-validation-failures"),
  opsAuditEvents: document.getElementById("ops-audit-events"),
  workflowActivityList: document.getElementById("workflow-activity-list"),
  activeWorkflowLabel: document.getElementById("active-workflow-label"),
  activeFields: document.getElementById("active-fields"),
  activeStages: document.getElementById("active-stages"),
  activeRules: document.getElementById("active-rules"),
  activeDependencies: document.getElementById("active-dependencies"),
  activeManualReview: document.getElementById("active-manual-review"),
  activeRetryRoutes: document.getElementById("active-retry-routes"),
  coverageInputState: document.getElementById("coverage-input-state"),
  coverageInputDetail: document.getElementById("coverage-input-detail"),
  coverageRulesState: document.getElementById("coverage-rules-state"),
  coverageRulesDetail: document.getElementById("coverage-rules-detail"),
  coverageExecutionState: document.getElementById("coverage-execution-state"),
  coverageExecutionDetail: document.getElementById("coverage-execution-detail"),
  coverageStateState: document.getElementById("coverage-state-state"),
  coverageStateDetail: document.getElementById("coverage-state-detail"),
  coverageAuditState: document.getElementById("coverage-audit-state"),
  coverageAuditDetail: document.getElementById("coverage-audit-detail"),
  coverageFailureState: document.getElementById("coverage-failure-state"),
  coverageFailureDetail: document.getElementById("coverage-failure-detail"),
  coverageConfigState: document.getElementById("coverage-config-state"),
  coverageConfigDetail: document.getElementById("coverage-config-detail"),
  statusPill: document.getElementById("status-pill"),
  statusMeta: document.getElementById("status-meta"),
  telemetryRules: document.getElementById("telemetry-rules"),
  telemetryHistory: document.getElementById("telemetry-history"),
  telemetryAudit: document.getElementById("telemetry-audit"),
  telemetryIdempotency: document.getElementById("telemetry-idempotency"),
  telemetryFailure: document.getElementById("telemetry-failure"),
  telemetryStage: document.getElementById("telemetry-stage"),
  snapshotWorkflow: document.getElementById("snapshot-workflow"),
  snapshotStatus: document.getElementById("snapshot-status"),
  snapshotOutcome: document.getElementById("snapshot-outcome"),
  snapshotRetry: document.getElementById("snapshot-retry"),
  summaryTitle: document.getElementById("summary-title"),
  summaryReason: document.getElementById("summary-reason"),
  traceCount: document.getElementById("trace-count"),
  traceList: document.getElementById("trace-list"),
  historyList: document.getElementById("history-list"),
  auditList: document.getElementById("audit-list"),
  blueprintName: document.getElementById("blueprint-name"),
  blueprintVersion: document.getElementById("blueprint-version"),
  blueprintSchemaCount: document.getElementById("blueprint-schema-count"),
  blueprintStageCount: document.getElementById("blueprint-stage-count"),
  blueprintDescriptionTitle: document.getElementById("blueprint-description-title"),
  blueprintDescription: document.getElementById("blueprint-description"),
  schemaList: document.getElementById("schema-list"),
  stageFlow: document.getElementById("stage-flow"),
};

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function workflowStats(config) {
  const fields = Object.keys(config.input_schema.fields).length;
  const stages = config.stages.length;
  const rules = config.stages.reduce((total, stage) => total + stage.rules.length, 0);
  const dependencyRules = config.stages.reduce(
    (total, stage) => total + stage.rules.filter((rule) => rule.type === "dependency").length,
    0
  );
  const manualReviewRoutes = config.stages.reduce(
    (total, stage) =>
      total +
      stage.rules.filter(
        (rule) =>
          rule.on_pass === "manual_review" || rule.on_fail === "manual_review" || rule.on_dependency_error === "manual_review"
      ).length,
    0
  );
  const retryRoutes = config.stages.reduce(
    (total, stage) =>
      total +
      stage.rules.filter(
        (rule) => rule.on_pass === "retry" || rule.on_fail === "retry" || rule.on_dependency_error === "retry"
      ).length,
    0
  );

  return { fields, stages, rules, dependencyRules, manualReviewRoutes, retryRoutes };
}

function setPreset(key) {
  const preset = presets[key];
  elements.workflowSelect.value = preset.workflow;
  elements.idempotencyKey.value = preset.idempotencyKey;
  elements.payloadInput.value = prettyJson(preset.payload);
  void loadWorkflowConfig(preset.workflow);
}

function renderPresets() {
  Object.entries(presets).forEach(([key, preset]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.innerHTML = `<strong>${preset.label}</strong><span>${preset.description}</span>`;
    button.addEventListener("click", () => setPreset(key));
    elements.presetGrid.appendChild(button);
  });
}

function renderWorkflows(workflows) {
  state.workflowSummaries = workflows;
  elements.metricWorkflows.textContent = workflows.length;
  elements.footprintWorkflows.textContent = workflows.length;
  elements.workflowSelect.innerHTML = workflows
    .map((workflow) => `<option value="${workflow.name}">${workflow.name}</option>`)
    .join("");

  elements.workflowList.innerHTML = workflows
    .map((workflow) => {
      const config = state.workflowConfigs[workflow.name];
      const stats = config ? workflowStats(config) : { fields: 0, stages: 0, rules: 0, dependencyRules: 0 };
      const activeClass = state.selectedWorkflowConfig?.name === workflow.name ? " active" : "";

      return `
        <article class="workflow-card${activeClass}" data-workflow-name="${workflow.name}" role="button" tabindex="0" aria-label="Open workflow ${workflow.name}">
          <h3>${workflow.name}</h3>
          <p>${workflow.description}</p>
          <div class="item-meta compact-meta">
            <span class="item-chip">${stats.fields} fields</span>
            <span class="item-chip">${stats.stages} stages</span>
            <span class="item-chip">${stats.rules} rules</span>
            <span class="item-chip">${stats.dependencyRules} dependencies</span>
          </div>
          <small>Version ${workflow.version}</small>
        </article>
      `;
    })
    .join("");

  elements.workflowList.querySelectorAll(".workflow-card").forEach((card) => {
    const workflowName = card.dataset.workflowName;
    const selectWorkflow = async () => {
      if (!workflowName) {
        return;
      }
      elements.workflowSelect.value = workflowName;
      await loadWorkflowConfig(workflowName);
    };

    card.addEventListener("click", selectWorkflow);
    card.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        await selectWorkflow();
      }
    });
  });
}

function setCoverageState(element, text, tone) {
  element.textContent = text;
  element.className = `coverage-state ${tone}`;
}

function updateCoverage(snapshot = null, config = null) {
  const configStats = config ? workflowStats(config) : { rules: 0, dependencyRules: 0, retryRoutes: 0, manualReviewRoutes: 0 };
  const traceCount = snapshot?.explanation?.triggered_rules?.length || 0;
  const historyCount = snapshot?.history?.length || 0;
  const auditCount = snapshot?.audit_trail?.length || 0;
  const failureExercised = Boolean(
    snapshot && (snapshot.idempotent_replay || snapshot.last_error || ["retry", "validation_failed", "reject"].includes(snapshot.outcome))
  );

  setCoverageState(elements.coverageInputState, snapshot ? "Observed" : "Configured", snapshot ? "observed" : "configured");
  elements.coverageInputDetail.textContent = snapshot
    ? `Payload accepted with workflow-specific schema checks for ${snapshot.workflow_name}.`
    : "Waiting for request execution evidence.";

  setCoverageState(elements.coverageRulesState, traceCount ? "Observed" : "Configured", traceCount ? "observed" : "configured");
  elements.coverageRulesDetail.textContent = config
    ? `${configStats.rules} rules are configured for the selected workflow.`
    : "Workflow rules are loaded from configuration.";

  setCoverageState(elements.coverageExecutionState, snapshot ? "Observed" : "Configured", snapshot ? "observed" : "configured");
  elements.coverageExecutionDetail.textContent = snapshot
    ? `Latest outcome is ${snapshot.outcome} with internal status ${snapshot.status}.`
    : "Outcome routing will update after a request run.";

  setCoverageState(elements.coverageStateState, historyCount ? "Observed" : "Configured", historyCount ? "observed" : "configured");
  elements.coverageStateDetail.textContent = historyCount
    ? `${historyCount} lifecycle events captured for the current request.`
    : "Lifecycle evidence will appear after request processing.";

  setCoverageState(elements.coverageAuditState, auditCount ? "Observed" : "Configured", auditCount ? "observed" : "configured");
  elements.coverageAuditDetail.textContent = auditCount
    ? `${auditCount} audit entries record rule-level evidence for the current request.`
    : "Audit evidence will appear after request processing.";

  setCoverageState(elements.coverageFailureState, failureExercised ? "Exercised" : "Configured", failureExercised ? "exercised" : "configured");
  elements.coverageFailureDetail.textContent = config
    ? `${configStats.retryRoutes + configStats.dependencyRules} dependency or retry control points are configured.`
    : "Resilience routes are available in workflow configuration.";

  setCoverageState(elements.coverageConfigState, config ? "Configured" : "Baseline", config ? "configured" : "baseline");
  elements.coverageConfigDetail.textContent = config
    ? `${config.name} is loaded from configuration version ${config.version}.`
    : "Schema, stages, and routing are all externally defined.";
}

function renderPlatformFootprint() {
  const configs = Object.values(state.workflowConfigs);
  const totals = configs.reduce(
    (aggregate, config) => {
      const stats = workflowStats(config);
      aggregate.fields += stats.fields;
      aggregate.stages += stats.stages;
      aggregate.rules += stats.rules;
      aggregate.dependencies += stats.dependencyRules;
      aggregate.resilience += stats.manualReviewRoutes + stats.retryRoutes;
      return aggregate;
    },
    { fields: 0, stages: 0, rules: 0, dependencies: 0, resilience: 0 }
  );

  elements.footprintStages.textContent = totals.stages;
  elements.footprintRules.textContent = totals.rules;
  elements.footprintDependencies.textContent = totals.dependencies;
  elements.footprintResilience.textContent = totals.resilience;
  elements.footprintFields.textContent = totals.fields;
}

function renderOperationalOverview(overview) {
  elements.opsTotalRequests.textContent = overview.total_requests;
  elements.opsSuccessfulDecisions.textContent = overview.successful_decisions;
  elements.opsRetryQueue.textContent = overview.active_retry_queue;
  elements.opsManualReviewQueue.textContent = overview.manual_review_queue;
  elements.opsValidationFailures.textContent = overview.validation_failures;
  elements.opsAuditEvents.textContent = overview.audit_events;

  if (!overview.workflow_activity.length) {
    elements.workflowActivityList.className = "activity-list empty-state";
    elements.workflowActivityList.textContent = "No persisted workflow activity yet.";
    return;
  }

  elements.workflowActivityList.className = "activity-list";
  elements.workflowActivityList.innerHTML = overview.workflow_activity
    .map(
      (workflow) => `
        <article class="activity-item">
          <div class="activity-item-head">
            <strong>${workflow.workflow_name}</strong>
            <span class="activity-status">${workflow.latest_status ?? "no status"}</span>
          </div>
          <div class="item-meta compact-meta">
            <span class="item-chip">${workflow.total_requests} requests</span>
            <span class="item-chip">${workflow.successful_decisions} success</span>
            <span class="item-chip">${workflow.retry_pending} retry</span>
            <span class="item-chip">${workflow.manual_review} review</span>
            <span class="item-chip">${workflow.validation_failures} validation</span>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadOperationalOverview() {
  try {
    const overview = await fetchJson("/analytics/overview");
    renderOperationalOverview(overview);
  } catch (error) {
    elements.workflowActivityList.className = "activity-list empty-state";
    elements.workflowActivityList.textContent = error.message;
  }
}

function renderActiveWorkflowIntelligence(config) {
  if (!config) {
    elements.activeWorkflowLabel.textContent = "Select a workflow to inspect rule density, dependency usage, and control paths.";
    elements.activeFields.textContent = "0";
    elements.activeStages.textContent = "0";
    elements.activeRules.textContent = "0";
    elements.activeDependencies.textContent = "0";
    elements.activeManualReview.textContent = "0";
    elements.activeRetryRoutes.textContent = "0";
    return;
  }

  const stats = workflowStats(config);
  elements.activeWorkflowLabel.textContent = `${config.name} v${config.version} · ${config.description}`;
  elements.activeFields.textContent = stats.fields;
  elements.activeStages.textContent = stats.stages;
  elements.activeRules.textContent = stats.rules;
  elements.activeDependencies.textContent = stats.dependencyRules;
  elements.activeManualReview.textContent = stats.manualReviewRoutes;
  elements.activeRetryRoutes.textContent = stats.retryRoutes;
}

function renderTelemetry(snapshot = null) {
  if (!snapshot) {
    elements.telemetryRules.textContent = "0";
    elements.telemetryHistory.textContent = "0";
    elements.telemetryAudit.textContent = "0";
    elements.telemetryIdempotency.textContent = "Guarded";
    elements.telemetryFailure.textContent = "Ready";
    elements.telemetryStage.textContent = "-";
    return;
  }

  elements.telemetryRules.textContent = snapshot.explanation.triggered_rules?.length || 0;
  elements.telemetryHistory.textContent = snapshot.history?.length || 0;
  elements.telemetryAudit.textContent = snapshot.audit_trail?.length || 0;
  elements.telemetryIdempotency.textContent = snapshot.idempotent_replay ? "Replayed" : "Protected";
  elements.telemetryFailure.textContent = ["retry", "validation_failed", "reject"].includes(snapshot.outcome) ? "Exercised" : "Stable";
  elements.telemetryStage.textContent = snapshot.current_stage || "completed";
}

async function loadHealth() {
  try {
    const health = await fetchJson("/health");
    elements.serviceHealth.textContent = health.status === "ok" ? "Online" : health.status;
    elements.serviceHealthDetail.textContent =
      health.status === "ok"
        ? "Runtime endpoint is responding and the service is ready to process workflow requests."
        : "Runtime reported a non-ok state.";
  } catch (error) {
    elements.serviceHealth.textContent = "Unavailable";
    elements.serviceHealthDetail.textContent = error.message;
  }
}

function renderWorkflowBlueprint(config) {
  state.selectedWorkflowConfig = config;
  elements.blueprintName.textContent = config.name;
  elements.blueprintVersion.textContent = config.version;
  elements.blueprintSchemaCount.textContent = Object.keys(config.input_schema.fields).length;
  elements.blueprintStageCount.textContent = config.stages.length;
  elements.blueprintDescriptionTitle.textContent = config.name;
  elements.blueprintDescription.textContent = config.description;

  const schemaEntries = Object.entries(config.input_schema.fields);
  elements.schemaList.className = "schema-list";
  elements.schemaList.innerHTML = schemaEntries
    .map(([fieldName, fieldSpec]) => {
      const constraints = [
        fieldSpec.required ? "required" : "optional",
        fieldSpec.type,
        fieldSpec.minimum !== null && fieldSpec.minimum !== undefined ? `min ${fieldSpec.minimum}` : null,
        fieldSpec.maximum !== null && fieldSpec.maximum !== undefined ? `max ${fieldSpec.maximum}` : null,
        Array.isArray(fieldSpec.enum) ? `enum ${fieldSpec.enum.join(" / ")}` : null,
      ].filter(Boolean);

      return `
        <article class="schema-item">
          <strong>${fieldName}</strong>
          <div class="item-meta">
            ${constraints.map((constraint) => `<span class="item-chip">${constraint}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");

  elements.stageFlow.className = "stage-flow";
  elements.stageFlow.innerHTML = config.stages
    .map(
      (stage, index) => `
        <article class="stage-item">
          <div class="stage-index">${index + 1}</div>
          <div class="stage-body">
            <strong>${stage.name}</strong>
            <p>${stage.id}</p>
            <div class="item-meta">
              ${stage.rules.map((rule) => `<span class="item-chip">${rule.id} · ${rule.type}</span>`).join("")}
            </div>
          </div>
        </article>
      `
    )
    .join("");

  renderActiveWorkflowIntelligence(config);
  updateCoverage(null, config);
  renderWorkflows(state.workflowSummaries);
}

function pillClass(outcome) {
  if (outcome === "success") {
    return "success";
  }
  if (outcome === "retry") {
    return "retry";
  }
  if (outcome === "manual_review") {
    return "manual_review";
  }
  if (["reject", "validation_failed"].includes(outcome)) {
    return outcome;
  }
  return "neutral";
}

function renderTrace(trace) {
  elements.traceCount.textContent = `${trace.length} events`;
  if (!trace.length) {
    elements.traceList.innerHTML = '<div class="empty-state">No rule evaluation events available.</div>';
    return;
  }

  elements.traceList.innerHTML = trace
    .map(
      (item) => `
        <article class="trace-item">
          <strong>${item.stage_name} · ${item.rule_id}</strong>
          <p>${item.message}</p>
          <div class="item-meta">
            <span class="item-chip">Outcome: ${item.outcome}</span>
            <span class="item-chip">Action: ${item.action}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderHistory(history) {
  if (!history.length) {
    elements.historyList.className = "history-list empty-state";
    elements.historyList.textContent = "No lifecycle events yet.";
    return;
  }

  elements.historyList.className = "history-list";
  elements.historyList.innerHTML = history
    .map(
      (item) => `
        <article class="history-item">
          <strong>${item.event_type}</strong>
          <p>${item.message}</p>
          <div class="item-meta">
            <span class="item-chip">From: ${item.from_status ?? "-"}</span>
            <span class="item-chip">To: ${item.to_status ?? "-"}</span>
            <span class="item-chip">Stage: ${item.stage_id ?? "-"}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAudit(auditTrail) {
  if (!auditTrail.length) {
    elements.auditList.className = "audit-list empty-state";
    elements.auditList.textContent = "No audit trail yet.";
    return;
  }

  elements.auditList.className = "audit-list";
  elements.auditList.innerHTML = auditTrail
    .map(
      (item) => `
        <article class="audit-item">
          <strong>${item.stage_id ?? "input_validation"} · ${item.rule_id ?? item.event_type}</strong>
          <p>${item.message}</p>
          <div class="item-meta">
            <span class="item-chip">Outcome: ${item.outcome}</span>
            <span class="item-chip">Refs: ${(item.data_refs || []).join(", ") || "-"}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSnapshot(snapshot) {
  state.currentRequestId = snapshot.request_id;
  elements.metricRequest.textContent = snapshot.request_id;
  elements.metricOutcome.textContent = snapshot.outcome;
  elements.statusPill.className = `status-pill ${pillClass(snapshot.outcome)}`;
  elements.statusPill.textContent = snapshot.outcome;
  elements.statusMeta.textContent = snapshot.idempotent_replay
    ? "This response was replayed from a prior request with the same idempotency key and payload."
    : "Current request state returned by the workflow engine.";
  elements.snapshotWorkflow.textContent = snapshot.workflow_name;
  elements.snapshotStatus.textContent = snapshot.status;
  elements.snapshotOutcome.textContent = snapshot.outcome;
  elements.snapshotRetry.textContent = snapshot.retry_count;
  elements.summaryTitle.textContent = snapshot.explanation.summary;
  elements.summaryReason.textContent = snapshot.explanation.final_reason;

  renderTrace(snapshot.explanation.triggered_rules || []);
  renderHistory(snapshot.history || []);
  renderAudit(snapshot.audit_trail || []);
  renderTelemetry(snapshot);
  updateCoverage(snapshot, state.selectedWorkflowConfig);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const message = data?.detail || data?.message || JSON.stringify(data);
    throw new Error(message);
  }

  return data;
}

async function loadWorkflows() {
  const workflows = await fetchJson("/workflows");
  const configs = await Promise.all(workflows.map((workflow) => fetchJson(`/workflows/${workflow.name}/config`)));
  state.workflowConfigs = Object.fromEntries(configs.map((config) => [config.name, config]));
  renderWorkflows(workflows);
  renderPlatformFootprint();
}

async function loadWorkflowConfig(workflowName) {
  const config = state.workflowConfigs[workflowName] || (await fetchJson(`/workflows/${workflowName}/config`));
  state.workflowConfigs[workflowName] = config;
  renderWorkflowBlueprint(config);
}

function currentSubmission() {
  const workflow = elements.workflowSelect.value;
  const idempotencyKey = elements.idempotencyKey.value.trim();
  const payload = JSON.parse(elements.payloadInput.value);
  return { workflow, idempotencyKey, payload };
}

async function submitCurrent() {
  try {
    const submission = currentSubmission();
    state.lastSubmission = submission;
    const response = await fetch(`/workflows/${submission.workflow}/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": submission.idempotencyKey,
      },
      body: JSON.stringify({ payload: submission.payload }),
    });

    const snapshot = await response.json();
    if (response.status === 422 && snapshot.request_id) {
      renderSnapshot(snapshot);
      elements.statusMeta.textContent = "Validation failed and the outcome was persisted for auditability.";
      await loadOperationalOverview();
      return;
    }
    if (!response.ok) {
      throw new Error(snapshot?.detail || snapshot?.message || JSON.stringify(snapshot));
    }

    renderSnapshot(snapshot);
    await loadOperationalOverview();
  } catch (error) {
    elements.statusPill.className = "status-pill validation_failed";
    elements.statusPill.textContent = "error";
    elements.statusMeta.textContent = error.message;
    elements.metricOutcome.textContent = "error";
    elements.telemetryFailure.textContent = "Attention";
  }
}

async function replayLast() {
  if (!state.lastSubmission) {
    elements.statusMeta.textContent = "Load or submit a request first.";
    return;
  }

  elements.workflowSelect.value = state.lastSubmission.workflow;
  elements.idempotencyKey.value = state.lastSubmission.idempotencyKey;
  elements.payloadInput.value = prettyJson(state.lastSubmission.payload);
  await submitCurrent();
}

async function retryCurrent() {
  if (!state.currentRequestId) {
    elements.statusMeta.textContent = "No current request is available for retry.";
    return;
  }

  try {
    const snapshot = await fetchJson(`/requests/${state.currentRequestId}/retry`, { method: "POST" });
    renderSnapshot(snapshot);
    await loadOperationalOverview();
  } catch (error) {
    elements.statusMeta.textContent = error.message;
  }
}

async function fetchExplanation() {
  if (!state.currentRequestId) {
    elements.statusMeta.textContent = "No current request is available.";
    return;
  }

  try {
    const explanation = await fetchJson(`/requests/${state.currentRequestId}/explanation`);
    renderTrace(explanation.explanation.triggered_rules || []);
    renderHistory(explanation.history || []);
    renderAudit(explanation.audit_trail || []);
    elements.summaryTitle.textContent = explanation.explanation.summary;
    elements.summaryReason.textContent = explanation.explanation.final_reason;
    elements.metricOutcome.textContent = explanation.outcome;
    renderTelemetry({
      explanation: explanation.explanation,
      audit_trail: explanation.audit_trail,
      history: explanation.history,
      outcome: explanation.outcome,
      idempotent_replay: false,
      current_stage: null,
    });
    updateCoverage(
      {
        explanation: explanation.explanation,
        audit_trail: explanation.audit_trail,
        history: explanation.history,
        outcome: explanation.outcome,
        last_error: null,
        idempotent_replay: false,
      },
      state.selectedWorkflowConfig
    );
  } catch (error) {
    elements.statusMeta.textContent = error.message;
  }
}

async function loadRequestById() {
  const requestId = elements.lookupRequestId.value.trim();
  if (!requestId) {
    elements.statusMeta.textContent = "Enter a request id first.";
    return;
  }

  try {
    const snapshot = await fetchJson(`/requests/${requestId}`);
    elements.workflowSelect.value = snapshot.workflow_name;
    elements.idempotencyKey.value = snapshot.idempotency_key;
    elements.payloadInput.value = prettyJson(snapshot.payload);
    await loadWorkflowConfig(snapshot.workflow_name);
    renderSnapshot(snapshot);
  } catch (error) {
    elements.statusMeta.textContent = error.message;
  }
}

elements.requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitCurrent();
});

elements.replayButton.addEventListener("click", replayLast);
elements.retryButton.addEventListener("click", retryCurrent);
elements.explanationButton.addEventListener("click", fetchExplanation);
elements.lookupButton.addEventListener("click", loadRequestById);
elements.loadSuccessDemo.addEventListener("click", () => setPreset("application_success"));
elements.workflowSelect.addEventListener("change", async (event) => {
  await loadWorkflowConfig(event.target.value);
});

async function initialize() {
  renderPresets();
  renderTelemetry();
  renderActiveWorkflowIntelligence(null);
  await loadWorkflows();
  await loadHealth();
  await loadOperationalOverview();
  setPreset("application_success");
  await loadWorkflowConfig("application_approval");
}

initialize();