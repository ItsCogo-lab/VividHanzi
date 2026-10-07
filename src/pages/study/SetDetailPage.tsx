import { useId, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { EntryLabel } from '../../features/dictionary/components/EntryLabel.tsx'
import { LoadEntries } from '../../features/dictionary/components/LoadEntries.tsx'
import { useDictionary } from '../../features/dictionary/dictionaryContext.ts'
import { getStudyItemId, type StudyItem } from '../../features/dictionary/studyItem.ts'
import { isStudying } from '../../features/myStudies/myStudies.ts'
import { useMyStudies } from '../../features/myStudies/myStudiesContext.ts'
import { AddVocabulary } from '../../features/customSets/components/AddVocabulary.tsx'
import { CustomItemList } from '../../features/customSets/components/CustomItemList.tsx'
import { CustomSetSettings } from '../../features/customSets/components/CustomSetSettings.tsx'
import { StatusBadge } from '../../features/progress/components/StatusBadge.tsx'
import { getDisplayStatus } from '../../features/progress/progress.ts'
import { useProgress } from '../../features/progress/progressContext.ts'
import type { ProgressData } from '../../features/progress/types.ts'
import { useStudySets } from '../../features/studySets/useStudySets.ts'
import { SetSessionActions } from '../../features/studySets/components/SetSessionActions.tsx'
import { SetItemCount, StudyingBadge } from '../../features/studySets/components/SetSummary.tsx'
import { SetProgressBar } from '../../features/studySets/components/SetProgressBar.tsx'
import { StudyToggleButton } from '../../features/studySets/components/StudyToggleButton.tsx'
import { getSetProgress } from '../../features/studySets/setProgress.ts'
import { getSetItems, getStudySet } from '../../features/studySets/studySets.ts'
import { t } from '../../i18n/index.ts'
import { getEntryPath } from '../../features/dictionary/entryPaths.ts'
import { NotFoundPage } from '../NotFoundPage.tsx'

/** Items shown at once in the list; the rest, with "Show more". */
const PAGE_SIZE = 100

/** Page of a set: progress, actions and its vocabulary. */
export function SetDetailPage() {
  const { setId = '' } = useParams()
  const dictionary = useDictionary()
  const { progress } = useProgress()
  const { myStudies } = useMyStudies()
  const studySets = useStudySets()
  const set = getStudySet(studySets, setId)
  if (!set) return <NotFoundPage />

  const setProgress = getSetProgress(set, progress, new Date())
  const items = getSetItems(set, dictionary)
  const words = items.filter((item) => item.kind === 'word')
  const characters = items.filter((item) => item.kind === 'character')

  return (
    <>
      <PageHeader
        title={set.name}
        description={set.description || (set.type === 'custom' ? t('custom.label') : undefined)}
        actions={
          <div className="flex flex-wrap gap-2">
            <StudyToggleButton set={set} />
          </div>
        }
      />
      <div className="flex flex-col gap-4 sm:gap-6">
        <SetSessionActions set={set} />
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold">{t('sets.progressTitle')}</h2>
            {isStudying(myStudies, set.id) && <StudyingBadge />}
            <span className="text-sm text-ink-muted">
              <SetItemCount set={set} />
            </span>
          </div>
          <SetProgressBar name={set.name} progress={setProgress} />
          <dl className="grid grid-cols-3 gap-3">
            <StatCard label={t('sets.mastered')} value={setProgress.mastered} />
            <StatCard label={t('sets.learning')} value={setProgress.learning} />
            <StatCard label={t('sets.notStarted')} value={setProgress.new} />
          </dl>
        </Card>

        {set.type === 'custom' ? (
          <>
            {/* It can have non-HSK words, which are loaded the first time */}
            <LoadEntries itemIds={set.itemIds}>
              <CustomItemList set={set} items={items} />
            </LoadEntries>
            <Card>
              <AddVocabulary set={set} />
            </Card>
            <CustomSetSettings set={set} />
          </>
        ) : (
          <>
            {words.length > 0 && <ItemList title={t('sets.vocabulary')} items={words} progress={progress} />}
            {characters.length > 0 && <ItemList title={t('sets.characters')} items={characters} progress={progress} />}
          </>
        )}
        <Link
          to={set.type === 'custom' ? '/study/custom' : '/study'}
          className="self-start text-accent-strong underline underline-offset-2"
        >
          {t('sets.backToStudy')}
        </Link>
      </div>
    </>
  )
}

type ItemListProps = { title: string; items: readonly StudyItem[]; progress: ProgressData }

/** List of the set's items; each one opens its dictionary entry. */
function ItemList({ title, items, progress }: ItemListProps) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.slice(0, shown).map((item) => (
          <li key={getStudyItemId(item)}>
            <Link to={getEntryPath(item)} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-paper sm:gap-4 sm:px-4 sm:py-3">
              <EntryLabel entry={item.entry} withMeaning />
              <StatusBadge status={getDisplayStatus(progress, getStudyItemId(item))} />
            </Link>
          </li>
        ))}
      </ul>
      {shown < items.length && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>
            {t('sets.showMore')}
          </Button>
          <span className="text-sm text-ink-muted">{t('dictionary.showing', { count: shown, total: items.length })}</span>
        </div>
      )}
    </section>
  )
}
