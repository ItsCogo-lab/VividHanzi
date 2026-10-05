import { ProgressBar } from '../../../components/ui/ProgressBar.tsx'
import { t, tCount } from '../../../i18n/index.ts'
import { toDateKey } from '../../../lib/dates.ts'
import { useSettings } from '../../settings/settingsContext.ts'
import { useProgress } from '../progressContext.ts'
import { getGoalStreak } from '../stats.ts'

/** Today's answers against the daily goal (set in Settings), and the days in a row it was met. */
export function DailyGoal({ now }: { now: Date }) {
  const { progress } = useProgress()
  const { dailyGoal } = useSettings().settings
  const answers = progress.activity[toDateKey(now)]?.answers ?? 0
  const streak = getGoalStreak(progress.activity, now, dailyGoal)
  const text = t('goal.progress', { answers: Math.min(answers, dailyGoal), goal: dailyGoal })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-medium">{t('goal.title')}</h3>
        <p className="text-sm text-ink-muted tabular-nums">{text}</p>
      </div>
      <ProgressBar value={Math.min(answers, dailyGoal)} max={dailyGoal} label={`${t('goal.title')}: ${text}`} />
      <p className="text-sm text-ink-muted">
        {answers >= dailyGoal ? t('goal.met') : t('goal.remaining', { count: dailyGoal - answers })}
        {streak > 0 && <> · {tCount(streak, 'goal.streakOne', 'goal.streak')}</>}
      </p>
    </div>
  )
}
