import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { api, type AdminMetrics, type RequestRecord } from '../lib/api'
import { DEMO_ADMIN_METRICS, DEMO_REQUESTS } from '../lib/demoData'
import { formatDate } from '../lib/utils'

export default function AdminPanel() {
  const [queue, setQueue] = useState<RequestRecord[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [q, m] = await Promise.all([api.adminQueue(), api.adminMetrics()])
      const fallbackQueue = DEMO_REQUESTS.filter((item) => ['MANUAL_REVIEW', 'FAILED'].includes(item.status)).slice(0, 8)
      setQueue(q.length === 0 ? fallbackQueue : q)
      setMetrics(m.total_requests === 0 ? DEMO_ADMIN_METRICS : m)
    } catch (err) {
      setQueue(DEMO_REQUESTS.filter((item) => ['MANUAL_REVIEW', 'FAILED'].includes(item.status)).slice(0, 8))
      setMetrics(DEMO_ADMIN_METRICS)
      setError('Using fallback data for admin operations view.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Admin Panel | Workflow Decision Platform'
    void refresh()
  }, [])

  const workflowBarData = useMemo(
    () =>
      Object.entries(metrics?.requests_by_workflow ?? {}).map(([name, count]) => ({
        name,
        count,
      })),
    [metrics],
  )

  const pieData = useMemo(
    () => [
      { name: 'Approved', value: Math.round((metrics?.approval_rate ?? 0) * (metrics?.total_requests ?? 0)) },
      { name: 'Rejected', value: Math.round((metrics?.rejection_rate ?? 0) * (metrics?.total_requests ?? 0)) },
      { name: 'Review', value: metrics?.pending_review ?? 0 },
    ],
    [metrics],
  )

  const lineData = metrics?.requests_last_7_days ?? []

  const handleRetry = async (requestId: string) => {
    await api.adminRetry(requestId)
    await refresh()
  }

  const handleOverride = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    await api.adminOverride(requestId, decision, `Admin ${decision.toLowerCase()} from panel`)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void api.adminRetryFailed().then(refresh)}>
            Bulk Retry FAILED
          </Button>
          <Button onClick={() => void refresh()}>Refresh</Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="spinner" /> Loading admin data...
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Manual Review / Failed Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-sm text-muted-foreground">No manual review or failed requests in queue.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Request ID</th>
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.request_id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{item.request_id}</td>
                      <td className="px-3 py-2">{item.workflow_id}</td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-3 py-2">{formatDate(item.updated_at)}</td>
                      <td className="px-3 py-2">{item.failure_reason ?? 'Requires human review'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => void handleRetry(item.request_id)}>
                            Retry
                          </Button>
                          <Button size="sm" onClick={() => void handleOverride(item.request_id, 'APPROVED')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void handleOverride(item.request_id, 'REJECTED')}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Requests by Workflow</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workflowBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Outcome Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90}>
                  {pieData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={['#10b981', '#f43f5e', '#f59e0b'][idx % 3]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Requests (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
