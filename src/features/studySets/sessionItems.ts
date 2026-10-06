import type { Dictionary } from '../dictionary/dictionary.ts'
import { compareByFrequency, getStudyItemId, type StudyItem, type StudyItemId } from '../dictionary/studyItem.ts'
import { isDue, isExcluded, isLearned } from '../progress/progress.ts'
import type { ProgressData } from '../progress/types.ts'
import { getSetItems } from './studySets.ts'
import type { StudySet } from './types.ts'

/**
 * What goes into each session type of a set. The whole app filters with these
 * functions, so Learn and Study never mix:
 *
 * - Learn: set items not yet learned (no record in the SRS) and not excluded
 *   by the user (see setItemExcluded).
 * - Study: only items already learned (see isLearned). Never a new one.
 */
export type SetSessionType = 'learn' | 'study'

/** Learn offers the item: not learned yet, and the user didn't choose to skip it for good. */
function isLearnable(progress: ProgressData, itemId: StudyItemId): boolean {
  return !isLearned(progress, itemId) && !isExcluded(progress, itemId)
}

/**
 * Set items Learn can introduce (see isLearnable). HSK levels go the most frequent first, so the
 * most useful words come early; topic and custom sets keep their own order,
 * which someone chose.
 */
export function getLearnableItems(set: StudySet, dictionary: Dictionary, progress: ProgressData): StudyItem[] {
  const items = getSetItems(set, dictionary).filter((item) => isLearnable(progress, getStudyItemId(item)))
  return set.type === 'hsk' ? items.sort(compareByFrequency) : items
}

export interface ReviewItems {
  /** Learned items whose review is due now, starting with the ones waiting longest. */
  due: StudyItem[]
  /** Learned items that are up to date, starting with the ones due soonest. */
  upToDate: StudyItem[]
}

/** Set items already learned, split into due for review and up to date. */
export function getReviewItems(set: StudySet, dictionary: Dictionary, progress: ProgressData, now: Date): ReviewItems {
  const nextReviewOf = (item: StudyItem) => progress.items[getStudyItemId(item)]?.nextReviewAt ?? ''
  // ISO dates in UTC sort correctly as text
  const learned = getSetItems(set, dictionary)
    .filter((item) => isLearned(progress, getStudyItemId(item)))
    .sort((a, b) => nextReviewOf(a).localeCompare(nextReviewOf(b)))
  return {
    due: learned.filter((item) => isDue(progress.items[getStudyItemId(item)], now)),
    upToDate: learned.filter((item) => !isDue(progress.items[getStudyItemId(item)], now)),
  }
}

export interface SetSessionCounts {
  /** Not learned nor excluded: what Learn can introduce. */
  learnable: number
  /** Learned: the only thing Study can review. */
  learned: number
  /** Learned items whose review is due now. */
  due: number
}

/** The counts for the Learn and Study actions, computed from current progress. */
export function getSetSessionCounts(set: StudySet, progress: ProgressData, now: Date): SetSessionCounts {
  const learnedIds = set.itemIds.filter((itemId) => isLearned(progress, itemId))
  return {
    learnable: set.itemIds.filter((itemId) => isLearnable(progress, itemId)).length,
    learned: learnedIds.length,
    due: learnedIds.filter((itemId) => isDue(progress.items[itemId], now)).length,
  }
}

