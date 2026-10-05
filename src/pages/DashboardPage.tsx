import { Link } from 'react-router'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { ProgressBar } from '../components/ui/ProgressBar.tsx'
import { StatCard } from '../components/ui/StatCard.tsx'
import { hskCharacterItems, hskWordItems } from '../features/dictionary/hskDictionary.ts'
import { useMyStudies } from '../features/myStudies/myStudiesContext.ts'
import { EXERCISE_TYPES } from '../features/practice/exerciseDefinitions.ts'
import { EXERCISE_TYPE_LABELS } from '../features/practice/exerciseLabels.ts'
import { DailyGoal } from '../features/progress/components/DailyGoal.tsx'
import { useProgress } from '../features/progress/progressContext.ts'
import { summarizeCharacters, summarizeItems, type ItemsSummary } from '../features/progress/stats.ts'
import { getCurrentStreak } from '../features/progress/streak.ts'
import { useStudySets } from '../features/studySets/useStudySets.ts'
import { getSetPath } from '../features/studySets/setPaths.ts'
import { SetSessionButtons } from '../features/studySets/components/SetSessionActions.tsx'
import { SetProgressBar } from '../features/studySets/components/SetProgressBar.tsx'
import { getSetProgress } from '../features/studySets/setProgress.ts'
import { getStudySet } from '../features/studySets/studySets.ts'
import { TodaysWord } from '../features/todaysWord/TodaysWord.tsx'
import { t, type MessageKey } from '../i18n/index.ts'

/** My Studies sets shown on Home; the rest, in Study. */
const MAX_SETS_ON_HOME = 3

/** What to say in "Today" depending on how the user is doing. */
function getTodayMessage(summary: ItemsSummary): MessageKey {
  if (summary.due > 0) return 'dashboard.message.due'
  if (summary.studied === 0) return 'dashboard.message.welcome'
  if (summary.new > 0) return 'dashboard.message.learnNew'
  return 'dashboard.message.allDone'
}

export function DashboardPage() {
  const { progress } = useProgress()
  const { myStudies } = useMyStudies()
  const studySets = useStudySets()
  const now = new Date()
  const summary = summarizeItems(hskWordItems, progress, now)
  const studyingSets = myStudies.sets
    .map(({ setId }) => getStudySet(studySets, setId))
    .filter((set) => set !== undefined)
    .slice(0, MAX_SETS_ON_HOME)

  return (
    <>
      <PageHeader
        title={t('nav.dashboard')}
        description={t('dashboard.description')}
        actions={
          <ButtonLink to="/study/practice">{t('dashboard.startSession')}</ButtonLink>
        }
      />

      <div className="flex flex-col gap-4 sm:gap-6">
        <Card>
          <h2 className="text-lg font-semibold">{t('dashboard.today')}</h2>
          <p className="mt-1 text-ink-muted">{t(getTodayMessage(summary))}</p>
          <div className="mt-4 border-t border-line pt-4">
            <DailyGoal now={now} />
          </div>
        </Card>

        <TodaysWord now={now} />

        <Card>
          <h2 className="text-lg font-semibold">{t('dashboard.practiceType')}</h2>
          <p className="mt-1 mb-4 text-ink-muted">{t('dashboard.practiceTypeDescription')}</p>
          <ul className="flex flex-wrap gap-2">
            {EXERCISE_TYPES.map((type) => (
              <li key={type}>
                <ButtonLink to={`/study/practice?type=${type}`} variant="secondary">
                  {t(EXERCISE_TYPE_LABELS[type])}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>

        <section aria-labelledby="dashboard-overview">
          <h2 id="dashboard-overview" className="sr-only">
            {t('dashboard.overview')}
          </h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t('stats.due')} value={summary.due} />
            <StatCard label={t('stats.streak')} value={getCurrentStreak(progress.activity, now)} />
            <StatCard
              label={t('stats.studied')}
              value={summary.studied}
              detail={t('stats.studiedOf', { total: summary.total })}
            />
            <StatCard label={t('stats.mastered')} value={summary.mastered} />
          </dl>
        </section>

        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('study.myStudies')}</h2>
            <Link to="/study" className="text-accent-strong underline underline-offset-2">
              {t('dashboard.allSets')}
            </Link>
          </div>
          {studyingSets.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-ink-muted">{t('myStudies.empty')}</p>
              <ButtonLink to="/study/hsk" variant="secondary">
                {t('myStudies.browseHsk')}
              </ButtonLink>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 sm:gap-5">
              {studyingSets.map((set) => (
                <li key={set.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link to={getSetPath(set)} className="font-medium hover:text-accent-strong hover:underline">
                      {set.name}
                    </Link>
                    <SetProgressBar name={set.name} progress={getSetProgress(set, progress, now)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SetSessionButtons set={set} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.hskProgress')}</h2>
          <div className="flex flex-col gap-3 sm:gap-5">
            <KindProgress
              label={t('dashboard.characters')}
              summary={summarizeCharacters(hskCharacterItems, hskWordItems, progress, now)}
            />
            <KindProgress label={t('dashboard.words')} summary={summarizeItems(hskWordItems, progress, now)} />
          </div>
        </Card>
      </div>
    </>
  )
}

function KindProgress({ label, summary }: { label: string; summary: ItemsSummary }) {
  const text = t('dashboard.kindProgress', {
    studied: summary.studied,
    total: summary.total,
    mastered: summary.mastered,
  })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-medium">{label}</h3>
        <p className="text-sm text-ink-muted">{text}</p>
      </div>
      <ProgressBar value={summary.studied} max={summary.total} label={`${label}: ${text}`} />
    </div>
  )
}
