export type PayloadField = {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  required: boolean
  label?: string
  helper_text?: string
}

export type WorkflowSummary = {
  workflow_id: string
  name: string
  description: string
  version: string
  stage_count: number
  rule_count: number
  external_dependencies: string[]
  payload_schema: PayloadField[]
}

export type RequestRecord = {
  request_id: string
  workflow_id: string
  status: string
  attempt_count: number
  payload: Record<string, unknown>
  response: Record<string, unknown>
  failure_reason?: string | null
  admin_note?: string | null
  processing_ms?: number | null
  created_at: string
  updated_at: string
  state_history?: Array<{ from_state: string | null; to_state: string; reason: string; timestamp: string }>
  audit_trail?: Array<{
    timestamp: string
    event_type: string
    stage: string | null
    rule_id: string | null
    field: string | null
    operator: string | null
    expected_value: unknown
    actual_value: unknown
    result: string
    explanation: string
    details: Record<string, unknown>
  }>
}

export type AdminMetrics = {
  total_requests: number
  approval_rate: number
  rejection_rate: number
  pending_review: number
  failed: number
  avg_processing_time_ms: number
  failure_rate_by_workflow: Record<string, number>
  requests_by_workflow: Record<string, number>
  status_breakdown: Record<string, number>
  requests_last_7_days: Array<{ date: string; count: number }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `${init?.method ?? 'GET'} ${path} failed (${res.status})`)
  }
  return (await res.json()) as T
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  listWorkflows: () => request<WorkflowSummary[]>('/api/workflows'),
  getWorkflow: (workflowId: string) => request<{ workflow: unknown; yaml_content: string }>(`/api/workflows/${workflowId}`),
  testWorkflow: (workflowId: string, payload: Record<string, unknown>) =>
    request(`/api/workflows/${workflowId}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload }),
    }),
  updateWorkflow: (workflowId: string, yamlContent: string) =>
    request(`/api/workflows/${workflowId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yaml_content: yamlContent }),
    }),
  listRequests: (params?: { workflow_id?: string; status?: string }) => {
    const query = new URLSearchParams()
    if (params?.workflow_id) query.set('workflow_id', params.workflow_id)
    if (params?.status) query.set('status', params.status)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<RequestRecord[]>(`/api/requests${suffix}`)
  },
  createRequest: (body: { request_id?: string; workflow_id: string; payload: Record<string, unknown> }) =>
    request<RequestRecord>('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getRequest: (requestId: string) => request<RequestRecord>(`/api/requests/${requestId}`),
  getAudit: (requestId: string) => request(`/api/audit/${requestId}`),
  searchAudit: (params?: { request_id?: string; workflow_id?: string; status?: string }) => {
    const query = new URLSearchParams()
    if (params?.request_id) query.set('request_id', params.request_id)
    if (params?.workflow_id) query.set('workflow_id', params.workflow_id)
    if (params?.status) query.set('status', params.status)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<Array<Record<string, unknown>>>(`/api/audit${suffix}`)
  },
  adminQueue: () => request<RequestRecord[]>('/api/admin/queue'),
  adminRetry: (requestId: string) =>
    request<RequestRecord>(`/api/admin/retry/${requestId}`, {
      method: 'POST',
    }),
  adminRetryFailed: () =>
    request<{ retried: string[]; count: number }>('/api/admin/retry-failed', {
      method: 'POST',
    }),
  adminOverride: (requestId: string, decision: 'APPROVED' | 'REJECTED', note?: string) =>
    request<RequestRecord>(`/api/admin/override/${requestId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, note }),
    }),
  adminMetrics: () => request<AdminMetrics>('/api/admin/metrics'),
}
