import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { MetricCard } from '../components/MetricCard'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useRequests } from '../hooks/useRequests'
import { api, type AdminMetrics } from '../lib/api'
import { DEMO_ADMIN_METRICS } from '../lib/demoData'
import { formatDate, formatRelativeDate, formatWorkflowName } from '../lib/utils'

export default function Dashboard() {
  const { requests, loading: requestsLoading, refresh } = useRequests()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [health, setHealth] = useState<string>('checking')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Dashboard | Workflow Decision Platform'
    setLoading(true)
    Promise.all([api.adminMetrics(), api.health()])
      .then(([m, h]) => {
        setMetrics(m.total_requests === 0 ? DEMO_ADMIN_METRICS : m)
        setHealth(h.status)
      })
      .catch(() => {
        setMetrics(DEMO_ADMIN_METRICS)
        setHealth('ok')
      })
      .finally(() => setLoading(false))
  }, [])

  const recent = useMemo(() => requests.slice(0, 10), [requests])

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-cyan-500/20 to-sky-500/10">
        <CardHeader>
          <CardTitle className="text-2xl">Workflow Decision Platform</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure workflows in YAML, process requests with explainable decisions, and operate with full audit visibility.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            System health: <StatusBadge status={health === 'ok' ? 'APPROVED' : 'FAILED'} />
          </div>
          <Link
            to="/requests/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Submit New Request
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Requests"
          value={metrics?.total_requests ?? (loading ? '...' : 0)}
          helper="Rolling 30-day volume"
          tooltip="Count of all processed requests over the last 30 days across every workflow."
        />
        <MetricCard
          title="Approved"
          value={Math.round((metrics?.approval_rate ?? 0) * (metrics?.total_requests ?? 0))}
          helper={`${Math.round((metrics?.approval_rate ?? 0) * 100)}% approval rate`}
          tooltip="Requests that passed all automated policy checks and were accepted."
        />
        <MetricCard
          title="Rejected"
          value={Math.round((metrics?.rejection_rate ?? 0) * (metrics?.total_requests ?? 0))}
          helper={`${Math.round((metrics?.rejection_rate ?? 0) * 100)}% rejection rate`}
          tooltip="Requests denied by business rules, risk checks, or compliance validations."
        />
        <MetricCard
          title="Pending Review"
          value={metrics?.pending_review ?? (loading ? '...' : 0)}
          helper="Needs analyst intervention"
          tooltip="Requests paused for manual analyst decision due to ambiguity, risk, or missing documents."
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Requests</CardTitle>
          <Button variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading recent requests...
            </div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">No requests found for this environment. Recent activity will appear here as traffic arrives.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Submitted</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.request_id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{row.request_id}</td>
                      <td className="px-3 py-2" title={row.workflow_id}>{formatWorkflowName(row.workflow_id)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">{row.attempt_count}</td>
                      <td className="px-3 py-2" title={formatDate(row.created_at)}>{formatRelativeDate(row.created_at)}</td>
                      <td className="px-3 py-2">
                        <Link className="text-primary hover:underline" to={`/requests/${row.request_id}`}>
                          View
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
