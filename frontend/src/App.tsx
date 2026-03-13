import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getJson, postJson } from './api'
import { SAMPLE_PAYLOADS } from './samples'

type HealthResponse = {
  status?: string
}

type WorkflowSummary = {
  name: string
  version: string
  description: string
}

type WorkflowOperationalActivity = {
  workflow_name: string
  total_requests: number
  successful_decisions: number
  rejected_decisions: number
  retry_pending: number
  manual_review: number
  validation_failures: number
  latest_status?: string | null
  latest_updated_at?: string | null
}

type OperationalOverview = {
  total_requests: number
  successful_decisions: number
  rejected_decisions: number
  active_retry_queue: number
  manual_review_queue: number
  validation_failures: number
  audit_events: number
  lifecycle_events: number
  workflows_with_activity: number
  latest_updated_at?: string | null
  workflow_activity: WorkflowOperationalActivity[]
}

type DecisionSnapshot = Record<string, unknown>

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function newIdempotencyKey() {
  return `ui-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [overview, setOverview] = useState<OperationalOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('application_approval')
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newIdempotencyKey())
  const [payloadText, setPayloadText] = useState<string>(() => prettyJson(SAMPLE_PAYLOADS.application_approval))
  const [submitResult, setSubmitResult] = useState<DecisionSnapshot | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [configWorkflow, setConfigWorkflow] = useState<string | null>(null)
  const [configJson, setConfigJson] = useState<Record<string, unknown> | null>(null)

  const [lookupId, setLookupId] = useState<string>('')
  const [lookupResult, setLookupResult] = useState<DecisionSnapshot | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [explanationId, setExplanationId] = useState<string | null>(null)
  const [explanationJson, setExplanationJson] = useState<Record<string, unknown> | null>(null)
  const [explanationError, setExplanationError] = useState<string | null>(null)

  const apiHint = useMemo(() => {
    return (
      'This is your UI (not the Vite template). It talks to your API via /health, /workflows, /analytics/overview, ' +
      '/workflows/:name/config, /workflows/:name/requests, /requests/:id, /requests/:id/explanation, and /requests/:id/retry.'
    )
  }, [])

  async function loadAll() {
    setIsLoading(true)
    setError(null)

    try {
      const [healthJson, workflowsJson, overviewJson] = await Promise.all([
        getJson<HealthResponse>('/health'),
        getJson<WorkflowSummary[]>('/workflows'),
        getJson<OperationalOverview>('/analytics/overview'),
      ])

      setHealth(healthJson)
      setWorkflows(workflowsJson)
      setOverview(overviewJson)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setHealth(null)
      setWorkflows(null)
      setOverview(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadWorkflowConfig(workflowName: string) {
    setConfigWorkflow(workflowName)
    setConfigJson(null)
    try {
      const json = await getJson<Record<string, unknown>>(`/workflows/${encodeURIComponent(workflowName)}/config`)
      setConfigJson(json)
    } catch (err) {
      setConfigJson({ error: err })
    }
  }

  async function submitRequest() {
    setSubmitError(null)
    setSubmitResult(null)
    setExplanationId(null)
    setExplanationJson(null)
    setExplanationError(null)

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>
      if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('Payload must be a JSON object.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON.'
      setSubmitError(`Invalid payload JSON: ${msg}`)
      return
    }

    try {
      const result = await postJson<DecisionSnapshot>(
        `/workflows/${encodeURIComponent(selectedWorkflow)}/requests`,
        { payload },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )

      setSubmitResult(result)

      const requestId = typeof result.request_id === 'string' ? result.request_id : null
      if (requestId) {
        setExplanationId(requestId)
      }
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Submission failed.'
      setSubmitError(msg)
    }
  }

  async function lookupRequest() {
    setLookupError(null)
    setLookupResult(null)
    setExplanationId(null)
    setExplanationJson(null)
    setExplanationError(null)

    const trimmed = lookupId.trim()
    if (!trimmed) {
      setLookupError('Enter a request id.')
      return
    }

    try {
      const result = await getJson<DecisionSnapshot>(`/requests/${encodeURIComponent(trimmed)}`)
      setLookupResult(result)
      setExplanationId(trimmed)
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Lookup failed.'
      setLookupError(msg)
    }
  }

  async function loadExplanation(requestId: string) {
    setExplanationError(null)
    setExplanationJson(null)
    setExplanationId(requestId)
    try {
      const result = await getJson<Record<string, unknown>>(`/requests/${encodeURIComponent(requestId)}/explanation`)
      setExplanationJson(result)
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Explanation load failed.'
      setExplanationError(msg)
    }
  }

  async function retryRequest(requestId: string) {
    setLookupError(null)
    setSubmitError(null)
    try {
      const result = await postJson<DecisionSnapshot>(`/requests/${encodeURIComponent(requestId)}/retry`, {})
      setLookupResult(result)
      setSubmitResult(result)
      setExplanationId(requestId)
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Retry failed.'
      setLookupError(msg)
    }
  }

  useEffect(() => {
    document.title = 'Decision Platform UI'
    void loadAll()
  }, [])

  useEffect(() => {
    const sample = SAMPLE_PAYLOADS[selectedWorkflow]
    if (sample) {
      setPayloadText(prettyJson(sample))
    }
  }, [selectedWorkflow])

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="brand">Decision Platform</div>
          <div className="tagline">Operational decisioning • Auditability • Explainability</div>
        </div>
      </header>

      <div className="subheader">
        <div className="subheaderLeft">
          <h1 className="title">Operations Console</h1>
          <p className="subtitle">{apiHint}</p>
        </div>
        <div className="subheaderRight">
          <div className={health ? 'pill ok' : 'pill warn'}>
            {health ? `API: ${health.status ?? 'ok'}` : 'API: disconnected'}
          </div>
          <button className="button primary" onClick={() => void loadAll()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <section className="card error">
          <h2>API connection error</h2>
          <p>{error}</p>
          <p className="muted">
            Start your API first (FastAPI at 127.0.0.1:8000 or Next.js at localhost:3000) and
            set the proxy target in <code>vite.config.ts</code> if needed.
          </p>
        </section>
      ) : null}

      <section className="grid">
        <div className="card span12">
          <div className="sectionTitleRow">
            <h2>Key Metrics</h2>
            <span className="muted">Live from persisted activity</span>
          </div>
          {overview ? (
            <div className="kpis">
              <div className="kpi">
                <div className="kpiLabel">Total Requests</div>
                <div className="kpiValue">{overview.total_requests}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Approved</div>
                <div className="kpiValue">{overview.successful_decisions}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Rejected</div>
                <div className="kpiValue">{overview.rejected_decisions}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Manual Review</div>
                <div className="kpiValue">{overview.manual_review_queue}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Retry Pending</div>
                <div className="kpiValue">{overview.active_retry_queue}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Audit Events</div>
                <div className="kpiValue">{overview.audit_events}</div>
              </div>
            </div>
          ) : (
            <p className="muted">{isLoading ? 'Loading…' : 'No overview available.'}</p>
          )}
        </div>

        <div className="card span7">
          <div className="sectionTitleRow">
            <h2>Workflows</h2>
            <span className="muted">Choose a workflow to submit requests</span>
          </div>
          {workflows === null ? (
            <p className="muted">{isLoading ? 'Loading…' : 'Not loaded.'}</p>
          ) : workflows.length === 0 ? (
            <p className="muted">No workflows found.</p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((wf) => (
                    <tr key={`${wf.name}:${wf.version}`}>
                      <td className="mono">{wf.name}</td>
                      <td className="mono">{wf.version}</td>
                      <td>{wf.description}</td>
                      <td className="right">
                        <button className="link" onClick={() => void loadWorkflowConfig(wf.name)}>
                          View config
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {configWorkflow ? (
            <div className="subcard">
              <div className="sectionTitleRow">
                <h3>Workflow Config: <span className="mono">{configWorkflow}</span></h3>
                <button className="link" onClick={() => { setConfigWorkflow(null); setConfigJson(null) }}>
                  Close
                </button>
              </div>
              <pre className="code">{configJson ? prettyJson(configJson) : 'Loading…'}</pre>
            </div>
          ) : null}
        </div>

        <div className="card span5">
          <div className="sectionTitleRow">
            <h2>Submit Request</h2>
            <span className="muted">Idempotent submissions supported</span>
          </div>

          <div className="form">
            <label className="field">
              <span>Workflow</span>
              <select
                className="control"
                value={selectedWorkflow}
                onChange={(e) => setSelectedWorkflow(e.target.value)}
              >
                {(workflows ?? []).map((wf) => (
                  <option key={wf.name} value={wf.name}>
                    {wf.name}
                  </option>
                ))}
                {workflows === null ? (
                  <option value={selectedWorkflow}>{selectedWorkflow}</option>
                ) : null}
              </select>
            </label>

            <label className="field">
              <span>Idempotency Key</span>
              <div className="row">
                <input className="control mono" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
                <button className="button" onClick={() => setIdempotencyKey(newIdempotencyKey())} type="button">
                  New
                </button>
              </div>
            </label>

            <label className="field">
              <span>Payload (JSON)</span>
              <textarea
                className="control textarea mono"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={10}
              />
            </label>

            <div className="row">
              <button className="button primary" onClick={() => void submitRequest()} type="button">
                Submit
              </button>
              <button
                className="button"
                onClick={() => setPayloadText(prettyJson(SAMPLE_PAYLOADS[selectedWorkflow] ?? {}))}
                type="button"
              >
                Load sample
              </button>
            </div>

            {submitError ? <div className="alert">{submitError}</div> : null}

            {submitResult ? (
              <div className="subcard">
                <div className="sectionTitleRow">
                  <h3>Result</h3>
                  {typeof submitResult.request_id === 'string' ? (
                    <button className="link" onClick={() => void loadExplanation(String(submitResult.request_id))}>
                      View explanation
                    </button>
                  ) : null}
                </div>
                <pre className="code">{prettyJson(submitResult)}</pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card span6">
          <div className="sectionTitleRow">
            <h2>Request Lookup</h2>
            <span className="muted">Load by request id</span>
          </div>

          <div className="form">
            <label className="field">
              <span>Request ID</span>
              <div className="row">
                <input
                  className="control mono"
                  placeholder="e.g. 78dc1b2b-a02b-..."
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                />
                <button className="button primary" onClick={() => void lookupRequest()} type="button">
                  Lookup
                </button>
              </div>
            </label>

            {lookupError ? <div className="alert">{lookupError}</div> : null}

            {lookupResult ? (
              <div className="subcard">
                <div className="sectionTitleRow">
                  <h3>Request</h3>
                  <div className="row">
                    {typeof lookupResult.request_id === 'string' ? (
                      <>
                        <button className="link" onClick={() => void loadExplanation(String(lookupResult.request_id))}>
                          Explanation
                        </button>
                        <button className="link" onClick={() => void retryRequest(String(lookupResult.request_id))}>
                          Retry
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <pre className="code">{prettyJson(lookupResult)}</pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card span6">
          <div className="sectionTitleRow">
            <h2>Explanation</h2>
            <span className="muted">Audit evidence from rule execution</span>
          </div>

          {explanationError ? <div className="alert">{explanationError}</div> : null}

          {explanationId ? (
            <div className="form">
              <div className="row">
                <div className="pill">Request: <span className="mono">{explanationId}</span></div>
                <button className="button" onClick={() => void loadExplanation(explanationId)} type="button">
                  Reload
                </button>
              </div>
              <pre className="code">{explanationJson ? prettyJson(explanationJson) : 'Load an explanation from a submitted/lookup request.'}</pre>
            </div>
          ) : (
            <p className="muted">Submit or lookup a request to see explanation.</p>
          )}
        </div>
      </section>

      <footer className="footer">
        <span className="muted">FastAPI console: <code>http://127.0.0.1:8000/</code> • Node console: <code>http://localhost:3000/</code> • This UI: <code>http://localhost:5173/</code></span>
      </footer>
    </div>
  )
}

export default App
