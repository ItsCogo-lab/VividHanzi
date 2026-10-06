import { formatDayMonth, formatMonth, formatPercent, formatShortDay, formatWeekday, t } from '../../../i18n/index.ts'
import { addDays, fromDateKey, type DateKey } from '../../../lib/dates.ts'
import { useElementWidth } from '../../../lib/useElementWidth.ts'
import { getActivityCalendar, getGoalLevel, type CalendarDay, type GoalLevel, type WeekAccuracy } from '../stats.ts'
import type { DailyActivity } from '../types.ts'

/**
 * Charts for the Progress page, drawn with plain HTML and SVG (no chart
 * library). Each one has a hidden table with the same figures for screen
 * readers, and a native tooltip (title) on every mark.
 */

// --- Activity calendar -------------------------------------------------------

/** Fill of a day (or a bar) for each goal level: stronger as the day goes past the goal. */
const GOAL_LEVEL_CLASSES: Record<GoalLevel, string> = {
  0: 'bg-line',
  1: 'bg-accent/30',
  2: 'bg-accent/60',
  3: 'bg-accent',
  4: 'bg-goal-over',
  5: 'bg-goal-double',
}

const CELL_PX = 14
const GAP_PX = 3
/** Column for the weekday names. */
const LABEL_PX = 28
/** Weeks shown: as many as fit, between a couple of months and a year. */
const MIN_WEEKS = 8
const MAX_WEEKS = 53
/** Before the width is known (first render, tests). */
const DEFAULT_WEEKS = 26
/** Rows with a weekday name: Monday, Wednesday and Friday, like GitHub. */
const LABELED_WEEKDAYS = [0, 2, 4]

type ActivityCalendarProps = {
  activity: Record<DateKey, DailyActivity>
  today: Date
  goal: number
}

/**
 * One square per day, one column per week (Monday on top), like GitHub's
 * contribution graph. Squares keep their size; the calendar shows as many
 * weeks as fit in its width, today in the last column.
 */
export function ActivityCalendar({ activity, today, goal }: ActivityCalendarProps) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>()
  const fitting = width === undefined ? DEFAULT_WEEKS : Math.floor((width - LABEL_PX) / (CELL_PX + GAP_PX))
  const weeks = getActivityCalendar(activity, today, Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, fitting)))
  const days = weeks.flat().filter((day) => !day.future)
  const studied = days.filter((day) => day.answers > 0).length
  const goalDays = days.filter((day) => day.answers >= goal).length
  const firstMonday = fromDateKey(weeks[0]![0]!.date)

  return (
    <figure className="flex flex-col gap-3">
      <div ref={frameRef} className="w-full overflow-hidden">
        <div
          role="img"
          aria-label={t('charts.calendarSummary', { studied, days: days.length, goalDays })}
          className="grid w-max"
          style={{
            gridTemplateColumns: `${LABEL_PX}px repeat(${weeks.length}, ${CELL_PX}px)`,
            gridTemplateRows: `auto repeat(7, ${CELL_PX}px)`,
            gap: GAP_PX,
          }}
        >
          {/* Month names over the first week that starts in each month */}
          {weeks.map((week, index) => {
            const monday = fromDateKey(week[0]!.date)
            if (!showsMonth(weeks, index)) return null
            return (
              <span
                key={`month-${week[0]!.date}`}
                className="pb-1 text-xs whitespace-nowrap text-ink-muted"
                style={{ gridRow: 1, gridColumn: `${index + 2} / span ${Math.min(3, weeks.length - index)}` }}
              >
                {formatMonth(monday)}
              </span>
            )
          })}
          {LABELED_WEEKDAYS.map((weekday) => (
            <span
              key={`weekday-${weekday}`}
              className="text-[10px] leading-[14px] text-ink-muted"
              style={{ gridRow: weekday + 2, gridColumn: 1 }}
            >
              {formatWeekday(addDays(firstMonday, weekday))}
            </span>
          ))}
          {weeks.map((week, index) =>
            week.map((day, weekday) => (
              <span
                key={day.date}
                title={day.future ? undefined : t('charts.dayAnswers', { day: formatShortDay(fromDateKey(day.date)), count: day.answers })}
                className={`rounded-[3px] ${day.future ? '' : GOAL_LEVEL_CLASSES[getGoalLevel(day.answers, goal)]}`}
                style={{ gridRow: weekday + 2, gridColumn: index + 2 }}
              />
            )),
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>{t('charts.calendarCaption', { studied, goalDays })}</span>
        {/* Under the goal, the goal, then the stronger shades for going past it */}
        <span aria-hidden="true" className="flex items-center gap-1">
          {t('charts.less')}
          <LegendSquares levels={[0, 1, 2]} />
          <span className="ml-1">{t('charts.goalMet')}</span>
          <LegendSquares levels={[3, 4, 5]} />
          {t('charts.doubleGoal')}
        </span>
      </figcaption>
    </figure>
  )
}

const startsMonth = (week: readonly CalendarDay[]) => fromDateKey(week[0]!.date).getDate() <= 7

/**
 * Whether a week gets its month's name. The first column gets it even
 * mid-month, unless the next month's name comes so soon they would overlap.
 */
function showsMonth(weeks: readonly (readonly CalendarDay[])[], index: number): boolean {
  if (index > 0) return startsMonth(weeks[index]!)
  return startsMonth(weeks[0]!) || !weeks.slice(1, 3).some(startsMonth)
}

function LegendSquares({ levels }: { levels: readonly GoalLevel[] }) {
  return levels.map((level) => <span key={level} className={`size-3 rounded-[3px] ${GOAL_LEVEL_CLASSES[level]}`} />)
}

// --- Bar chart ---------------------------------------------------------------

export interface Bar {
  date: DateKey
  value: number
}

type BarChartProps = {
  bars: readonly Bar[]
  /** Heading of the hidden table and name of the value column. */
  label: string
  valueLabel: string
  /** Dashed reference line, e.g. the daily goal. */
  goal?: number
  goalLabel?: string
  /** Text under the first and last bar (the rest would not fit on a phone); "Sep 28" by default. */
  formatEdge?: (date: DateKey) => string
}

const BAR_CHART_HEIGHT = 'h-32'

/** Bars against a goal: under it in a lighter shade, past it in the calendar's stronger ones. */
const BAR_LEVEL_CLASSES: Record<GoalLevel, string> = {
  ...GOAL_LEVEL_CLASSES,
  1: 'bg-accent/50',
  2: 'bg-accent/50',
}

/** Vertical bars from a baseline, one per day. */
export function BarChart({ bars, label, valueLabel, goal, goalLabel, formatEdge = formatDayEdge }: BarChartProps) {
  const max = Math.max(...bars.map((bar) => bar.value), goal ?? 0, 1)
  const first = bars[0]
  const last = bars.at(-1)

  return (
    <figure className="flex flex-col gap-1">
      <div aria-hidden="true" className={`relative flex ${BAR_CHART_HEIGHT} items-end gap-0.5 border-b border-line`}>
        {/* Drawn over the bars; its label goes under the chart, where it hides nothing */}
        {goal !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink-muted/60"
            style={{ bottom: `${(goal / max) * 100}%` }}
          />
        )}
        {bars.map((bar) => (
          // Full-height column so the tooltip is easy to hit even for short bars
          <div
            key={bar.date}
            title={`${formatShortDay(fromDateKey(bar.date))}: ${bar.value}`}
            className="flex h-full min-w-0 flex-1 items-end justify-center"
          >
            <div
              className={`w-full max-w-10 rounded-t ${goal === undefined ? 'bg-accent' : BAR_LEVEL_CLASSES[getGoalLevel(bar.value, goal)]}`}
              style={{ height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      {first && last && (
        <div aria-hidden="true" className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span>{formatEdge(first.date)}</span>
          {goal !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-ink-muted/60" />
              {goalLabel}
            </span>
          )}
          <span>{formatEdge(last.date)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t('stats.day')}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.date}>
              <th scope="row">{formatShortDay(fromDateKey(bar.date))}</th>
              <td>{bar.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const formatDayEdge = (date: DateKey) => formatDayMonth(fromDateKey(date))

// --- Accuracy line -----------------------------------------------------------

const LINE_WIDTH = 320
const LINE_HEIGHT = 120
const LINE_PADDING = { top: 8, right: 8, bottom: 8, left: 36 }

/** Weekly accuracy as a line from 0% to 100%; weeks without answers leave a gap. */
export function AccuracyChart({ weeks }: { weeks: readonly WeekAccuracy[] }) {
  const plotWidth = LINE_WIDTH - LINE_PADDING.left - LINE_PADDING.right
  const plotHeight = LINE_HEIGHT - LINE_PADDING.top - LINE_PADDING.bottom
  const x = (index: number) => LINE_PADDING.left + (weeks.length > 1 ? (index / (weeks.length - 1)) * plotWidth : plotWidth / 2)
  const y = (accuracy: number) => LINE_PADDING.top + (1 - accuracy) * plotHeight

  // One path segment per run of consecutive weeks with answers
  const path = weeks
    .map((week, index) => {
      if (week.accuracy === undefined) return ''
      const command = weeks[index - 1]?.accuracy === undefined ? 'M' : 'L'
      return `${command}${x(index)},${y(week.accuracy)}`
    })
    .join(' ')
  const first = weeks[0]
  const last = weeks.at(-1)

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} className="h-auto w-full overflow-visible" aria-hidden="true">
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={LINE_PADDING.left}
              x2={LINE_WIDTH - LINE_PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text x={LINE_PADDING.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-ink-muted text-[10px]">
              {formatPercent(tick)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {weeks.map((week, index) =>
          week.accuracy === undefined ? null : (
            <g key={week.weekStart}>
              <circle cx={x(index)} cy={y(week.accuracy)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />
              {/* Bigger invisible target for the tooltip */}
              <circle cx={x(index)} cy={y(week.accuracy)} r={12} fill="transparent">
                <title>{weekLabel(week)}</title>
              </circle>
            </g>
          ),
        )}
      </svg>
      {first && last && (
        <div aria-hidden="true" className="flex justify-between pl-[11%] text-xs text-ink-muted">
          <span>{formatDayEdge(first.weekStart)}</span>
          <span>{formatDayEdge(last.weekStart)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{t('charts.accuracyByWeek')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('charts.week')}</th>
            <th scope="col">{t('stats.accuracy')}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{formatDayEdge(week.weekStart)}</th>
              <td>{week.accuracy === undefined ? '–' : formatPercent(week.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function weekLabel(week: WeekAccuracy): string {
  return t('charts.weekAccuracy', {
    week: formatDayEdge(week.weekStart),
    accuracy: formatPercent(week.accuracy ?? 0),
    count: week.answers,
  })
}
