/**
 * How data from two devices is combined when both changed since the last
 * sync. Pure functions: they don't read or save anything.
 *
 * The general rule is to lose nothing: each item keeps its most recent
 * version, and anything that exists on only one side is kept.
 */
import type { CustomSet } from '../customSets/types.ts'
import type { MyStudies } from '../myStudies/myStudies.ts'
import type { DailyActivity, ExcludedItem, ItemProgress, ProgressData } from '../progress/types.ts'

export function mergeProgress(local: ProgressData, remote: ProgressData): ProgressData {
  const items = mergeRecords(local.items, remote.items)
  const writing = mergeRecords(local.writing, remote.writing)

  // They can't be added up: if a day was partly synced already, answers would
  // be counted twice. Keep the record with more answers.
  const activity: Record<string, DailyActivity> = { ...remote.activity }
  for (const [day, value] of Object.entries(local.activity)) {
    const other = activity[day]
    if (!other || value.answers >= other.answers) activity[day] = value
  }
  // Excluding a word and undoing it: the most recent choice wins
  const excluded: ProgressData['excluded'] = { ...remote.excluded }
  for (const [id, value] of Object.entries(local.excluded) as [keyof ProgressData['excluded'], ExcludedItem][]) {
    const other = excluded[id]
    if (!other || value.changedAt >= other.changedAt) excluded[id] = value
  }
  return { items, writing, activity, excluded }
}

type ProgressRecords = ProgressData['items']

/** Each item keeps its most recent record, from whichever side has it. */
function mergeRecords(local: ProgressRecords, remote: ProgressRecords): ProgressRecords {
  const merged: ProgressRecords = { ...remote }
  for (const [id, item] of Object.entries(local) as [keyof ProgressRecords, ItemProgress][]) {
    const other = merged[id]
    merged[id] = other && isNewer(other, item) ? other : item
  }
  return merged
}

/** `a` is newer than `b`: reviewed later or, on a tie, seen more times. */
function isNewer(a: ItemProgress, b: ItemProgress): boolean {
  if (a.lastReviewedAt !== b.lastReviewedAt) return a.lastReviewedAt > b.lastReviewedAt
  return a.timesSeen > b.timesSeen
}

export function mergeMyStudies(local: MyStudies, remote: MyStudies): MyStudies {
  const sets = [...local.sets]
  for (const set of remote.sets) {
    const index = sets.findIndex((other) => other.setId === set.setId)
    if (index === -1) sets.push(set)
    else if (set.addedAt < sets[index]!.addedAt) sets[index] = set
  }

  const lastStudied = { ...remote.lastStudied }
  for (const [setId, date] of Object.entries(local.lastStudied)) {
    const other = lastStudied[setId]
    if (!other || date > other) lastStudied[setId] = date
  }
  return { sets, lastStudied }
}

export function mergeCustomSets(local: readonly CustomSet[], remote: readonly CustomSet[]): CustomSet[] {
  const sets = [...local]
  for (const set of remote) {
    const index = sets.findIndex((other) => other.id === set.id)
    if (index === -1) sets.push(set)
    else if (set.updatedAt > sets[index]!.updatedAt) sets[index] = set
  }
  return sets
}
