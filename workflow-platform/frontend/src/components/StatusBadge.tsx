import { Badge } from './ui/badge'

type Props = {
  status?: string
}

export function StatusBadge({ status = 'UNKNOWN' }: Props) {
  const key = status.toUpperCase()
  const variant =
    key === 'APPROVED'
      ? 'success'
      : key === 'REJECTED' || key === 'FAILED'
        ? 'danger'
        : key === 'MANUAL_REVIEW'
          ? 'warning'
          : key === 'IN_PROGRESS' || key === 'PENDING' || key === 'RETRYING'
            ? 'info'
            : 'muted'

  return <Badge variant={variant}>{key}</Badge>
}
