import { t, type MessageKey } from '../../../i18n/index.ts'
import type { DisplayStatus } from '../progress.ts'

const STATUS_STYLES: Record<DisplayStatus, { labelKey: MessageKey; className: string }> = {
  new: { labelKey: 'status.new', className: 'border-line text-ink-muted' },
  learning: { labelKey: 'status.learning', className: 'border-accent/40 bg-accent-soft text-accent-strong' },
  mastered: { labelKey: 'status.mastered', className: 'border-success/40 bg-success/10 text-success' },
  excluded: { labelKey: 'status.excluded', className: 'border-dashed border-line text-ink-muted' },
}

/** Badge with an item's state: new, learning, mastered or excluded. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { labelKey, className } = STATUS_STYLES[status]
  return (
    <span className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {t(labelKey)}
    </span>
  )
}
