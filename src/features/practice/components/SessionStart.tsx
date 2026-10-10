import { useEffect, useRef } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t } from '../../../i18n/index.ts'
import { ExerciseTypesChoice } from '../../settings/components/ExerciseTypesChoice.tsx'

/**
 * Asked before a Study session: which exercise types to use. The choice is
 * the Settings one, so it is remembered for the next session.
 */
export function SessionStart({ onStart }: { onStart: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null)
  // Enter starts right away with the same types as last time
  useEffect(() => startRef.current?.focus(), [])

  return (
    <Card className="mx-auto flex max-w-xl flex-col gap-4">
      <ExerciseTypesChoice legend={<span className="text-lg font-semibold text-ink">{t('practice.start.title')}</span>} />
      <p className="text-sm text-ink-muted">{t('practice.start.hint')}</p>
      <Button ref={startRef} onClick={onStart} className="self-start">
        {t('practice.start.button')}
      </Button>
    </Card>
  )
}
