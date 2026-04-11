import { Info } from 'lucide-react'

type Props = {
  text: string
  className?: string
}

export function InfoTooltip({ text, className }: Props) {
  return (
    <span
      className={className ?? 'inline-flex cursor-help text-muted-foreground/80 hover:text-muted-foreground'}
      title={text}
      aria-label={text}
      role="note"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  )
}
