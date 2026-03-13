import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { useWorkflow } from '../hooks/useWorkflow'
import { api } from '../lib/api'

function parseFieldValue(type: string, value: string): unknown {
  if (type === 'integer') return Number.parseInt(value, 10)
  if (type === 'number') return Number.parseFloat(value)
  if (type === 'boolean') return value === 'true'
  return value
}

export default function NewRequest() {
  const navigate = useNavigate()
  const { workflows, loading } = useWorkflow()
  const [workflowId, setWorkflowId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'New Request | Workflow Decision Platform'
  }, [])

  useEffect(() => {
    if (!workflowId && workflows.length > 0) setWorkflowId(workflows[0].workflow_id)
  }, [workflowId, workflows])

  const selected = useMemo(() => workflows.find((w) => w.workflow_id === workflowId), [workflows, workflowId])

  const onSubmit = async () => {
    if (!selected) return

    const nextErrors: Record<string, string> = {}
    const payload: Record<string, unknown> = {}

    for (const field of selected.payload_schema) {
      const raw = values[field.name] ?? ''
      if (field.required && raw.trim() === '') {
        nextErrors[field.name] = 'This field is required.'
        continue
      }
      if (raw.trim() === '') continue

      const parsed = parseFieldValue(field.type, raw)
      if ((field.type === 'integer' || field.type === 'number') && Number.isNaN(parsed as number)) {
        nextErrors[field.name] = 'Please enter a valid number.'
        continue
      }
      payload[field.name] = parsed
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await api.createRequest({ workflow_id: selected.workflow_id, payload })
      navigate(`/requests/${created.request_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Request submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Submit New Request</h1>
      <Card>
        <CardHeader>
          <CardTitle>Request Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="spinner" /> Loading workflow definitions...
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No workflows available. Add one from Config Editor.</div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Workflow</label>
                <Select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
                  {workflows.map((workflow) => (
                    <option key={workflow.workflow_id} value={workflow.workflow_id}>
                      {workflow.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(selected?.payload_schema ?? []).map((field) => (
                  <div key={field.name}>
                    <label className="mb-1 block text-sm font-medium">
                      {field.label ?? field.name}
                      {field.required ? ' *' : ''}
                    </label>
                    <Input
                      value={values[field.name] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      placeholder={field.helper_text ?? `Enter ${field.name}`}
                    />
                    {field.helper_text ? <p className="mt-1 text-xs text-muted-foreground">{field.helper_text}</p> : null}
                    {errors[field.name] ? <p className="mt-1 text-xs text-red-400">{errors[field.name]}</p> : null}
                  </div>
                ))}
              </div>

              {submitError ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">{submitError}</div> : null}

              <Button onClick={() => void onSubmit()} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" /> Submitting...
                  </span>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
