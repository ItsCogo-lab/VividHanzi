import { Link } from 'react-router'
import { Button } from '../../../components/ui/Button.tsx'
import { t } from '../../../i18n/index.ts'
import { EntryLabel } from '../../dictionary/components/EntryLabel.tsx'
import { getStudyItemId, type StudyItem } from '../../dictionary/studyItem.ts'
import { StatusBadge } from '../../progress/components/StatusBadge.tsx'
import { getDisplayStatus } from '../../progress/progress.ts'
import { useProgress } from '../../progress/progressContext.ts'
import type { StudySet } from '../../studySets/types.ts'
import { useCustomSet, useCustomSets } from '../customSetsContext.ts'
import { CustomItemNotes } from './CustomItemNotes.tsx'
import { getCustomEntryPath } from '../customPaths.ts'

/** Vocabulary of a custom set: each item with its progress, its entry page and the button to remove it. */
export function CustomItemList({ set, items }: { set: StudySet; items: readonly StudyItem[] }) {
  const { progress } = useProgress()
  const { removeItem } = useCustomSets()
  const customSet = useCustomSet(set.id)

  return (
    <section aria-labelledby="custom-items-title" className="flex flex-col gap-3">
      <h2 id="custom-items-title" className="text-lg font-semibold">
        {t('sets.vocabulary')}
      </h2>
      {items.length === 0 ? (
        <p className="text-ink-muted">{t('custom.noItems')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {items.map((item) => {
            const itemId = getStudyItemId(item)
            const { hanzi } = item.entry
            return (
              <li key={itemId} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <EntryLabel entry={item.entry} withMeaning />
                  <StatusBadge status={getDisplayStatus(progress, itemId)} />
                </div>
                {customSet && <CustomItemNotes set={customSet} item={item} />}
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={getCustomEntryPath(item, set)}
                    aria-label={t('custom.openNamed', { hanzi })}
                    className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-medium text-accent-strong hover:bg-accent-soft"
                  >
                    {t('custom.openInDictionary')}
                  </Link>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-sm"
                    aria-label={t('custom.removeNamed', { hanzi })}
                    onClick={() => removeItem(set.id, itemId)}
                  >
                    {t('custom.remove')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
