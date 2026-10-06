import type { ReactNode } from 'react'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { Card } from '../components/ui/Card.tsx'
import { DataTable } from '../components/ui/DataTable.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatCard } from '../components/ui/StatCard.tsx'
import { EntryLabel } from '../features/dictionary/components/EntryLabel.tsx'
import { useDictionary, useLoadItems } from '../features/dictionary/dictionaryContext.ts'
import { hskCharacterItems, hskWordItems } from '../features/dictionary/hskDictionary.ts'
import { getStudyItem } from '../features/dictionary/studyItem.ts'
import { useProgress } from '../features/progress/progressContext.ts'
import { AccuracyChart, ActivityCalendar, BarChart } from '../features/progress/components/ProgressCharts.tsx'
import { summarizeSkills, type Skill } from '../features/progress/skills.ts'
import { useSettings } from '../features/settings/settingsContext.ts'
import {
  getAnswerTotals,
  getDifficultItems,
  getRecentActivity,
  getReviewForecast,
  getWeeklyAccuracy,
  summarizeCharacters,
  summarizeItems,
  summarizeWriting,
  type AnswerTotals,
} from '../features/progress/stats.ts'
import { getCurrentStreak, getLongestStreak } from '../features/progress/streak.ts'
import type { ProgressData } from '../features/progress/types.ts'
import { formatPercent, formatShortDay, t, type MessageKey } from '../i18n/index.ts'
import { fromDateKey } from '../lib/dates.ts'

/** Days in the answers chart. */
const RECENT_DAYS = 30

const SKILL_LABELS: Record<Skill, MessageKey> = {
  meaning: 'skills.meaning',
  pinyin: 'skills.pinyin',
  tones: 'skills.tones',
  writing: 'skills.writing',
}

/** Difficult items listed; the practice button covers all of them. */
const MAX_DIFFICULT_SHOWN = 10

export function ProgressPage() {
  const { progress } = useProgress()
  const totals = getAnswerTotals(progress.activity)

  return (
    <>
      <PageHeader title={t('nav.progress')} description={t('progress.description')} />
      {totals.answers === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-ink-muted">{t('stats.empty')}</p>
          <ButtonLink to="/study/practice">{t('dashboard.startSession')}</ButtonLink>
        </Card>
      ) : (
        <Statistics progress={progress} totals={totals} now={new Date()} />
      )}
    </>
  )
}

type StatisticsProps = { progress: ProgressData; totals: AnswerTotals; now: Date }

function Statistics({ progress, totals, now }: StatisticsProps) {
  const { dailyGoal } = useSettings().settings
  const byKind = [
    { label: t('dashboard.characters'), summary: summarizeCharacters(hskCharacterItems, hskWordItems, progress, now) },
    { label: t('dashboard.words'), summary: summarizeItems(hskWordItems, progress, now) },
  ]
  const writing = summarizeWriting(progress)
  const dictionary = useDictionary()
  const difficult = getDifficultItems(progress)
  // An item from a custom set can be non-HSK: its entry is loaded
  useLoadItems(difficult.map((item) => item.itemId))
  const difficultItems = difficult.slice(0, MAX_DIFFICULT_SHOWN).flatMap((item) => {
    const studyItem = getStudyItem(dictionary, item.itemId)
    return studyItem ? [{ studyItem, progress: item }] : []
  })

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <section aria-labelledby="stats-overview">
        <h2 id="stats-overview" className="sr-only">
          {t('stats.overview')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('stats.answers')} value={totals.answers} />
          <StatCard label={t('stats.accuracy')} value={formatPercent(totals.accuracy ?? 0)} />
          <StatCard label={t('stats.streak')} value={getCurrentStreak(progress.activity, now)} />
          <StatCard label={t('stats.longestStreak')} value={getLongestStreak(progress.activity)} />
        </dl>
      </section>

      <StatsSection id="stats-calendar" title={t('charts.calendar')}>
        <ActivityCalendar activity={progress.activity} today={now} goal={dailyGoal} />
      </StatsSection>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <StatsSection id="stats-last-days" title={t('stats.lastDays')}>
          <BarChart
            bars={getRecentActivity(progress.activity, now, RECENT_DAYS).map((day) => ({ date: day.date, value: day.answers }))}
            label={t('stats.lastDays')}
            valueLabel={t('stats.answers')}
            goal={dailyGoal}
            goalLabel={t('charts.goalLine', { goal: dailyGoal })}
          />
        </StatsSection>

        <StatsSection id="stats-accuracy" title={t('charts.accuracyByWeek')}>
          <AccuracyChart weeks={getWeeklyAccuracy(progress.activity, now)} />
        </StatsSection>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <StatsSection id="stats-forecast" title={t('charts.forecast')}>
          <p className="mb-3 text-ink-muted">{t('charts.forecastDescription')}</p>
          <BarChart
            bars={getReviewForecast(progress, now).map((day) => ({ date: day.date, value: day.count }))}
            label={t('charts.forecast')}
            valueLabel={t('charts.reviews')}
            formatEdge={(date) => formatShortDay(fromDateKey(date))}
          />
        </StatsSection>

        <StatsSection id="stats-by-skill" title={t('skills.title')}>
          <p className="mb-3 text-ink-muted">{t('skills.description')}</p>
          <DataTable
            labelledBy="stats-by-skill"
            headers={[t('skills.skill'), t('skills.practiced'), t('skills.solid'), t('stats.accuracy')]}
            rows={summarizeSkills(progress).map((summary) => [
              t(SKILL_LABELS[summary.skill]),
              summary.practiced,
              <span key="solid" className="inline-flex items-center gap-3">
                {/* Decorative bar: the number next to it already gives the value */}
                <span aria-hidden="true" className="hidden h-2 w-16 overflow-hidden rounded-full bg-line sm:inline-block">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${summary.practiced > 0 ? (summary.solid / summary.practiced) * 100 : 0}%` }}
                  />
                </span>
                {summary.solid}
              </span>,
              summary.accuracy === undefined ? '–' : formatPercent(summary.accuracy),
            ])}
          />
        </StatsSection>
      </div>

      <StatsSection id="stats-by-status" title={t('stats.byStatus')}>
        <DataTable
          labelledBy="stats-by-status"
          headers={[t('stats.type'), t('stats.new'), t('stats.learning'), t('stats.mastered')]}
          rows={[
            ...byKind.map(({ label, summary }) => [label, summary.new, summary.learning, summary.mastered]),
            // Writing has its own progress; "new" doesn't apply: anything you can read can be written
            ...(writing.learning + writing.mastered > 0
              ? [[t('stats.writing'), '–', writing.learning, writing.mastered]]
              : []),
          ]}
        />
      </StatsSection>

      <StatsSection id="stats-difficult" title={t('stats.difficult')}>
        {difficult.length === 0 ? (
          <p className="text-ink-muted">{t('stats.difficultEmpty')}</p>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-ink-muted">{t('stats.difficultDescription')}</p>
            <DataTable
              labelledBy="stats-difficult"
              headers={[t('stats.item'), t('stats.mistakes'), t('stats.correct')]}
              rows={difficultItems.map(({ studyItem, progress: item }) => [
                <EntryLabel key="entry" entry={studyItem.entry} withMeaning />,
                item.timesWrong,
                item.timesCorrect,
              ])}
            />
            <ButtonLink to="/study/practice?focus=difficult">
              {t('stats.practiceDifficult', { count: difficult.length })}
            </ButtonLink>
          </div>
        )}
      </StatsSection>
    </div>
  )
}

function StatsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 id={id} className="mb-3 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </Card>
  )
}
