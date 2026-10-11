import { Button } from '../../../components/ui/Button.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { useSessionShortcuts } from '../shortcuts.ts'

/**
 * Goes back to the last answered card and undoes its answer, in case it was
 * a slip or to look at it again. Also with Backspace, which no exercise uses.
 */
export function BackButton({ onBack, className = '' }: { onBack: () => void; className?: string }) {
  useSessionShortcuts({ Backspace: onBack })

  return (
    <Button
      variant="secondary"
      className={className}
      aria-keyshortcuts="Backspace"
      title={t('practice.backHint')}
      onClick={onBack}
    >
      <span aria-hidden="true">←</span>
      {t('practice.back')} <Kbd>⌫</Kbd>
    </Button>
  )
}
