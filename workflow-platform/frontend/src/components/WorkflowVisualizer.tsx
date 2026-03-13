import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

type Stage = {
  name: string
  type: string
  on_success?: string
  on_failure?: string
}

type Props = {
  stages: Stage[]
}

export function WorkflowVisualizer({ stages }: Props) {
  if (stages.length === 0) {
    return <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No stage graph available.</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage) => (
        <Card key={stage.name}>
          <CardHeader>
            <CardTitle className="text-base">{stage.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div>Type: {stage.type}</div>
            <div>Success {'->'} {stage.on_success ?? 'next stage'}</div>
            <div>Failure {'->'} {stage.on_failure ?? 'stop'}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
