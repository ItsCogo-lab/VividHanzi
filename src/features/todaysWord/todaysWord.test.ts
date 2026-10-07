import { describe, expect, it } from 'vitest'
import type { Hsk5Word, Word } from '../dictionary/types.ts'
import { toDateKey } from '../../lib/dates.ts'
import { createDailyWordPool, getTodaysWord, type DailyWord } from './todaysWord.ts'

const word = (hanzi: string, pinyin: string, hskLevel?: Word['hskLevel']): Word => ({
  id: hanzi,
  hanzi,
  pinyin,
  meanings: { en: [hanzi] },
  ...(hskLevel !== undefined && { hskLevel }),
})

describe('createDailyWordPool', () => {
  it('takes HSK 3 and 4 words and the HSK 5 list, each with its entry page', () => {
    const hsk5: Hsk5Word = { hanzi: '唉', pinyin: 'āi', meanings: { en: ['to sigh'] }, entry: { kind: 'character', id: '唉' } }
    const pool = createDailyWordPool([word('你好', 'nǐ hǎo', 1), word('环境', 'huán jìng', 3), word('安排', 'ān pái', 4)], [hsk5])

    expect(pool.map(({ key, level, path }) => [key, level, path])).toEqual([
      ['环境 huán jìng', 3, '/vocabulary/%E7%8E%AF%E5%A2%83'],
      ['安排 ān pái', 4, '/vocabulary/%E5%AE%89%E6%8E%92'],
      ['唉 āi', 5, '/characters/%E5%94%89'],
    ])
  })
})

describe('getTodaysWord', () => {
  const pool: DailyWord[] = createDailyWordPool(
    ['一', '二', '三', '四', '五'].map((hanzi) => word(hanzi, 'x', 3)),
    [],
  )
  const days = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => toDateKey(new Date(2026, 9, from + index)))

  it('gives the same word for the same date, whoever asks', () => {
    expect(getTodaysWord(pool, '2026-10-07')).toBe(getTodaysWord([...pool], '2026-10-07'))
  })

  it('never repeats a word until all have been shown, then follows the same order again', () => {
    const firstRound = days(5, 5).map((date) => getTodaysWord(pool, date)!.key)
    expect(new Set(firstRound).size).toBe(5)
    expect(days(10, 5).map((date) => getTodaysWord(pool, date)!.key)).toEqual(firstRound)
  })

  it('also works for dates before the first day', () => {
    expect(getTodaysWord(pool, '2026-10-04')).toBe(getTodaysWord(pool, '2026-10-09'))
  })
})
