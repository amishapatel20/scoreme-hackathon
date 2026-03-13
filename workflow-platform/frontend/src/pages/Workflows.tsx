import { useEffect, useState } from 'react'

import { WorkflowVisualizer } from '../components/WorkflowVisualizer'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useWorkflow } from '../hooks/useWorkflow'
import { api } from '../lib/api'

export default function Workflows() {
  const { workflows, loading, error, refresh } = useWorkflow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [yaml, setYaml] = useState<string>('')
  const [workflowObj, setWorkflowObj] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    document.title = 'Workflow Configs | Workflow Decision Platform'
  }, [])

  const viewWorkflow = async (workflowId: string) => {
    setSelectedId(workflowId)
    setDetailsLoading(true)
    try {
      const data = await api.getWorkflow(workflowId)
      setYaml(data.yaml_content)
      setWorkflowObj(data.workflow)
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workflow Configs</h1>
        <Button variant="outline" onClick={() => void refresh()}>
          Reload
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="spinner" /> Loading workflows...
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          No workflows yet — add your first workflow config.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workflows.map((workflow) => (
            <Card key={workflow.workflow_id}>
              <CardHeader>
                <CardTitle>{workflow.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{workflow.description}</p>
                <p>Stages: {workflow.stage_count}</p>
                <p>Rules: {workflow.rule_count}</p>
                <p>External: {workflow.external_dependencies.join(', ') || 'None'}</p>
                <Button className="mt-2" onClick={() => void viewWorkflow(workflow.workflow_id)}>
                  View YAML
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedId ? (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Detail: {selectedId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="spinner" /> Loading config details...
              </div>
            ) : (
              <>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-4 text-xs">{yaml}</pre>
                <WorkflowVisualizer stages={workflowObj?.stages ?? []} />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
