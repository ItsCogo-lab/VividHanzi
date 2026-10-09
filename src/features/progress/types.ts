import type { DateKey } from '../../lib/dates.ts'
import type { StudyItemId } from '../dictionary/studyItem.ts'
import type { RecognitionSkill, SkillStats } from './skills.ts'

/** What is known about a character or word the user has already studied. */
export interface ItemProgress {
  itemId: StudyItemId
  timesSeen: number
  timesCorrect: number
  timesWrong: number
  /** Spaced repetition mastery level (0-5). */
  masteryLevel: number
  /** Dates in ISO 8601 format. */
  lastReviewedAt: string
  nextReviewAt: string
  /**
   * Basic vocabulary for the user's HSK level (see applyHskLevel): it is
   * never due for review. If it is answered wrong in a voluntary review, it
   * loses the flag and returns to normal spaced repetition.
   */
  basic?: true
  /**
   * The record was created by applyHskLevel and has never been answered: if
   * the user lowers their level, it is deleted and the item becomes new again.
   */
  fromLevel?: true
  /**
   * Answers per skill (see skills.ts). Older records and items only marked
   * in Learn have none. Writing keeps its own record in ProgressData.writing.
   */
  skills?: Partial<Record<RecognitionSkill, SkillStats>>
}

/**
 * A word the user chose not to learn in Learn (see setItemExcluded). Undoing
 * it keeps the entry with `excluded: false` instead of deleting it, so a sync
 * with another device knows which of the two choices is more recent.
 */
export interface ExcludedItem {
  excluded: boolean
  /** Date in ISO 8601 format. */
  changedAt: string
}

/** A day's answers, for the streak and statistics. */
export interface DailyActivity {
  answers: number
  correct: number
}

/**
 * All of the user's progress. Items that don't appear in `items` are new
 * (never studied).
 */
export interface ProgressData {
  items: Partial<Record<StudyItemId, ItemProgress>>
  /**
   * Writing progress, apart from `items` (recognition): writing is much
   * harder, so a miss while writing doesn't send the item back to level 0
   * for reading too. Same record shape, never with `basic` or `fromLevel`.
   * An item not in here has never been written.
   */
  writing: Partial<Record<StudyItemId, ItemProgress>>
  /**
   * Characters whose writing the user has been taught: traced over their
   * outline, then written with hints (see WritingExercise). The value is
   * when, in ISO 8601 format. A character written right before this existed
   * also counts as taught (see getTaughtCharacters).
   */
  writingTaught: Record<string, string>
  activity: Record<DateKey, DailyActivity>
  /** Items the user chose not to learn: Learn no longer offers them. */
  excluded: Partial<Record<StudyItemId, ExcludedItem>>
}
