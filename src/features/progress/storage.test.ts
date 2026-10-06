import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { createEmptyProgress, recordAnswer, recordWritingAnswer, setItemExcluded } from './progress.ts'
import { loadProgress, PROGRESS_STORAGE_KEY, saveProgress } from './storage.ts'

const now = new Date(2026, 8, 28, 10, 0)

describe('saveProgress / loadProgress', () => {
  it('saves progress and loads it back unchanged', () => {
    const storage = memoryStorage()
    const progress = recordAnswer(createEmptyProgress(), 'char:你', true, now)

    expect(saveProgress(progress, storage)).toBe(true)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('also keeps writing progress', () => {
    const storage = memoryStorage()
    const progress = recordWritingAnswer(recordAnswer(createEmptyProgress(), 'char:你', true, now), 'char:你', true, now)

    saveProgress(progress, storage)
    expect(loadProgress(storage).writing).toEqual(progress.writing)
  })

  it('progress saved before writing existed loads with no writing records', () => {
    const storage = memoryStorage({ 'hanzivocab.progress': JSON.stringify({ version: 1, items: {}, activity: {} }) })
    expect(loadProgress(storage)).toEqual(createEmptyProgress())
  })

  it('also keeps the items the user chose not to learn, dropping malformed ones', () => {
    const progress = setItemExcluded(createEmptyProgress(), 'word:谢谢', true, now)
    const storage = memoryStorage()
    saveProgress(progress, storage)
    expect(loadProgress(storage)).toEqual(progress)

    const saved = { version: 1, items: {}, activity: {}, excluded: { ...progress.excluded, 'word:你': { excluded: 'yes' } } }
    expect(loadProgress(memoryStorage({ 'hanzivocab.progress': JSON.stringify(saved) }))).toEqual(progress)
  })

  it('saves the format version', () => {
    const storage = memoryStorage()
    saveProgress(createEmptyProgress(), storage)

    expect(JSON.parse(storage.getItem('hanzivocab.progress')!)).toMatchObject({ version: 1 })
  })

  it('starts from scratch with no saved data', () => {
    expect(loadProgress(memoryStorage())).toEqual(createEmptyProgress())
  })

  it.each([
    ['broken JSON', '{oops'],
    ['another version', JSON.stringify({ version: 99, items: {}, activity: {} })],
    ['no items', JSON.stringify({ version: 1, activity: {} })],
  ])('starts from scratch with invalid data (%s)', (_case, saved) => {
    expect(loadProgress(memoryStorage({ 'hanzivocab.progress': saved }))).toEqual(createEmptyProgress())
  })

  it('discards only the bad entries', () => {
    const good = recordAnswer(createEmptyProgress(), 'char:你', true, now)
    const saved = {
      version: 1,
      items: { ...good.items, 'char:好': { itemId: 'char:好', timesSeen: 'many' } },
      activity: { ...good.activity, '2026-09-27': null },
    }

    expect(loadProgress(memoryStorage({ 'hanzivocab.progress': JSON.stringify(saved) }))).toEqual(good)
  })
})

describe('skills in saved progress', () => {
  it('keeps per-skill records and drops items whose skills are malformed', () => {
    const storage = memoryStorage()
    const progress = recordAnswer(createEmptyProgress(), 'word:你好', true, new Date(), { tones: true })
    saveProgress(progress, storage)
    expect(loadProgress(storage).items['word:你好']?.skills).toEqual({ tones: { correct: 1, wrong: 0, streak: 1 } })

    const saved = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)!)
    saved.items['word:你好'].skills = { tones: 'oops' }
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(saved))
    expect(loadProgress(storage).items['word:你好']).toBeUndefined()
  })
})
