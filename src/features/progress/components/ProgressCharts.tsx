import { formatDayMonth, formatMonth, formatPercent, formatShortDay, t } from '../../../i18n/index.ts'
import { fromDateKey, type DateKey } from '../../../lib/dates.ts'
import type { CalendarDay, WeekAccuracy } from '../stats.ts'

/**
 * Charts for the Progress page, drawn with plain HTML and SVG (no chart
 * library). Each one has a hidden table with the same figures for screen
 * readers, and a native tooltip (title) on every mark.
 */

// --- Activity calendar -------------------------------------------------------

/** How strongly a day is colored, from what was done compared to the daily goal. */
function getCalendarLevel(answers: number, goal: number): 0 | 1 | 2 | 3 {
  if (answers === 0) return 0
  if (answers >= goal) return 3
  return answers >= goal / 2 ? 2 : 1
}

const CALENDAR_LEVEL_CLASSES = ['bg-line', 'bg-accent/30', 'bg-accent/60', 'bg-accent'] as const

type ActivityCalendarProps = {
  weeks: readonly (readonly CalendarDay[])[]
  goal: number
}

/** One square per day, one column per week (Monday on top), like GitHub's contribution graph. */
export function ActivityCalendar({ weeks, goal }: ActivityCalendarProps) {
  const days = weeks.flat().filter((day) => !day.future)
  const studied = days.filter((day) => day.answers > 0).length
  const goalDays = days.filter((day) => day.answers >= goal).length
  const columns = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }

  return (
    // Capped width: on a wide screen 26 columns would make huge squares
    <figure className="flex max-w-xl flex-col gap-2">
      {/* Month names over the first week that starts in each month */}
      <div aria-hidden="true" className="grid gap-[3px] text-xs text-ink-muted" style={columns}>
        {weeks.map((week, index) => {
          const monday = fromDateKey(week[0]!.date)
          return (
            <span key={week[0]!.date} className="overflow-visible whitespace-nowrap">
              {(index === 0 || monday.getDate() <= 7) && index < weeks.length - 1 ? formatMonth(monday) : ''}
            </span>
          )
        })}
      </div>
      <div
        role="img"
        aria-label={t('charts.calendarSummary', { studied, days: days.length, goalDays })}
        className="grid grid-flow-col grid-rows-7 gap-[3px]"
        style={columns}
      >
        {weeks.flat().map((day) => (
          <span
            key={day.date}
            title={day.future ? undefined : t('charts.dayAnswers', { day: formatShortDay(fromDateKey(day.date)), count: day.answers })}
            className={`aspect-square rounded-[3px] ${day.future ? '' : CALENDAR_LEVEL_CLASSES[getCalendarLevel(day.answers, goal)]}`}
          />
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>{t('charts.calendarCaption', { studied, goalDays })}</span>
        <span aria-hidden="true" className="flex items-center gap-1">
          {t('charts.less')}
          {CALENDAR_LEVEL_CLASSES.map((className) => (
            <span key={className} className={`size-3 rounded-[3px] ${className}`} />
          ))}
          {t('charts.goalMet')}
        </span>
      </figcaption>
    </figure>
  )
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

/** Vertical bars from a baseline, one per day. */
export function BarChart({ bars, label, valueLabel, goal, goalLabel, formatEdge = formatDayEdge }: BarChartProps) {
  const max = Math.max(...bars.map((bar) => bar.value), goal ?? 0, 1)
  const first = bars[0]
  const last = bars.at(-1)

  return (
    <figure className="flex flex-col gap-1">
      <div aria-hidden="true" className={`relative flex ${BAR_CHART_HEIGHT} items-end gap-0.5 border-b border-line`}>
        {goal !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-muted/50"
            style={{ bottom: `${(goal / max) * 100}%` }}
          >
            <span className="absolute -top-5 right-0 bg-surface px-1 text-xs text-ink-muted">{goalLabel}</span>
          </div>
        )}
        {bars.map((bar) => (
          // Full-height column so the tooltip is easy to hit even for short bars
          <div
            key={bar.date}
            title={`${formatShortDay(fromDateKey(bar.date))}: ${bar.value}`}
            className="flex h-full min-w-0 flex-1 items-end justify-center"
          >
            <div
              className="w-full max-w-10 rounded-t bg-accent"
              style={{ height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      {first && last && (
        <div aria-hidden="true" className="flex justify-between text-xs text-ink-muted">
          <span>{formatEdge(first.date)}</span>
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
