import type { Hsk5Word } from '../dictionary/types.ts'
import type { WordIndex } from '../dictionary/segmentation.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'
import type { ReadingWord } from './types.ts'

const samePinyin = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, ' ').trim() === b.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The dictionary entry of a word of a reading: the word read the same way,
 * otherwise the character entry of a single hanzi, otherwise any word
 * written like it. `undefined` if the dictionary doesn't have it (a name).
 */
export function findWordEntry(index: WordIndex, word: ReadingWord): StudyItem | undefined {
  const entries = index.find(word.text)
  return (
    entries.find((item) => item.kind === 'word' && word.pinyin !== undefined && samePinyin(item.entry.pinyin, word.pinyin)) ??
    entries.find((item) => item.kind === 'character') ??
    entries.find((item) => item.kind === 'word')
  )
}

/**
 * HSK level of the word as it is read here: 1-4 from the dictionary, 5 from
 * the HSK 5 list (while it loads, only 1-4). A single hanzi counts as its
 * HSK word (很 → HSK 1).
 */
export function getWordHskLevel(
  index: WordIndex,
  word: ReadingWord,
  hsk5Words: readonly Hsk5Word[] = [],
): number | undefined {
  if (!word.pinyin) return undefined
  const pinyin = word.pinyin
  const hskWord = index
    .find(word.text)
    .find((item) => item.kind === 'word' && item.entry.hskLevel !== undefined && samePinyin(item.entry.pinyin, pinyin))
  if (hskWord) return hskWord.entry.hskLevel
  return hsk5Words.some((hsk5) => hsk5.hanzi === word.text && samePinyin(hsk5.pinyin, pinyin)) ? 5 : undefined
}
