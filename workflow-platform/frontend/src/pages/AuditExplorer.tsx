import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { useAuditSearch } from '../hooks/useAudit'

export default function AuditExplorer() {
  const [requestId, setRequestId] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const [status, setStatus] = useState('')
  const [applied, setApplied] = useState<{ request_id?: string; workflow_id?: string; status?: string }>({})

  const { entries, loading, error } = useAuditSearch(applied)

  useEffect(() => {
    document.title = 'Audit Explorer | Workflow Decision Platform'
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Explorer</h1>
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading audit entries...
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No audit events found for current filters.</div>
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
                      <td className="px-3 py-2">{String(row.timestamp)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link className="text-primary hover:underline" to={`/requests/${String(row.request_id)}`}>
                          {String(row.request_id)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{String(row.workflow_id)}</td>
                      <td className="px-3 py-2">{String(row.stage ?? '-')}</td>
                      <td className="px-3 py-2">{String(row.rule ?? '-')}</td>
                      <td className="px-3 py-2">{String(row.result)}</td>
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
