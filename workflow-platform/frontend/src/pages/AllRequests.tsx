import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useRequests } from '../hooks/useRequests'
import { formatDate, formatRelativeDate, formatWorkflowName } from '../lib/utils'

export default function AllRequests() {
  const { requests, loading, error } = useRequests()

  useEffect(() => {
    document.title = 'All Requests | Workflow Decision Platform'
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">All Requests</h1>
      <Card>
        <CardHeader>
          <CardTitle>Request List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading requests...
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground">No request activity yet for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Request ID</th>
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Submitted</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Latency</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.request_id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{request.request_id}</td>
                      <td className="px-3 py-2" title={request.workflow_id}>{formatWorkflowName(request.workflow_id)}</td>
                      <td className="px-3 py-2"><StatusBadge status={request.status} /></td>
                      <td className="px-3 py-2">{request.attempt_count}</td>
                      <td className="px-3 py-2" title={formatDate(request.created_at)}>{formatRelativeDate(request.created_at)}</td>
                      <td className="px-3 py-2" title={formatDate(request.updated_at)}>{formatRelativeDate(request.updated_at)}</td>
                      <td className="px-3 py-2">{request.processing_ms ? `${request.processing_ms} ms` : '-'}</td>
                      <td className="px-3 py-2">
                        <Link className="text-primary hover:underline" to={`/requests/${request.request_id}`}>
                          View Detail
                        </Link>
                      </td>
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
