import { toDateKey } from '../../lib/dates.ts'
import type { CustomSet } from '../customSets/types.ts'
import type { StudyItemId } from '../dictionary/studyItem.ts'
import { getItemStatus, isDue, MASTERED_LEVEL } from '../progress/progress.ts'
import { SKILLS, summarizeSkills, type RecognitionSkill } from '../progress/skills.ts'
import { getAnswerTotals, getDifficultItems, getRecentActivity } from '../progress/stats.ts'
import { getCurrentStreak, getLongestStreak } from '../progress/streak.ts'
import type { ItemProgress, ProgressData } from '../progress/types.ts'
import type { Settings } from '../settings/settings.ts'
import { MAX_MASTERY_LEVEL, REVIEW_INTERVAL_DAYS } from '../srs/srs.ts'

/** Version of the JSON export format; bump it if its shape changes. */
export const EXPORT_VERSION = 1

/** Everything the user has saved, as one plain JSON object (see buildDataExport). */
export interface DataExport {
  app: 'VividHanzi'
  version: typeof EXPORT_VERSION
  exportedAt: string
  progress: ProgressData
  settings: Settings
  customSets: readonly CustomSet[]
}

export function buildDataExport(
  progress: ProgressData,
  settings: Settings,
  customSets: readonly CustomSet[],
  now: Date,
): DataExport {
  return { app: 'VividHanzi', version: EXPORT_VERSION, exportedAt: now.toISOString(), progress, settings, customSets }
}

/** What the summary shows of an item; the summary itself doesn't know the dictionary. */
export interface ItemLabel {
  hanzi: string
  pinyin: string
  meaning: string
}

export type DescribeItem = (itemId: StudyItemId) => ItemLabel | undefined

/** Meanings shown per item: enough to know which sense it is, short enough for a table. */
const MAX_MEANING_LENGTH = 60

/**
 * A readable Markdown summary of what the user is learning and how it is
 * going, meant to be pasted into an AI assistant (or read by the user). It
 * explains the app's own terms (levels, skills) so the reader needs no other
 * context. Items marked by HSK level and never answered are only counted:
 * listing hundreds of words the user already knew adds nothing.
 */
export function buildStudySummary(
  progress: ProgressData,
  settings: Settings,
  customSets: readonly CustomSet[],
  describe: DescribeItem,
  now: Date,
): string {
  const label = (itemId: StudyItemId): ItemLabel =>
    describe(itemId) ?? { hanzi: itemId.slice(itemId.indexOf(':') + 1), pinyin: '', meaning: '' }
  const records = Object.values(progress.items).filter((item) => item !== undefined)
  const listed = records.filter((item) => !item.fromLevel)
  const totals = getAnswerTotals(progress.activity)
  const lastWeek = getRecentActivity(progress.activity, now, 7)
  const lines: string[] = []

  lines.push(
    '# My Chinese study data (VividHanzi)',
    '',
    `Exported on ${toDateKey(now)}. VividHanzi is a spaced repetition app for Chinese words and characters (HSK 2.0, simplified).`,
    '',
    '## How to read this',
    '',
    `- **Level** is the spaced repetition level (0-${MAX_MASTERY_LEVEL}). After a correct answer an item goes up one level; a miss sends it back to 0. The next review comes ${REVIEW_INTERVAL_DAYS.join(' / ')} days later for levels 0 to ${MAX_MASTERY_LEVEL}. Level ${MASTERED_LEVEL} or more counts as mastered.`,
    '- **Skills**: meaning, pinyin and tones are tracked apart for each item; writing (stroke by stroke) has its own level.',
    '- **Difficult**: missed at least 3 times and right less than 60% of the time.',
    '',
    '## Overview',
    '',
    `- My HSK level: ${settings.hskLevel === null ? 'not set' : `HSK ${settings.hskLevel}`}`,
    `- Daily goal: ${settings.dailyGoal} answers`,
    `- Items studied: ${records.length} (${count(records, (item) => getItemStatus(item) === 'learning')} learning, ${count(records, (item) => getItemStatus(item) === 'mastered')} mastered)`,
    `- Due for review now: ${count(records, (item) => isDue(item, now))}`,
    `- Answers: ${totals.answers} total, ${formatAccuracy(totals.accuracy)} correct`,
    `- Days studied: ${Object.values(progress.activity).filter((day) => day.answers > 0).length}; current streak ${getCurrentStreak(progress.activity, now)} days, longest ${getLongestStreak(progress.activity)} days`,
    `- Last 7 days (answers per day, oldest first): ${lastWeek.map((day) => day.answers).join(', ')}`,
  )
  const fromLevel = records.length - listed.length
  if (fromLevel > 0) {
    lines.push(`- Marked as known from my HSK level and never practiced: ${fromLevel} (not listed below)`)
  }

  lines.push('', '## Skills', '', '| Skill | Items practiced | Solid | Answers | Correct |', '| --- | --- | --- | --- | --- |')
  for (const skill of summarizeSkills(progress)) {
    lines.push(`| ${skill.skill} | ${skill.practiced} | ${skill.solid} | ${skill.answers} | ${formatAccuracy(skill.accuracy)} |`)
  }

  const difficult = getDifficultItems(progress)
  if (difficult.length > 0) {
    lines.push('', '## Difficult items', '', '| Hanzi | Pinyin | Meaning | Right | Wrong |', '| --- | --- | --- | --- | --- |')
    for (const item of difficult) {
      const { hanzi, pinyin, meaning } = label(item.itemId)
      lines.push(row([hanzi, pinyin, meaning, item.timesCorrect, item.timesWrong]))
    }
  }

  if (listed.length > 0) {
    lines.push(
      '',
      '## Items I am learning',
      '',
      'Weakest first. "Weak skills" are skills with more misses than correct answers, or missed last time.',
      '',
      '| Hanzi | Pinyin | Meaning | Type | Level | Right | Wrong | Next review | Weak skills |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    )
    const sorted = listed.toSorted(
      (a, b) => a.masteryLevel - b.masteryLevel || a.nextReviewAt.localeCompare(b.nextReviewAt),
    )
    for (const item of sorted) {
      const { hanzi, pinyin, meaning } = label(item.itemId)
      lines.push(
        row([
          hanzi,
          pinyin,
          meaning,
          item.itemId.startsWith('char:') ? 'character' : 'word',
          item.masteryLevel,
          item.timesCorrect,
          item.timesWrong,
          toDateKey(new Date(item.nextReviewAt)),
          getWeakSkills(item).join(', '),
        ]),
      )
    }
  }

  const writing = Object.values(progress.writing).filter((item) => item !== undefined)
  if (writing.length > 0) {
    lines.push('', '## Writing', '', '| Hanzi | Level | Right | Wrong | Next review |', '| --- | --- | --- | --- | --- |')
    for (const item of writing.toSorted((a, b) => a.masteryLevel - b.masteryLevel)) {
      lines.push(
        row([label(item.itemId).hanzi, item.masteryLevel, item.timesCorrect, item.timesWrong, toDateKey(new Date(item.nextReviewAt))]),
      )
    }
  }

  const excluded = (Object.keys(progress.excluded) as StudyItemId[]).filter((id) => progress.excluded[id]?.excluded)
  if (excluded.length > 0) {
    lines.push('', '## Words I chose not to learn', '', excluded.map((id) => label(id).hanzi).join(', '))
  }

  if (customSets.length > 0) {
    lines.push('', '## My custom sets')
    for (const set of customSets) {
      lines.push('', `### ${set.name} (${set.itemIds.length} items)`)
      if (set.description) lines.push('', set.description)
      if (set.itemIds.length > 0) lines.push('', set.itemIds.map((id) => label(id).hanzi).join(', '))
    }
  }

  return `${lines.join('\n')}\n`
}

/** Recognition skills the item struggles with: more misses than correct answers, or missed last time. */
export function getWeakSkills(item: ItemProgress): RecognitionSkill[] {
  return SKILLS.filter((skill): skill is RecognitionSkill => skill !== 'writing').filter((skill) => {
    const stats = item.skills?.[skill]
    return stats !== undefined && (stats.wrong > stats.correct || (stats.wrong > 0 && stats.streak === 0))
  })
}

/** The dictionary's first meanings, cut to fit a table cell. */
export function shortenMeaning(meanings: readonly string[]): string {
  const text = meanings.slice(0, 3).join('; ')
  return text.length <= MAX_MEANING_LENGTH ? text : `${text.slice(0, MAX_MEANING_LENGTH - 1).trimEnd()}…`
}

function count<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length
}

function formatAccuracy(accuracy: number | undefined): string {
  return accuracy === undefined ? '-' : `${Math.round(accuracy * 100)}%`
}

/** A Markdown table row; a | in a cell (a user's set name, say) would split it. */
function row(cells: readonly (string | number)[]): string {
  return `| ${cells.map((cell) => String(cell).replaceAll('|', '/')).join(' | ')} |`
}
