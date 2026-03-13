import Editor from '@monaco-editor/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { useWorkflow } from '../hooks/useWorkflow'
import { api } from '../lib/api'

function sampleFromSchema(schema: Array<{ name: string; type: string }>) {
  const payload: Record<string, unknown> = {}
  for (const field of schema) {
    if (field.type === 'integer') payload[field.name] = 1
    else if (field.type === 'number') payload[field.name] = 1.5
    else if (field.type === 'boolean') payload[field.name] = true
    else payload[field.name] = `${field.name}_value`
  }
  return payload
}

export default function ConfigEditor() {
  const { workflows, refresh } = useWorkflow()
  const [workflowId, setWorkflowId] = useState('')
  const [yamlText, setYamlText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<any>(null)

  useEffect(() => {
    document.title = 'Config Editor | Workflow Decision Platform'
  }, [])

  useEffect(() => {
    if (!workflowId && workflows.length > 0) setWorkflowId(workflows[0].workflow_id)
  }, [workflowId, workflows])

  useEffect(() => {
    if (!workflowId) return
    setLoading(true)
    void api
      .getWorkflow(workflowId)
      .then((data) => setYamlText(data.yaml_content))
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load config'))
      .finally(() => setLoading(false))
  }, [workflowId])

  const selected = useMemo(() => workflows.find((w) => w.workflow_id === workflowId), [workflows, workflowId])

  const save = async () => {
    if (!workflowId) return
    setMessage(null)
    try {
      await api.updateWorkflow(workflowId, yamlText)
      setMessage('Configuration saved and hot-reloaded successfully.')
      await refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save config')
    }
  }

  const runDryTest = async () => {
    if (!workflowId || !selected) return
    setMessage(null)
    try {
      const payload = sampleFromSchema(selected.payload_schema)
      const result = await api.testWorkflow(workflowId, payload)
      setDryRunResult(result)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Dry run failed')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Config Editor</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
            {workflows.map((workflow) => (
              <option key={workflow.workflow_id} value={workflow.workflow_id}>
                {workflow.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()}>Save Config</Button>
            <Button variant="outline" onClick={() => void runDryTest()}>
              Test Config
            </Button>
          </div>
          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>YAML Editor</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading YAML...
            </div>
          ) : (
            <Editor
              height="420px"
              defaultLanguage="yaml"
              value={yamlText}
              onChange={(value) => setYamlText(value ?? '')}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation / Dry Run Output</CardTitle>
        </CardHeader>
        <CardContent>
          {dryRunResult ? (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{JSON.stringify(dryRunResult, null, 2)}</pre>
          ) : (
            <div className="text-sm text-muted-foreground">Run "Test Config" to validate and simulate decision flow.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
