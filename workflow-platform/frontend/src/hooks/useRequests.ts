import { useEffect, useState } from 'react'

import { api, type RequestRecord } from '../lib/api'
import { useAppStore } from '../store/appStore'

export function useRequests(filter?: { workflow_id?: string; status?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requests = useAppStore((s) => s.requests)
  const setRequests = useAppStore((s) => s.setRequests)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listRequests(filter)
      setRequests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [filter?.workflow_id, filter?.status])

  return { requests, loading, error, refresh }
}

export function useRequestDetail(requestId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [record, setRecord] = useState<RequestRecord | null>(null)

  useEffect(() => {
    if (!requestId) return
    setLoading(true)
    setError(null)
    void api
      .getRequest(requestId)
      .then((data) => setRecord(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load request'))
      .finally(() => setLoading(false))
  }, [requestId])

  return { record, loading, error }
}
