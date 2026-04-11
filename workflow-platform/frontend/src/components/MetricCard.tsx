import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { InfoTooltip } from './ui/info-tooltip'

type Props = {
  title: string
  value: string | number
  helper?: string
  tooltip?: string
}

export function MetricCard({ title, value, helper, tooltip }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <span>{title}</span>
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </CardDescription>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      {helper ? <CardContent className="pt-0 text-xs text-muted-foreground">{helper}</CardContent> : null}
    </Card>
  )
}
