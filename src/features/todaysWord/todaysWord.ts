import type { Hsk5Word, Word } from '../dictionary/types.ts'
import { getEntryPathById } from '../dictionary/entryPaths.ts'
import type { DateKey } from '../../lib/dates.ts'
import { isRecord, readJson, writeJson, type KeyValueStorage } from '../../lib/storage.ts'
import type { RandomFn } from '../../lib/random.ts'

/**
 * Today's Word: one HSK 3-5 word per local calendar day, never repeated
 * until every word in the pool has been shown once.
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

/** What is saved: today's word and every word already shown. */
export interface TodaysWordState {
  date: DateKey
  key: string
  seen: string[]
}

export const TODAYS_WORD_STORAGE_KEY = 'hanzivocab.todaysWord'

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

/**
 * Today's word and the state to save. The same day always gives the same
 * word; a new day picks at random among the words not shown yet. When all
 * have been shown, it starts over (without repeating yesterday's word).
 */
export function chooseTodaysWord(
  pool: readonly DailyWord[],
  saved: TodaysWordState | undefined,
  today: DateKey,
  random: RandomFn = Math.random,
): { word: DailyWord; state: TodaysWordState } | undefined {
  const byKey = new Map(pool.map((word) => [word.key, word]))
  const current = saved && byKey.get(saved.key)
  if (saved && current && saved.date === today) return { word: current, state: saved }

  let seen = new Set((saved?.seen ?? []).filter((key) => byKey.has(key)))
  let unseen = pool.filter((word) => !seen.has(word.key))
  if (unseen.length === 0) {
    seen = new Set()
    unseen = pool.length > 1 ? pool.filter((word) => word.key !== saved?.key) : [...pool]
  }
  const word = unseen[Math.floor(random() * unseen.length)]
  if (!word) return undefined
  return { word, state: { date: today, key: word.key, seen: [...seen, word.key] } }
}

export function loadTodaysWord(storage?: KeyValueStorage): TodaysWordState | undefined {
  const saved = readJson(TODAYS_WORD_STORAGE_KEY, storage)
  if (!isRecord(saved)) return undefined
  const { date, key, seen } = saved
  if (typeof date !== 'string' || typeof key !== 'string' || !Array.isArray(seen)) return undefined
  return { date, key, seen: seen.filter((item): item is string => typeof item === 'string') }
}

export function saveTodaysWord(state: TodaysWordState, storage?: KeyValueStorage): boolean {
  return writeJson(TODAYS_WORD_STORAGE_KEY, state, storage)
}
