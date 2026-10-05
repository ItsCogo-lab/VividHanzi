import { describe, expect, it } from 'vitest'
import type { Hsk5Word, Word } from '../dictionary/types.ts'
import { createMemoryStorage } from '../../lib/storage.ts'
import { chooseTodaysWord, createDailyWordPool, loadTodaysWord, saveTodaysWord, type DailyWord } from './todaysWord.ts'

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

describe('chooseTodaysWord', () => {
  const pool: DailyWord[] = createDailyWordPool([word('一', 'yī', 3), word('二', 'èr', 3), word('三', 'sān', 4)], [])

  it('keeps the same word all day', () => {
    const first = chooseTodaysWord(pool, undefined, '2026-10-05', () => 0.5)!
    const again = chooseTodaysWord(pool, first.state, '2026-10-05', () => 0)!
    expect(again.word).toBe(first.word)
    expect(again.state).toBe(first.state)
  })

  it('never repeats a word until all have been shown, then starts over without repeating the last one', () => {
    let state = chooseTodaysWord(pool, undefined, '2026-10-01', () => 0)!.state
    const shown = [state.key]
    for (const date of ['2026-10-02', '2026-10-03']) {
      state = chooseTodaysWord(pool, state, date, () => 0)!.state
      shown.push(state.key)
    }
    expect(new Set(shown).size).toBe(3)

    const restart = chooseTodaysWord(pool, state, '2026-10-04', () => 0.99)!
    expect(restart.word.key).not.toBe(state.key)
    expect(restart.state.seen).toEqual([restart.word.key])
  })

  it('ignores saved words that are no longer in the pool', () => {
    const chosen = chooseTodaysWord(pool, { date: '2026-10-01', key: 'gone', seen: ['gone', '一 yī'] }, '2026-10-01', () => 0)!
    expect(chosen.word.key).toBe('二 èr')
    expect(chosen.state.seen).toEqual(['一 yī', '二 èr'])
  })
})

describe('storage', () => {
  it('saves and loads the state, and ignores corrupt data', () => {
    const storage = createMemoryStorage()
    saveTodaysWord({ date: '2026-10-05', key: '一 yī', seen: ['一 yī'] }, storage)
    expect(loadTodaysWord(storage)).toEqual({ date: '2026-10-05', key: '一 yī', seen: ['一 yī'] })
    expect(loadTodaysWord(createMemoryStorage({ 'hanzivocab.todaysWord': '{"date":1}' }))).toBeUndefined()
  })
})
