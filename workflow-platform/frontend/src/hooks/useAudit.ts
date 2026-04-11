import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import { DEMO_AUDIT_ENTRIES } from '../lib/demoData'

type AuditDataState = 'live' | 'fallback' | 'empty'

export function useAuditSearch(params?: { request_id?: string; workflow_id?: string; status?: string }) {
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataState, setDataState] = useState<AuditDataState>('live')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.searchAudit(params)
      setEntries(data)
      setDataState(data.length > 0 ? 'live' : 'empty')
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      setEntries(DEMO_AUDIT_ENTRIES)
      setDataState('fallback')
      setLastUpdated(new Date().toISOString())
      setError('Showing sample audit logs while we reconnect live activity.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [params?.request_id, params?.workflow_id, params?.status])

  return { entries, loading, error, refresh, dataState, lastUpdated }
}
