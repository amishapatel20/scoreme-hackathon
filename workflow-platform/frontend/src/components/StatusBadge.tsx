import { Badge } from './ui/badge'

type Props = {
  status?: string
}

export function StatusBadge({ status = 'UNKNOWN' }: Props) {
  const key = status.toUpperCase()
  const variant =
    key === 'APPROVED' || key === 'PASS' || key === 'PASSED'
      ? 'success'
      : key === 'REJECTED' || key === 'FAILED' || key === 'FAIL' || key === 'TIMEOUT'
        ? 'danger'
        : key === 'MANUAL_REVIEW'
          ? 'warning'
          : key === 'IN_PROGRESS' || key === 'PENDING' || key === 'RETRYING'
            ? 'info'
            : 'muted'

  const statusHelp: Record<string, string> = {
    APPROVED: 'Completed successfully and accepted by policy checks.',
    REJECTED: 'Completed with a final rejection decision.',
    FAILED: 'Processing failed due to a technical or dependency error.',
    MANUAL_REVIEW: 'Requires analyst review before a final decision.',
    IN_PROGRESS: 'Currently being processed by workflow stages.',
    PENDING: 'Queued and waiting to be processed.',
    RETRYING: 'Automatically retried after a transient failure.',
    PASS: 'Rule evaluation passed.',
    PASSED: 'Rule evaluation passed.',
    FAIL: 'Rule evaluation failed.',
    TIMEOUT: 'Step exceeded allowed processing time.',
  }

  return (
    <Badge variant={variant} title={statusHelp[key] ?? 'Current processing state'} aria-label={`${key}: ${statusHelp[key] ?? 'Current processing state'}`}>
      {key}
    </Badge>
  )
}
