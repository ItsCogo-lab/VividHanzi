import { describe, expect, it } from 'vitest'
import {
  applyHskLevel,
  createEmptyProgress,
  getDisplayStatus,
  getItemStatus,
  introduceItem,
  isDue,
  isExcluded,
  isLearned,
  markItemKnown,
  MASTERED_LEVEL,
  recordAnswer,
  recordWritingAnswer,
  setItemExcluded,
} from './progress.ts'

const monday = new Date(2026, 8, 28, 10, 0)
const tuesday = new Date(2026, 8, 29, 9, 0)

describe('recordWritingAnswer', () => {
  it('only changes writing progress, and counts for the day like any answer', () => {
    const read = recordAnswer(createEmptyProgress(), 'word:谢谢', true, monday)
    const written = recordWritingAnswer(read, 'word:谢谢', false, tuesday)

    expect(written.items).toBe(read.items)
    expect(written.writing['word:谢谢']).toMatchObject({ timesSeen: 1, timesWrong: 1, masteryLevel: 0 })
    expect(written.activity['2026-09-29']).toEqual({ answers: 1, correct: 0 })
  })
})

describe('recordAnswer', () => {
  it('creates progress for a new item', () => {
    const progress = recordAnswer(createEmptyProgress(), 'char:你', true, monday)

    expect(progress.items['char:你']).toEqual({
      itemId: 'char:你',
      timesSeen: 1,
      timesCorrect: 1,
      timesWrong: 0,
      masteryLevel: 1,
      lastReviewedAt: monday.toISOString(),
      nextReviewAt: new Date(2026, 8, 29).toISOString(),
    })
  })

  it('accumulates answers and applies spaced repetition', () => {
    let progress = recordAnswer(createEmptyProgress(), 'word:你好', true, monday)
    progress = recordAnswer(progress, 'word:你好', true, tuesday)
    expect(progress.items['word:你好']).toMatchObject({ timesSeen: 2, timesCorrect: 2, masteryLevel: 2 })

    progress = recordAnswer(progress, 'word:你好', false, tuesday)
    expect(progress.items['word:你好']).toMatchObject({ timesSeen: 3, timesWrong: 1, masteryLevel: 0 })
  })

  it("adds answers to each day's activity", () => {
    let progress = recordAnswer(createEmptyProgress(), 'char:你', true, monday)
    progress = recordAnswer(progress, 'char:好', false, monday)
    progress = recordAnswer(progress, 'char:你', true, tuesday)

    expect(progress.activity).toEqual({
      '2026-09-28': { answers: 2, correct: 1 },
      '2026-09-29': { answers: 1, correct: 1 },
    })
  })

  it('does not modify the previous progress', () => {
    const empty = createEmptyProgress()
    recordAnswer(empty, 'char:你', true, monday)

    expect(empty).toEqual(createEmptyProgress())
  })
})

describe('getItemStatus', () => {
  it('distinguishes new, learning and mastered', () => {
    const progress = recordAnswer(createEmptyProgress(), 'char:你', true, monday)
    const item = progress.items['char:你']!

    expect(getItemStatus(undefined)).toBe('new')
    expect(getItemStatus(item)).toBe('learning')
    expect(getItemStatus({ ...item, masteryLevel: MASTERED_LEVEL })).toBe('mastered')
  })
})

describe('isDue', () => {
  it('an item answered correctly today is due tomorrow; a missed one, today', () => {
    let progress = recordAnswer(createEmptyProgress(), 'char:你', true, monday)
    progress = recordAnswer(progress, 'char:好', false, monday)

    expect(isDue(progress.items['char:你'], monday)).toBe(false)
    expect(isDue(progress.items['char:你'], tuesday)).toBe(true)
    expect(isDue(progress.items['char:好'], monday)).toBe(true)
    expect(isDue(undefined, monday)).toBe(false)
  })
})

describe('introduceItem', () => {
  const now = new Date(2026, 8, 28, 12)

  it('marks the item as learned, with its first review today, without counting as an answer', () => {
    const progress = introduceItem(createEmptyProgress(), 'word:你好', now)

    expect(isLearned(progress, 'word:你好')).toBe(true)
    expect(getItemStatus(progress.items['word:你好'])).toBe('learning')
    expect(progress.items['word:你好']).toMatchObject({ masteryLevel: 0, timesSeen: 0 })
    expect(isDue(progress.items['word:你好'], now)).toBe(true)
    expect(progress.activity).toEqual({})
  })

  it('leaves an item that already had progress alone', () => {
    const progress = recordAnswer(createEmptyProgress(), 'word:你好', true, now)

    expect(introduceItem(progress, 'word:你好', now)).toBe(progress)
  })
})

describe('markItemKnown', () => {
  const now = new Date(2026, 8, 28, 12)

  it("marks it as mastered and it isn't due for review for 30 days", () => {
    const progress = markItemKnown(createEmptyProgress(), 'word:你好', now)
    const item = progress.items['word:你好']

    expect(isLearned(progress, 'word:你好')).toBe(true)
    expect(getItemStatus(item)).toBe('mastered')
    expect(item).toMatchObject({ timesSeen: 0 })
    expect(isDue(item, new Date(2026, 9, 27, 23))).toBe(false)
    expect(isDue(item, new Date(2026, 9, 28))).toBe(true)
    expect(progress.activity).toEqual({})
  })

  it('if it is later missed, it is reviewed again like any other', () => {
    let progress = markItemKnown(createEmptyProgress(), 'word:你好', now)
    progress = recordAnswer(progress, 'word:你好', false, new Date(2026, 9, 28, 9))

    expect(progress.items['word:你好']).toMatchObject({ masteryLevel: 0, timesWrong: 1 })
    expect(getItemStatus(progress.items['word:你好'])).toBe('learning')
  })

  it('leaves an item that already had progress alone', () => {
    const progress = introduceItem(createEmptyProgress(), 'word:你好', now)

    expect(markItemKnown(progress, 'word:你好', now)).toBe(progress)
  })
})

describe('setItemExcluded', () => {
  it('excludes an item without creating an SRS record, and can be undone', () => {
    const excluded = setItemExcluded(createEmptyProgress(), 'word:谢谢', true, monday)

    expect(isExcluded(excluded, 'word:谢谢')).toBe(true)
    expect(isLearned(excluded, 'word:谢谢')).toBe(false)
    expect(getDisplayStatus(excluded, 'word:谢谢')).toBe('excluded')

    const undone = setItemExcluded(excluded, 'word:谢谢', false, tuesday)
    expect(isExcluded(undone, 'word:谢谢')).toBe(false)
    expect(getDisplayStatus(undone, 'word:谢谢')).toBe('new')
    // Kept as a record of the choice, for syncing (see mergeProgress)
    expect(undone.excluded['word:谢谢']).toEqual({ excluded: false, changedAt: tuesday.toISOString() })
  })

  it('an item that is being studied shows its real status even if it was excluded', () => {
    const progress = introduceItem(setItemExcluded(createEmptyProgress(), 'word:谢谢', true, monday), 'word:谢谢', tuesday)
    expect(getDisplayStatus(progress, 'word:谢谢')).toBe('learning')
  })
})

describe('applyHskLevel', () => {
  const now = new Date(2026, 8, 28, 12)
  const items = [
    { itemId: 'word:你好', hskLevel: 1 },
    { itemId: 'word:认识', hskLevel: 2 },
    { itemId: 'word:经常', hskLevel: 3 },
    { itemId: 'word:安排', hskLevel: 4 },
  ] as const
  const in30Days = new Date(2026, 9, 28)

  it('with HSK 3, marks up to HSK 3 as mastered and leaves HSK 1 as basic', () => {
    const progress = applyHskLevel(createEmptyProgress(), items, 3, now)

    expect(progress.items['word:你好']).toMatchObject({ masteryLevel: 5, basic: true })
    expect(isDue(progress.items['word:你好'], new Date(2027, 0, 1))).toBe(false)
    for (const itemId of ['word:认识', 'word:经常'] as const) {
      expect(getItemStatus(progress.items[itemId])).toBe('mastered')
      expect(progress.items[itemId]?.basic).toBeUndefined()
      expect(isDue(progress.items[itemId], new Date(2026, 9, 27))).toBe(false)
    }
    expect(progress.items['word:安排']).toBeUndefined()
    expect(progress.activity).toEqual({})
  })

  it('spreads the first reviews across different days from 30 days on', () => {
    const progress = applyHskLevel(createEmptyProgress(), items, 1, now)
    const withTwo = applyHskLevel(createEmptyProgress(), items, 2, now)

    expect(progress.items['word:你好']?.nextReviewAt).toBe(in30Days.toISOString())
    expect(withTwo.items['word:认识']?.nextReviewAt).toBe(new Date(2026, 9, 29).toISOString())
  })

  it('leaves items already being studied within the level alone, but not basic ones', () => {
    let progress = recordAnswer(createEmptyProgress(), 'word:经常', false, now)
    progress = recordAnswer(progress, 'word:你好', false, now)
    progress = applyHskLevel(progress, items, 3, now)

    expect(progress.items['word:经常']).toMatchObject({ masteryLevel: 0, timesWrong: 1 })
    expect(progress.items['word:你好']).toMatchObject({ masteryLevel: 5, timesWrong: 1, basic: true })
  })

  it('when lowering the level, items marked only by the level become new again', () => {
    let progress = applyHskLevel(createEmptyProgress(), items, 3, now)
    progress = applyHskLevel(progress, items, 2, now)

    expect(progress.items['word:经常']).toBeUndefined()
    expect(getItemStatus(progress.items['word:认识'])).toBe('mastered')
    // With HSK 2, HSK 1 is no longer basic: it stays mastered and is reviewed now and then
    expect(progress.items['word:你好']?.basic).toBeUndefined()
    expect(getItemStatus(progress.items['word:你好'])).toBe('mastered')

    progress = applyHskLevel(progress, items, null, now)
    expect(progress.items).toEqual({})
  })

  it('when lowering the level, answered items are kept and basic ones are reviewed now and then again', () => {
    let progress = recordAnswer(createEmptyProgress(), 'word:你好', true, now)
    progress = applyHskLevel(progress, items, 3, now)
    progress = recordAnswer(progress, 'word:经常', true, now)
    progress = applyHskLevel(progress, items, null, now)

    expect(progress.items['word:你好']?.basic).toBeUndefined()
    expect(getItemStatus(progress.items['word:你好'])).toBe('mastered')
    expect(isDue(progress.items['word:你好'], in30Days)).toBe(true)
    expect(progress.items['word:经常']).toMatchObject({ timesCorrect: 1 })
    expect(progress.items['word:认识']).toBeUndefined()
  })

  it("doesn't remove items marked as already mastered in Learn", () => {
    let progress = markItemKnown(createEmptyProgress(), 'word:经常', now)
    progress = applyHskLevel(progress, items, 3, now)
    progress = applyHskLevel(progress, items, 1, now)

    expect(getItemStatus(progress.items['word:经常'])).toBe('mastered')
  })

  it('a missed basic item loses the flag and returns to normal repetition', () => {
    let progress = applyHskLevel(createEmptyProgress(), items, 3, now)
    progress = recordAnswer(progress, 'word:你好', false, now)

    expect(progress.items['word:你好']?.basic).toBeUndefined()
    expect(isDue(progress.items['word:你好'], now)).toBe(true)
  })
})
