import { isRecord, readJson, writeJson, type KeyValueStorage } from '../../lib/storage.ts'
import { createEmptyProgress } from './progress.ts'
import type { DailyActivity, ExcludedItem, ItemProgress, ProgressData } from './types.ts'

export const PROGRESS_STORAGE_KEY = 'hanzivocab.progress'

/**
 * Version of the saved format. If the shape of the data ever changes, bump
 * this number and add the conversion from the previous version here.
 */
const CURRENT_VERSION = 1

type SavedProgress = ProgressData & { version: typeof CURRENT_VERSION }

export function saveProgress(progress: ProgressData, storage?: KeyValueStorage): boolean {
  const saved: SavedProgress = { version: CURRENT_VERSION, ...progress }
  return writeJson(PROGRESS_STORAGE_KEY, saved, storage)
}

/**
 * Loads saved progress. If there is nothing, or what is saved doesn't have
 * the expected format, it starts from scratch instead of breaking the app.
 * Individual bad entries are discarded and the rest is kept.
 */
export function loadProgress(storage?: KeyValueStorage): ProgressData {
  const saved = readJson(PROGRESS_STORAGE_KEY, storage)
  if (!isRecord(saved) || saved.version !== CURRENT_VERSION) return createEmptyProgress()
  if (!isRecord(saved.items) || !isRecord(saved.activity)) return createEmptyProgress()

  return {
    items: keepValid(saved.items, isItemProgress),
    // Writing progress came later: data saved before it has none, and that's fine
    writing: isRecord(saved.writing) ? keepValid(saved.writing, isItemProgress) : {},
    // Same for the characters taught for writing
    writingTaught: isRecord(saved.writingTaught) ? keepValid(saved.writingTaught, isString) : {},
    activity: keepValid(saved.activity, isDailyActivity),
    // Same for the items the user chose not to learn
    excluded: isRecord(saved.excluded) ? keepValid(saved.excluded, isExcludedItem) : {},
  }
}

/** Copy of the object with only the values that pass the check. */
function keepValid<T>(record: Record<string, unknown>, isValid: (value: unknown) => value is T): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    if (isValid(value)) result[key] = value
  }
  return result
}

function isItemProgress(value: unknown): value is ItemProgress {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    ['timesSeen', 'timesCorrect', 'timesWrong', 'masteryLevel'].every((key) => typeof value[key] === 'number') &&
    typeof value.lastReviewedAt === 'string' &&
    typeof value.nextReviewAt === 'string' &&
    (value.skills === undefined || isSkills(value.skills))
  )
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isDailyActivity(value: unknown): value is DailyActivity {
  return isRecord(value) && typeof value.answers === 'number' && typeof value.correct === 'number'
}

function isExcludedItem(value: unknown): value is ExcludedItem {
  return isRecord(value) && typeof value.excluded === 'boolean' && typeof value.changedAt === 'string'
}

function isSkills(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (stats) => isRecord(stats) && ['correct', 'wrong', 'streak'].every((key) => typeof stats[key] === 'number'),
    )
  )
}
