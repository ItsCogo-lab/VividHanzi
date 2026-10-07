import type { Hsk5Word, Word } from '../dictionary/types.ts'
import { getEntryPathById } from '../dictionary/entryPaths.ts'
import type { DateKey } from '../../lib/dates.ts'
import { seededRandom, shuffle } from '../../lib/random.ts'

/**
 * Today's Word: one HSK 3-5 word per calendar day, the same for everyone.
 * The words go in a fixed shuffled order and each day takes the next one,
 * so none repeats until the whole list has been shown (about 6 years).
 */

export interface DailyWord {
  /** Unique within the pool: hanzi and pinyin (长 cháng and 长 zhǎng are two words). */
  key: string
  /** Hanzi, pinyin and meanings, shaped as a word so the usual components can show it. */
  word: Word
  level: 3 | 4 | 5
  /** Entry page to open it in the dictionary. */
  path: string
}

/** HSK 3 and 4 words from the bundled dataset, plus the HSK 5 list. */
export function createDailyWordPool(words: readonly Word[], hsk5Words: readonly Hsk5Word[]): DailyWord[] {
  const pool: DailyWord[] = []
  for (const word of words) {
    if (word.hskLevel !== 3 && word.hskLevel !== 4) continue
    pool.push({
      key: `${word.hanzi} ${word.pinyin}`,
      word,
      level: word.hskLevel,
      path: getEntryPathById('word', word.id),
    })
  }
  for (const word of hsk5Words) {
    pool.push({
      key: `${word.hanzi} ${word.pinyin}`,
      word: { id: word.entry.id, hanzi: word.hanzi, pinyin: word.pinyin, meanings: word.meanings },
      level: 5,
      path: getEntryPathById(word.entry.kind, word.entry.id),
    })
  }
  return pool
}

/** Day the order starts at: its first word is shown on this date. */
const FIRST_DAY = '2026-10-05'
/** Fixed seed: changing it changes everyone's word. */
const ORDER_SEED = 20261005

/** Whole days between two "YYYY-MM-DD" keys (computed in UTC, so daylight saving changes don't matter). */
function daysBetween(from: DateKey, to: DateKey): number {
  const toUtc = (key: DateKey) => {
    const [year = 0, month = 1, day = 1] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
}

/**
 * The word for a date. It depends only on the date and the pool, so every
 * user sees the same word on the same day (their local calendar day). If
 * the word lists change when the dataset is regenerated, the order changes too.
 */
export function getTodaysWord(pool: readonly DailyWord[], today: DateKey): DailyWord | undefined {
  if (pool.length === 0) return undefined
  const order = shuffle(pool, seededRandom(ORDER_SEED))
  const index = daysBetween(FIRST_DAY, today) % order.length
  return order[(index + order.length) % order.length]
}
