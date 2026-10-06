import { toDateKey } from '../../lib/dates.ts'
import type { HskLevel } from '../dictionary/types.ts'
import type { StudyItemId } from '../dictionary/studyItem.ts'
import { isReviewDue, MAX_MASTERY_LEVEL, scheduleFirstReview, scheduleKnownItem, scheduleNextReview, type ReviewSchedule } from '../srs/srs.ts'
import { nextSkillStats, type RecognitionSkill, type SkillResults } from './skills.ts'
import type { ItemProgress, ProgressData } from './types.ts'

/**
 * Level from which an item counts as mastered: its next review is 14 or
 * more days away.
 */
export const MASTERED_LEVEL = 4

export type ItemStatus = 'new' | 'learning' | 'mastered'

/** The state shown to the user: like ItemStatus, plus `excluded` for a new item the user chose not to learn. */
export type DisplayStatus = ItemStatus | 'excluded'

export function createEmptyProgress(): ProgressData {
  return { items: {}, writing: {}, activity: {}, excluded: {} }
}

/**
 * Records an answer: updates the item's counters, schedules its next review
 * and adds the answer to the day's activity. With `skills`, the answer also
 * counts for each skill it tested (see skills.ts). Returns a new object without
 * modifying the previous one (so React detects the change).
 */
export function recordAnswer(
  progress: ProgressData,
  itemId: StudyItemId,
  correct: boolean,
  now: Date,
  skills?: SkillResults,
): ProgressData {
  return {
    ...progress,
    items: { ...progress.items, [itemId]: answeredRecord(progress.items[itemId], itemId, correct, now, skills) },
    activity: addToActivity(progress.activity, correct, now),
  }
}

/**
 * Like recordAnswer, for a writing exercise: it updates the item's writing
 * record (see ProgressData.writing) and leaves recognition as it was. It
 * counts for the day's activity and the streak like any other answer.
 */
export function recordWritingAnswer(progress: ProgressData, itemId: StudyItemId, correct: boolean, now: Date): ProgressData {
  return {
    ...progress,
    writing: { ...progress.writing, [itemId]: answeredRecord(progress.writing[itemId], itemId, correct, now) },
    activity: addToActivity(progress.activity, correct, now),
  }
}

/** The record after an answer. Without the `basic` or `fromLevel` flags: answered items are the user's own progress. */
function answeredRecord(
  previous: ItemProgress | undefined,
  itemId: StudyItemId,
  correct: boolean,
  now: Date,
  skillResults: SkillResults = {},
): ItemProgress {
  let skills = previous?.skills
  for (const [skill, skillCorrect] of Object.entries(skillResults) as [RecognitionSkill, boolean][]) {
    skills = { ...skills, [skill]: nextSkillStats(skills?.[skill], skillCorrect) }
  }
  return {
    itemId,
    timesSeen: (previous?.timesSeen ?? 0) + 1,
    timesCorrect: (previous?.timesCorrect ?? 0) + (correct ? 1 : 0),
    timesWrong: (previous?.timesWrong ?? 0) + (correct ? 0 : 1),
    lastReviewedAt: now.toISOString(),
    ...scheduleNextReview(previous?.masteryLevel ?? 0, correct, now),
    ...(skills && { skills }),
  }
}

function addToActivity(activity: ProgressData['activity'], correct: boolean, now: Date): ProgressData['activity'] {
  const day = toDateKey(now)
  const today = activity[day] ?? { answers: 0, correct: 0 }
  return { ...activity, [day]: { answers: today.answers + 1, correct: today.correct + (correct ? 1 : 0) } }
}

/**
 * Marks an item as learned in a Learn session: creates its spaced repetition
 * record (level 0, first review today). It doesn't count as an answer, so it
 * doesn't change activity or the streak. If the item already had a record,
 * it is left alone.
 */
export function introduceItem(progress: ProgressData, itemId: StudyItemId, now: Date): ProgressData {
  return addItem(progress, itemId, now, scheduleFirstReview(now))
}

/**
 * Like introduceItem, but for an item the user already knows: it goes
 * straight in as mastered and its first review is a long way off (see
 * scheduleKnownItem). It still comes up in Study, but only very occasionally.
 */
export function markItemKnown(progress: ProgressData, itemId: StudyItemId, now: Date): ProgressData {
  return addItem(progress, itemId, now, scheduleKnownItem(now))
}

/** An HSK item with its level, for applying the user's level. */
export interface LeveledItem {
  itemId: StudyItemId
  hskLevel: HskLevel
}

/**
 * How many levels below the user's own vocabulary becomes basic: with HSK 3,
 * HSK 1 no longer needs reviewing.
 */
export const BASIC_LEVEL_GAP = 2

/** Number of days the first reviews are spread over when marking a whole level. */
const LEVEL_SPREAD_DAYS = 30

/**
 * Applies the HSK level the user says they have (`null` if they give none):
 *
 * - Up to their level, items with no record yet go in as mastered (see
 *   markItemKnown), with the first reviews spread over 30 more days.
 * - Items BASIC_LEVEL_GAP or more levels below are basic: mastered and
 *   never reviewed, even if they were already being studied.
 * - When lowering the level, items left above it that were only marked by the
 *   level (`fromLevel`, never answered) become new again. Items that were
 *   basic and already being studied are reviewed now and then again as mastered.
 *
 * Everything else is left alone. Like the other functions, returns a new object.
 */
export function applyHskLevel(
  progress: ProgressData,
  items: readonly LeveledItem[],
  userLevel: HskLevel | null,
  now: Date,
): ProgressData {
  const updated = { ...progress.items }
  let scheduled = 0
  const knownSchedule = () => scheduleKnownItem(now, scheduled++ % LEVEL_SPREAD_DAYS)

  for (const { itemId, hskLevel } of items) {
    const existing = progress.items[itemId]
    const isBasic = userLevel !== null && hskLevel <= userLevel - BASIC_LEVEL_GAP
    const isKnown = userLevel !== null && hskLevel <= userLevel

    if (isBasic) {
      if (existing?.basic) continue
      const base = existing ?? { ...newItem(itemId, now), fromLevel: true as const }
      updated[itemId] = { ...base, masteryLevel: MAX_MASTERY_LEVEL, basic: true }
    } else if (!isKnown && existing?.fromLevel) {
      delete updated[itemId]
    } else if (existing?.basic) {
      const { basic: _basic, ...rest } = existing
      updated[itemId] = { ...rest, ...knownSchedule() }
    } else if (isKnown && !existing) {
      updated[itemId] = { ...newItem(itemId, now), ...knownSchedule(), fromLevel: true }
    }
  }
  return { ...progress, items: updated }
}

/** Record with no answers; callers apply their own schedule. */
function newItem(itemId: StudyItemId, now: Date): ItemProgress {
  return { itemId, timesSeen: 0, timesCorrect: 0, timesWrong: 0, lastReviewedAt: now.toISOString(), ...scheduleKnownItem(now) }
}

function addItem(progress: ProgressData, itemId: StudyItemId, now: Date, schedule: ReviewSchedule): ProgressData {
  if (progress.items[itemId]) return progress
  return { ...progress, items: { ...progress.items, [itemId]: { ...newItem(itemId, now), ...schedule } } }
}

/**
 * Marks an item as one the user doesn't want to learn (`excluded: true`), or
 * undoes it. An excluded item is left out of Learn; it has no SRS record, so
 * it never comes up in Study either.
 */
export function setItemExcluded(progress: ProgressData, itemId: StudyItemId, excluded: boolean, now: Date): ProgressData {
  return { ...progress, excluded: { ...progress.excluded, [itemId]: { excluded, changedAt: now.toISOString() } } }
}

export function isExcluded(progress: ProgressData, itemId: StudyItemId): boolean {
  return progress.excluded[itemId]?.excluded === true
}

/**
 * An item is learned if it already has a spaced repetition record: it was
 * marked in Learn or has been answered at least once. This is the same as
 * saying its state is not 'new' (see getItemStatus).
 */
export function isLearned(progress: ProgressData, itemId: StudyItemId): boolean {
  return progress.items[itemId] !== undefined
}

export function getItemStatus(item: ItemProgress | undefined): ItemStatus {
  if (!item) return 'new'
  return item.masteryLevel >= MASTERED_LEVEL ? 'mastered' : 'learning'
}

export function getDisplayStatus(progress: ProgressData, itemId: StudyItemId): DisplayStatus {
  const item = progress.items[itemId]
  return !item && isExcluded(progress, itemId) ? 'excluded' : getItemStatus(item)
}

/** Is this item due for review? New and basic items don't count as due. */
export function isDue(item: ItemProgress | undefined, now: Date): boolean {
  return item !== undefined && !item.basic && isReviewDue(item.nextReviewAt, now)
}
