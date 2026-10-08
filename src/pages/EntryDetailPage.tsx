import { Link, useParams, useSearchParams } from 'react-router'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { CustomNotesView } from '../features/customSets/components/CustomNotesView.tsx'
import { useCustomSet } from '../features/customSets/customSetsContext.ts'
import { EntryDetails } from '../features/dictionary/components/EntryDetails.tsx'
import { LoadEntries } from '../features/dictionary/components/LoadEntries.tsx'
import { useDictionary } from '../features/dictionary/dictionaryContext.ts'
import { getStudyItem, getStudyItemId, type StudyItem, type StudyItemId } from '../features/dictionary/studyItem.ts'
import { ItemProgressCard } from '../features/progress/components/ItemProgressCard.tsx'
import { isExcluded } from '../features/progress/progress.ts'
import { useProgress } from '../features/progress/progressContext.ts'
import { useStudySets } from '../features/studySets/useStudySets.ts'
import { getSetPath } from '../features/studySets/setPaths.ts'
import { getSetsWithItem } from '../features/studySets/studySets.ts'
import { t } from '../i18n/index.ts'
import { getEntryPath } from '../features/dictionary/entryPaths.ts'
import { describeEntry } from '../features/dictionary/entryDescription.ts'
import { NotFoundPage } from './NotFoundPage.tsx'

/**
 * Entry page for a character (/characters/好) or a word (/vocabulary/你好).
 * If it is not from HSK 1-4, its chunk of the full dictionary is loaded first.
 */
export function EntryDetailPage({ kind }: { kind: StudyItem['kind'] }) {
  const { id = '' } = useParams()
  const itemId: StudyItemId = kind === 'character' ? `char:${id}` : `word:${id}`
  return (
    <LoadEntries itemIds={[itemId]}>
      <Entry itemId={itemId} />
    </LoadEntries>
  )
}

function Entry({ itemId }: { itemId: StudyItemId }) {
  const dictionary = useDictionary()
  const { progress, setItemExcluded } = useProgress()
  // Opened from a custom set (?set=custom-...): also shows the user's notes in that set
  const [searchParams] = useSearchParams()
  const customSet = useCustomSet(searchParams.get('set') ?? undefined)
  const item = getStudyItem(dictionary, itemId)

  if (!item) return <NotFoundPage />

  const isCharacter = item.kind === 'character'
  return (
    <>
      <PageHeader
        title={item.entry.hanzi}
        titleLang="zh-Hans"
        documentTitle={describeEntry(item).title}
        description={t(isCharacter ? 'practice.kind.character' : 'practice.kind.word')}
        actions={
          customSet ? (
            <ButtonLink to={`/study/sets/${encodeURIComponent(customSet.id)}`} variant="secondary">
              {t('session.backToSet', { name: customSet.name })}
            </ButtonLink>
          ) : (
            <ButtonLink to="/dictionary" variant="secondary">
              {t('dictionary.backToDictionary')}
            </ButtonLink>
          )
        }
      />
      <div className="flex max-w-3xl flex-col gap-4 sm:gap-6">
        <EntryDetails item={item} dictionary={dictionary} opener={{ getHref: getEntryPath }} />
        {customSet?.itemIds.includes(getStudyItemId(item)) && <CustomNotesView set={customSet} item={item} />}
        <ItemProgressCard
          item={progress.items[itemId]}
          now={new Date()}
          excluded={isExcluded(progress, itemId) ? { onLearnAfterAll: () => setItemExcluded(itemId, false) } : undefined}
        />
        <StudySetsOfItem item={item} />
      </div>
    </>
  )
}

/** The sets the item is in (it can be in several: 苹果 in HSK 1 and in "Food & drink"). */
function StudySetsOfItem({ item }: { item: StudyItem }) {
  const studySets = useStudySets()
  const sets = getSetsWithItem(studySets, getStudyItemId(item))
  if (sets.length === 0) return null
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">{t('dictionary.inSets')}</h2>
      <ul className="flex flex-wrap gap-2">
        {sets.map((set) => (
          <li key={set.id}>
            <Link
              to={getSetPath(set)}
              className="inline-block rounded-full border border-line bg-paper px-3 py-1 hover:border-accent"
            >
              {set.name}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
