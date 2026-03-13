import { useEffect, useState } from 'react'

import { api, type WorkflowSummary } from '../lib/api'
import { useAppStore } from '../store/appStore'

export function useWorkflow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workflows = useAppStore((s) => s.workflows)
  const setWorkflows = useAppStore((s) => s.setWorkflows)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listWorkflows()
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (workflows.length === 0) {
      void refresh()
    }
  }, [])

  return { workflows, loading, error, refresh }
}
