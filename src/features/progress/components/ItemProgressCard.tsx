import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { formatDate, t } from '../../../i18n/index.ts'
import { getItemStatus, isDue } from '../progress.ts'
import type { ItemProgress } from '../types.ts'
import { StatusBadge } from './StatusBadge.tsx'

type ItemProgressCardProps = {
  /** `undefined` if the item hasn't been studied yet. */
  item: ItemProgress | undefined
  now: Date
  /** The user chose not to learn it in Learn; `onLearnAfterAll` undoes that. */
  excluded?: { onLearnAfterAll: () => void }
}

/** How the user is doing with a specific character or word. */
export function ItemProgressCard({ item, now, excluded }: ItemProgressCardProps) {
  const isExcluded = !item && excluded !== undefined
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t('dictionary.yourProgress')}</h2>
        <StatusBadge status={isExcluded ? 'excluded' : getItemStatus(item)} />
      </div>
      {item ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Fact label={t('dictionary.timesSeen')} value={item.timesSeen} />
          <Fact label={t('stats.correct')} value={item.timesCorrect} />
          <Fact label={t('stats.mistakes')} value={item.timesWrong} />
          <Fact
            label={t('dictionary.nextReview')}
            value={
              item.basic
                ? t('dictionary.basicNoReview')
                : isDue(item, now)
                  ? t('dictionary.dueNow')
                  : formatDate(new Date(item.nextReviewAt))
            }
          />
        </dl>
      ) : isExcluded ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-ink-muted">{t('dictionary.excluded')}</p>
          <Button variant="secondary" onClick={excluded.onLearnAfterAll}>
            {t('dictionary.learnAfterAll')}
          </Button>
        </div>
      ) : (
        <p className="text-ink-muted">{t('dictionary.notStudied')}</p>
      )}
    </Card>
  )
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  )
}
