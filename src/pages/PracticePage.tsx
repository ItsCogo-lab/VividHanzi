import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../components/ui/Button.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { CustomNotesView } from '../features/customSets/components/CustomNotesView.tsx'
import { useCustomSet } from '../features/customSets/customSetsContext.ts'
import { LoadEntries } from '../features/dictionary/components/LoadEntries.tsx'
import { useDictionary } from '../features/dictionary/dictionaryContext.ts'
import { hskStudyItems, hskWordItems } from '../features/dictionary/hskDictionary.ts'
import { getStudyItem, getStudyItemId, type StudyItem, type StudyItemId } from '../features/dictionary/studyItem.ts'
import { useMyStudies } from '../features/myStudies/myStudiesContext.ts'
import { LearnSession } from '../features/practice/components/LearnSession.tsx'
import { PracticeSession } from '../features/practice/components/PracticeSession.tsx'
import { EXERCISE_DEFINITIONS, getDefinitions, type ExerciseDefinition } from '../features/practice/exerciseDefinitions.ts'
import { EXERCISE_TYPE_LABELS } from '../features/practice/exerciseLabels.ts'
import { createSessionExercises } from '../features/practice/session.ts'
import { selectWritingItems, WRITING_MIN_LEVEL } from '../features/practice/writing.ts'
import { useProgress } from '../features/progress/progressContext.ts'
import { getDifficultItems } from '../features/progress/stats.ts'
import type { ProgressData } from '../features/progress/types.ts'
import type { Settings } from '../features/settings/settings.ts'
import { useSettings } from '../features/settings/settingsContext.ts'
import { useStudySets } from '../features/studySets/useStudySets.ts'
import { SessionTypeLabel } from '../features/studySets/components/SessionTypeLabel.tsx'
import { getLearnableItems, getReviewItems } from '../features/studySets/sessionItems.ts'
import { getSetPath, getSetSessionPath } from '../features/studySets/setPaths.ts'
import { getStudySet } from '../features/studySets/studySets.ts'
import type { StudySet } from '../features/studySets/types.ts'
import { t } from '../i18n/index.ts'
import { NotFoundPage } from './NotFoundPage.tsx'

let nextSessionId = 0

function createPracticeSession(pool: readonly StudyItem[], progress: ProgressData, settings: Settings) {
  nextSessionId += 1
  // Wrong answers come from the whole dictionary, even if the set is small
  const exercises = createSessionExercises(pool, {
    progress,
    size: settings.sessionSize,
    distractorPool: hskStudyItems,
    definitions: getDefinitions(settings.exerciseTypes),
    writing: settings.exerciseTypes.includes('writing'),
  })
  return { id: nextSessionId, exercises }
}

/**
 * Study sessions. With a set, the URL sets the session context:
 * /study/practice?set=hsk-1&mode=learn (new vocabulary) or &mode=study
 * (review of what was learned; &scope=all includes what is not due yet).
 * With ?focus=difficult, a session with the difficult items (see isDifficult);
 * with ?focus=writing, a writing-only session (see selectWritingItems); with
 * ?type=pinyin-choice (or any other type), a session of that type only.
 * Without a set, the mixed session over all vocabulary. The `key` makes
 * changing set or type create a new session.
 */
export function PracticePage() {
  const [searchParams] = useSearchParams()
  const studySets = useStudySets()
  const setId = searchParams.get('set')
  if (searchParams.get('focus') === 'difficult') return <DifficultPractice />
  const type = searchParams.get('type')
  if (searchParams.get('focus') === 'writing' || type === 'writing') return <WritingPractice />
  if (type !== null) {
    const definition = EXERCISE_DEFINITIONS.find((candidate) => candidate.type === type)
    return definition ? <TypePractice key={type} definition={definition} /> : <NotFoundPage />
  }
  if (setId === null) return <Practice />

  const set = getStudySet(studySets, setId)
  const mode = searchParams.get('mode') ?? 'study'
  if (!set || (mode !== 'learn' && mode !== 'study')) return <NotFoundPage />
  const reviewAll = searchParams.get('scope') === 'all'
  return (
    <>
      <PageHeader title={set.name} />
      <div className="mb-4 sm:mb-6">
        <SessionTypeLabel type={mode} />
      </div>
      {/* A custom set can have non-HSK words: the session starts once they are loaded */}
      <LoadEntries itemIds={set.itemIds}>
        {mode === 'learn' ? (
          <LearnPractice key={`${set.id}:learn`} set={set} />
        ) : (
          <StudyPractice key={`${set.id}:study:${reviewAll}`} set={set} reviewAll={reviewAll} />
        )}
      </LoadEntries>
    </>
  )
}

/** Mixed session over all vocabulary (due reviews and new items). */
function Practice() {
  const dictionary = useDictionary()
  const { progress, recordResult } = useProgress()
  const { settings } = useSettings()
  // useState with a function: the session is created once on entering, not on every render.
  // It uses the progress at that moment; answers do not change the ongoing session.
  const [session, setSession] = useState(() => createPracticeSession(hskWordItems, progress, settings))

  return (
    <>
      <PageHeader title={t('practice.title')} description={t('practice.description')} />
      {/* key: a new session mounts a new PracticeSession, with its state from scratch */}
      <PracticeSession
        key={session.id}
        exercises={session.exercises}
        dictionary={dictionary}
        onResult={recordResult}
        onRestart={() => setSession(createPracticeSession(hskWordItems, progress, settings))}
      />
    </>
  )
}

/**
 * A session of one exercise type only, over all vocabulary, whatever the
 * Settings say. Items that can't be asked that way (了 in a tone question,
 * since it has two readings) are left out; otherwise the usual priorities
 * apply (see selectSessionItems).
 */
function TypePractice({ definition }: { definition: ExerciseDefinition }) {
  const dictionary = useDictionary()
  const { progress, recordResult } = useProgress()
  const { sessionSize } = useSettings().settings
  const name = t(EXERCISE_TYPE_LABELS[definition.type])
  const createSession = (current: ProgressData) => {
    nextSessionId += 1
    const pool = hskWordItems.filter((item) => definition.canBuild(item, hskStudyItems))
    const exercises = createSessionExercises(pool, {
      progress: current,
      size: sessionSize,
      distractorPool: hskStudyItems,
      definitions: [definition],
    })
    return { id: nextSessionId, exercises }
  }
  const [session, setSession] = useState(() => createSession(progress))

  return (
    <>
      <PageHeader title={t('practice.typeTitle', { type: name })} description={t('practice.typeDescription')} />
      <PracticeSession
        key={session.id}
        exercises={session.exercises}
        dictionary={dictionary}
        onResult={recordResult}
        onRestart={() => setSession(createSession(progress))}
      />
    </>
  )
}

/**
 * Session with the difficult items only. The list is taken on entering: an
 * item that stops being difficult during the session stays until it ends.
 */
function DifficultPractice() {
  const { progress } = useProgress()
  const [itemIds] = useState(() => getDifficultItems(progress).map((item) => item.itemId))

  return (
    <>
      <PageHeader title={t('practice.difficultTitle')} description={t('practice.difficultDescription')} />
      {/* A custom set item can be non-HSK: its entry is loaded first */}
      <LoadEntries itemIds={itemIds}>
        <DifficultSession itemIds={itemIds} />
      </LoadEntries>
    </>
  )
}

function DifficultSession({ itemIds }: { itemIds: readonly StudyItemId[] }) {
  const dictionary = useDictionary()
  const { progress, recordResult } = useProgress()
  const { settings } = useSettings()
  const createSession = (current: ProgressData) => {
    const pool = itemIds.flatMap((itemId) => getStudyItem(dictionary, itemId) ?? [])
    return createPracticeSession(pool, current, settings)
  }
  const [session, setSession] = useState(() => createSession(progress))

  if (session.exercises.length === 0) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
        <p className="text-lg">{t('practice.difficultEmpty')}</p>
        <ButtonLink to="/progress" variant="secondary">
          {t('nav.progress')}
        </ButtonLink>
      </Card>
    )
  }

  return (
    <PracticeSession
      key={session.id}
      exercises={session.exercises}
      dictionary={dictionary}
      onResult={recordResult}
      onRestart={() => setSession(createSession(progress))}
    />
  )
}

/**
 * Practice writing: only writing exercises, whenever the user wants, with
 * everything they can already read (any set, so entries may need loading).
 * It doesn't depend on the Settings switch, which is about Study sessions.
 */
function WritingPractice() {
  const { progress } = useProgress()
  const [itemIds] = useState(() =>
    Object.values(progress.items)
      .filter((item) => item !== undefined)
      .filter((item) => item.masteryLevel >= WRITING_MIN_LEVEL)
      .map((item) => item.itemId),
  )

  return (
    <>
      <PageHeader title={t('practice.writingTitle')} description={t('practice.writingDescription')} />
      <LoadEntries itemIds={itemIds}>
        <WritingSession itemIds={itemIds} />
      </LoadEntries>
    </>
  )
}

function WritingSession({ itemIds }: { itemIds: readonly StudyItemId[] }) {
  const dictionary = useDictionary()
  const { progress, recordResult } = useProgress()
  const { sessionSize } = useSettings().settings
  const createSession = (current: ProgressData) => {
    nextSessionId += 1
    const pool = itemIds.flatMap((itemId) => getStudyItem(dictionary, itemId) ?? [])
    const items = selectWritingItems(pool, current, new Date(), sessionSize)
    return { id: nextSessionId, exercises: items.map((item) => ({ type: 'writing' as const, item })) }
  }
  const [session, setSession] = useState(() => createSession(progress))

  if (session.exercises.length === 0) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
        <p className="text-lg">{t('practice.writingEmpty')}</p>
        <ButtonLink to="/study" variant="secondary">
          {t('nav.study')}
        </ButtonLink>
      </Card>
    )
  }

  return (
    <PracticeSession
      key={session.id}
      exercises={session.exercises}
      dictionary={dictionary}
      onResult={recordResult}
      onRestart={() => setSession(createSession(progress))}
    />
  )
}

/** Marks the set as studied today on the first action of each session. */
function useMarkSetStudied(set: StudySet) {
  const { markSetStudied } = useMyStudies()
  const [markedSession, setMarkedSession] = useState<number>()
  return (sessionId: number) => {
    if (markedSession === sessionId) return
    markSetStudied(set.id)
    setMarkedSession(sessionId)
  }
}

/**
 * Study: review. Only already learned items of the set go in, due ones first.
 * If none are due, reviewing anyway is offered (scope=all), but an unlearned
 * item never slips in.
 */
function StudyPractice({ set, reviewAll }: { set: StudySet; reviewAll: boolean }) {
  const dictionary = useDictionary()
  const { progress, recordResult } = useProgress()
  const { settings } = useSettings()
  const markStudied = useMarkSetStudied(set)

  const createSession = (current: ProgressData) => {
    const { due, upToDate } = getReviewItems(set, dictionary, current, new Date())
    const pool = reviewAll ? [...due, ...upToDate] : due
    return { ...createPracticeSession(pool, current, settings), learnedCount: due.length + upToDate.length }
  }
  const [session, setSession] = useState(() => createSession(progress))

  if (session.exercises.length === 0) {
    return session.learnedCount === 0 ? (
      <EmptySession set={set} message={t('session.studyEmpty')}>
        <ButtonLink to={getSetSessionPath(set, 'learn')}>{t('session.startLearning')}</ButtonLink>
      </EmptySession>
    ) : (
      <EmptySession set={set} message={t('session.studyUpToDate')}>
        <ButtonLink to={getSetSessionPath(set, 'study', { reviewAll: true })}>{t('session.reviewAnyway')}</ButtonLink>
      </EmptySession>
    )
  }

  return (
    <>
      {reviewAll && <p className="mb-4 text-sm text-ink-muted">{t('session.reviewingAll')}</p>}
      <PracticeSession
        key={session.id}
        exercises={session.exercises}
        dictionary={dictionary}
        onResult={(result) => {
          recordResult(result)
          markStudied(session.id)
        }}
        onRestart={() => setSession(createSession(progress))}
      />
    </>
  )
}

/** Learn: introduces set items that have not been learned yet. */
function LearnPractice({ set }: { set: StudySet }) {
  const dictionary = useDictionary()
  const { progress, introduceItem, markItemKnown } = useProgress()
  // In a custom set, the user's notes accompany the entry
  const customSet = useCustomSet(set.type === 'custom' ? set.id : undefined)
  const { sessionSize } = useSettings().settings
  const markStudied = useMarkSetStudied(set)

  const createSession = (current: ProgressData) => {
    nextSessionId += 1
    return { id: nextSessionId, items: getLearnableItems(set, dictionary, current).slice(0, sessionSize) }
  }
  const [session, setSession] = useState(() => createSession(progress))

  if (session.items.length === 0) {
    return (
      <EmptySession set={set} message={t('session.learnEmpty')}>
        <ButtonLink to={getSetSessionPath(set, 'study')}>{t('session.study')}</ButtonLink>
      </EmptySession>
    )
  }

  return (
    <LearnSession
      key={session.id}
      items={session.items}
      dictionary={dictionary}
      onLearned={(item) => {
        introduceItem(getStudyItemId(item))
        markStudied(session.id)
      }}
      onKnown={(item) => {
        markItemKnown(getStudyItemId(item))
        markStudied(session.id)
      }}
      renderExtra={customSet && ((item) => <CustomNotesView set={customSet} item={item} />)}
      summaryActions={
        <>
          <ButtonLink to={getSetSessionPath(set, 'study')} variant="secondary">
            {t('learn.reviewNow')}
          </ButtonLink>
          <Button onClick={() => setSession(createSession(progress))}>{t('learn.more')}</Button>
        </>
      }
    />
  )
}

/** Session without items: explains why and offers the action that makes sense. It never switches type on its own. */
function EmptySession({ set, message, children }: { set: StudySet; message: string; children: ReactNode }) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
      <p className="text-lg">{message}</p>
      <div className="flex flex-wrap gap-2">
        {children}
        <ButtonLink to={getSetPath(set)} variant="secondary">
          {t('session.backToSet', { name: set.name })}
        </ButtonLink>
      </div>
    </Card>
  )
}
