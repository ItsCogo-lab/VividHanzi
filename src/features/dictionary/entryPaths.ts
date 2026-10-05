import type { StudyItem } from './studyItem.ts'

/** Path to a character's or word's entry page. */
export function getEntryPath(item: StudyItem): string {
  return getEntryPathById(item.kind, item.entry.id)
}

/** Same as getEntryPath, for an entry known only by its kind and id. */
export function getEntryPathById(kind: StudyItem['kind'], id: string): string {
  const section = kind === 'character' ? 'characters' : 'vocabulary'
  return `/${section}/${encodeURIComponent(id)}`
}
