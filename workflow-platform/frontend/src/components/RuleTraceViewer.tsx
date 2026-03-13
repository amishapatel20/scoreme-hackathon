import { StatusBadge } from './StatusBadge'

type RuleEntry = {
  stage?: string | null
  rule_id?: string | null
  field?: string | null
  operator?: string | null
  expected_value?: unknown
  actual_value?: unknown
  result?: string
  explanation?: string
}

type Props = {
  entries: RuleEntry[]
}

export function RuleTraceViewer({ entries }: Props) {
  if (entries.length === 0) {
    return <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No rule evaluations yet.</div>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Rule</th>
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Operator</th>
            <th className="px-3 py-2">Expected</th>
            <th className="px-3 py-2">Actual</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const fail = String(entry.result).toUpperCase() === 'FAIL'
            return (
              <tr key={`${entry.rule_id ?? 'rule'}-${idx}`} className={fail ? 'bg-rose-500/10' : 'border-t border-border'}>
                <td className="px-3 py-2">{entry.stage ?? '-'}</td>
                <td className="px-3 py-2">{entry.rule_id ?? '-'}</td>
                <td className="px-3 py-2">{entry.field ?? '-'}</td>
                <td className="px-3 py-2">{entry.operator ?? '-'}</td>
                <td className="px-3 py-2">{String(entry.expected_value ?? '-')}</td>
                <td className="px-3 py-2">{String(entry.actual_value ?? '-')}</td>
                <td className="px-3 py-2"><StatusBadge status={String(entry.result)} /></td>
                <td className="px-3 py-2">{entry.explanation ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
