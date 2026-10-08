import { formatPinyin, getMeanings } from './dictionary.ts'
import type { StudyItem } from './studyItem.ts'

/**
 * Title and meta description of an entry page, for search engines. The app
 * uses the same title (EntryDetailPage) as the static page written at build
 * time (scripts/seo/staticPages.ts), so both say the same thing.
 */
export function describeEntry(item: StudyItem): { title: string; description: string } {
  const { entry } = item
  const pinyin = formatPinyin(entry)
  const meanings = getMeanings(entry.meanings)
  const level = entry.hskLevel === undefined ? '' : `HSK ${entry.hskLevel} `
  const shortMeaning = truncate(meanings[0] ?? '', 50)
  const allMeanings = truncate(meanings.slice(0, 3).join('; '), 110)

  if (item.kind === 'character') {
    return {
      title: `${entry.hanzi} ${pinyin}: ${shortMeaning} – meaning and stroke order | VividHanzi`,
      description: `${entry.hanzi} (${pinyin}) means "${allMeanings}". ${level}Chinese character: stroke order, radical, components and words that use it. Learn it free with VividHanzi.`,
    }
  }
  return {
    title: `${entry.hanzi} ${pinyin}: ${shortMeaning} – ${level}Chinese word | VividHanzi`,
    description: `${entry.hanzi} (${pinyin}) means "${allMeanings}". ${level}word with its characters and example sentences. Practice it free with spaced repetition on VividHanzi.`,
  }
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`
}
