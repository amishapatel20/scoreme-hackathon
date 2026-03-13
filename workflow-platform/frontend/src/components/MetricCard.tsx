import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Props = {
  title: string
  value: string | number
  helper?: string
}

export function MetricCard({ title, value, helper }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      {helper ? <CardContent className="pt-0 text-xs text-muted-foreground">{helper}</CardContent> : null}
    </Card>
  )
}
