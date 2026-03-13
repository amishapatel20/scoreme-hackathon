import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { AuditTimeline } from '../components/AuditTimeline'
import { RuleTraceViewer } from '../components/RuleTraceViewer'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useRequestDetail } from '../hooks/useRequests'
import { api } from '../lib/api'

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const { record, loading, error } = useRequestDetail(id)
  const [auditData, setAuditData] = useState<any>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Request Detail | Workflow Decision Platform'
  }, [])

  useEffect(() => {
    if (!id) return
    void api.getAudit(id).then(setAuditData).catch(() => setAuditData(null))
  }, [id, record?.updated_at])

  const canAdminAction = useMemo(
    () => ['MANUAL_REVIEW', 'FAILED'].includes(String(record?.status ?? '').toUpperCase()),
    [record?.status],
  )

  const performAction = async (kind: 'retry' | 'approve' | 'reject') => {
    if (!id) return
    setActionError(null)
    try {
      if (kind === 'retry') {
        await api.adminRetry(id)
      } else {
        await api.adminOverride(id, kind === 'approve' ? 'APPROVED' : 'REJECTED', 'Action from request detail')
      }
      const refreshed = await api.getAudit(id)
      setAuditData(refreshed)
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Admin action failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="spinner" /> Loading request detail...
      </div>
    )
  }

  if (error || !record) {
    return <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error ?? 'Request not found'}</div>
  }

  const ruleTrace = (auditData?.rule_trace as any[]) ?? []
  const externalCalls = (auditData?.external_calls as any[]) ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Request {record.request_id}</CardTitle>
          <StatusBadge status={record.status} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Workflow</div>
            <div className="font-medium">{record.workflow_id}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Attempts</div>
            <div className="font-medium">{record.attempt_count}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Submitted Payload</div>
            <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{JSON.stringify(record.payload, null, 2)}</pre>
          </div>

          {canAdminAction ? (
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button onClick={() => void performAction('approve')}>Approve</Button>
              <Button variant="destructive" onClick={() => void performAction('reject')}>
                Reject
              </Button>
              <Button variant="outline" onClick={() => void performAction('retry')}>
                Retry
              </Button>
            </div>
          ) : null}

          {actionError ? <div className="md:col-span-2 text-sm text-red-400">{actionError}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>State History</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline items={record.state_history ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule Trace</CardTitle>
        </CardHeader>
        <CardContent>
          <RuleTraceViewer entries={ruleTrace} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>External Dependency Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {externalCalls.length === 0 ? (
            <div className="text-sm text-muted-foreground">No external calls recorded.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Dependency</th>
                    <th className="px-3 py-2">Attempt</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {externalCalls.map((call, idx) => (
                    <tr key={`${call.timestamp}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2">{call.timestamp}</td>
                      <td className="px-3 py-2">{call.stage}</td>
                      <td className="px-3 py-2">{call.rule_id}</td>
                      <td className="px-3 py-2">{String((call.details ?? {}).attempt ?? '-')}</td>
                      <td className="px-3 py-2"><StatusBadge status={call.result} /></td>
                      <td className="px-3 py-2">{call.explanation}</td>
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
