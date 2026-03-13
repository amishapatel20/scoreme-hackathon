import { useEffect, useState } from 'react'

import { api } from '../lib/api'

export function useAuditSearch(params?: { request_id?: string; workflow_id?: string; status?: string }) {
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.searchAudit(params)
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [params?.request_id, params?.workflow_id, params?.status])

  return { entries, loading, error, refresh }
}
