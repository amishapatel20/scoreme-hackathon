import { formatDate } from '../lib/utils'

type Item = {
  timestamp: string
  from_state: string | null
  to_state: string
  reason: string
}

type Props = {
  items: Item[]
}

export function AuditTimeline({ items }: Props) {
  if (items.length === 0) {
    return <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No state transitions available.</div>
  }

  return (
    <ol className="relative border-s border-border pl-6">
      {items.map((item, idx) => (
        <li key={`${item.timestamp}-${idx}`} className="mb-6 ms-2">
          <span className="absolute -start-[6px] mt-1 h-3 w-3 rounded-full bg-primary" />
          <div className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</div>
          <div className="font-medium">
            {item.from_state ?? 'START'} {'->'} {item.to_state}
          </div>
          <div className="text-sm text-muted-foreground">{item.reason}</div>
        </li>
      ))}
    </ol>
  )
}
