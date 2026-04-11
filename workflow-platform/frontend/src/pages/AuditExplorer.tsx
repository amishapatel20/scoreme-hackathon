import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../components/StatusBadge'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { useAuditSearch } from '../hooks/useAudit'
import { formatDate, formatRelativeDate, formatWorkflowName } from '../lib/utils'

export default function AuditExplorer() {
  const [requestId, setRequestId] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<{ request_id?: string; workflow_id?: string; status?: string }>({})

  const { entries, loading, error, dataState, lastUpdated } = useAuditSearch(applied)

  useEffect(() => {
    document.title = 'Audit Explorer | Workflow Decision Platform'
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Explorer</h1>
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <p className="text-xs text-muted-foreground">Filter by request, workflow, or status to inspect rule outcomes and operator actions.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Request ID" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
          <Input placeholder="Workflow ID" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="PENDING">PENDING</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
            <option value="FAILED">FAILED</option>
          </Select>
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={() =>
              setApplied({
                request_id: requestId || undefined,
                workflow_id: workflowId || undefined,
                status: status || undefined,
              })
            }
          >
            Search
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Entries</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {dataState === 'live' ? (
              <Badge variant="success">Live audit data</Badge>
            ) : dataState === 'fallback' ? (
              <Badge variant="warning">Displaying sample audit logs</Badge>
            ) : (
              <Badge variant="muted">No activity for current filters</Badge>
            )}
            {lastUpdated ? (
              <span className="text-muted-foreground" title={formatDate(lastUpdated)}>
                Last updated {formatRelativeDate(lastUpdated)}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading recent audit activity...
            </div>
          ) : error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div>
          ) : entries.length === 0 ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              No audit activity found for these filters yet. Try adjusting filters or check back as new requests are processed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Request ID</th>
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Rule</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row, idx) => (
                    <tr key={`${String(row.timestamp)}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2" title={formatDate(String(row.timestamp))}>{formatRelativeDate(String(row.timestamp))}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link className="text-primary hover:underline" to={`/requests/${String(row.request_id)}`}>
                          {String(row.request_id)}
                        </Link>
                      </td>
                      <td className="px-3 py-2" title={String(row.workflow_id)}>{formatWorkflowName(String(row.workflow_id))}</td>
                      <td className="px-3 py-2">{String(row.stage ?? '-')}</td>
                      <td className="px-3 py-2">{String(row.rule ?? '-')}</td>
                      <td className="px-3 py-2"><StatusBadge status={String(row.result)} /></td>
                      <td className="px-3 py-2">{String(row.explanation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
