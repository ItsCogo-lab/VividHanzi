import { describe, expect, it } from 'vitest'
import { createDictionary } from '../dictionary/dictionary.ts'
import { listStudyItems, type StudyItemId } from '../dictionary/studyItem.ts'
import { testCharacters, testWords } from '../dictionary/testData.ts'
import { createEmptyProgress, MASTERED_LEVEL, recordAnswer, recordWritingAnswer } from './progress.ts'
import {
  getActivityCalendar,
  getAnswerTotals,
  getGoalStreak,
  getReviewForecast,
  getWeeklyAccuracy,
  getDifficultItems,
  getRecentActivity,
  summarizeCharacters,
  summarizeItems,
  summarizeWriting,
} from './stats.ts'
import type { ProgressData } from './types.ts'

const items = listStudyItems(createDictionary(testCharacters, testWords)) // 4 characters and 3 words
const monday = new Date(2026, 8, 28, 10, 0)
const tuesday = new Date(2026, 8, 29, 10, 0)

function exampleProgress(): ProgressData {
  let progress = createEmptyProgress()
  progress = recordAnswer(progress, 'char:你', true, monday) // learning, due tomorrow
  progress = recordAnswer(progress, 'char:好', false, monday) // learning, due today
  progress = recordAnswer(progress, 'word:你好', true, monday)
  // 你好 mastered: high level and a distant review
  const mastered = { ...progress.items['word:你好']!, masteryLevel: MASTERED_LEVEL, nextReviewAt: '2026-12-01T00:00:00.000Z' }
  return { ...progress, items: { ...progress.items, 'word:你好': mastered } }
}

describe('summarizeItems', () => {
  it('counts the items in each state and the due ones', () => {
    expect(summarizeItems(items, exampleProgress(), monday)).toEqual({
      total: 7,
      new: 4,
      learning: 2,
      mastered: 1,
      studied: 3,
      due: 1,
    })
  })

  it('due items change with the date', () => {
    expect(summarizeItems(items, exampleProgress(), tuesday).due).toBe(2)
  })

  it('only counts the items passed in', () => {
    const words = items.filter((item) => item.kind === 'word')
    expect(summarizeItems(words, exampleProgress(), monday)).toMatchObject({ total: 3, new: 2, mastered: 1 })
  })

  it('with no progress, everything is new', () => {
    expect(summarizeItems(items, createEmptyProgress(), monday)).toMatchObject({ total: 7, new: 7, studied: 0, due: 0 })
  })
})

describe('summarizeCharacters', () => {
  const characters = items.filter((item) => item.kind === 'character')
  const words = items.filter((item) => item.kind === 'word')

  it('a character is as far along as the furthest word that contains it', () => {
    let progress = recordAnswer(createEmptyProgress(), 'word:谢谢', true, monday)
    expect(summarizeCharacters(characters, words, progress, monday)).toEqual({
      total: 4,
      new: 3,
      learning: 1, // 谢, through 谢谢
      mastered: 0,
      studied: 1,
      due: 0,
    })
    progress = exampleProgress()
    // 你 and 好 are mastered through 你好, even though their own cards are only learning
    expect(summarizeCharacters(characters, words, progress, monday)).toMatchObject({ new: 2, mastered: 2 })
  })

  it("only the character's own card can be due", () => {
    expect(summarizeCharacters(characters, words, exampleProgress(), monday).due).toBe(1) // char:好
  })
})

describe('getAnswerTotals', () => {
  it('adds up the answers from every day', () => {
    const activity = { '2026-09-27': { answers: 6, correct: 3 }, '2026-09-28': { answers: 4, correct: 4 } }
    expect(getAnswerTotals(activity)).toEqual({ answers: 10, correct: 7, accuracy: 0.7 })
  })

  it('with no answers there is no accuracy', () => {
    expect(getAnswerTotals({})).toEqual({ answers: 0, correct: 0, accuracy: undefined })
  })
})

describe('getRecentActivity', () => {
  it('returns the last days in order, with zeros on days without study', () => {
    const activity = { '2026-09-26': { answers: 5, correct: 4 }, '2026-09-01': { answers: 9, correct: 9 } }

    expect(getRecentActivity(activity, monday, 3)).toEqual([
      { date: '2026-09-26', answers: 5, correct: 4 },
      { date: '2026-09-27', answers: 0, correct: 0 },
      { date: '2026-09-28', answers: 0, correct: 0 },
    ])
  })

  it('defaults to one week', () => {
    expect(getRecentActivity({}, monday)).toHaveLength(7)
  })
})

describe('getDifficultItems', () => {
  function answer(progress: ProgressData, id: StudyItemId, results: readonly boolean[]) {
    return results.reduce((current, correct) => recordAnswer(current, id, correct, monday), progress)
  }

  it('only includes items missed at least 3 times and right less than 60% of the time', () => {
    let progress = createEmptyProgress()
    progress = answer(progress, 'char:你', [false, false, false, true]) // 3 mistakes, 25%
    progress = answer(progress, 'char:好', [false, false, true]) // only 2 mistakes
    progress = answer(progress, 'char:谢', [false, false, false, true, true, true]) // 50%
    progress = answer(progress, 'char:了', [false, false, false, true, true, true, true, true]) // 62.5%

    expect(getDifficultItems(progress).map((item) => item.itemId)).toEqual(['char:你', 'char:谢'])
  })

  it('sorts by mistakes and, on ties, by worst accuracy', () => {
    let progress = createEmptyProgress()
    progress = answer(progress, 'char:你', [false, false, false, true])
    progress = answer(progress, 'char:好', [false, false, false, false])
    progress = answer(progress, 'char:谢', [false, false, false])

    expect(getDifficultItems(progress).map((item) => item.itemId)).toEqual(['char:好', 'char:谢', 'char:你'])
  })
})

describe('summarizeWriting', () => {
  it('counts writing records by status, apart from recognition', () => {
    let progress = recordAnswer(createEmptyProgress(), 'char:好', true, monday)
    progress = recordWritingAnswer(progress, 'char:你', false, monday)
    expect(summarizeWriting(progress)).toEqual({ learning: 1, mastered: 0 })
  })
})

describe('getActivityCalendar', () => {
  it('returns whole weeks from Monday, the current one last, with days after today marked as future', () => {
    // 2026-10-01 is a Thursday
    const thursday = new Date(2026, 9, 1, 10)
    const weeks = getActivityCalendar({ '2026-10-01': { answers: 5, correct: 4 } }, thursday, 3)
    expect(weeks).toHaveLength(3)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]![0]!.date).toBe('2026-09-14')
    const lastWeek = weeks[2]!
    expect(lastWeek[0]!.date).toBe('2026-09-28')
    expect(lastWeek[3]).toMatchObject({ date: '2026-10-01', answers: 5, future: false })
    expect(lastWeek[4]).toMatchObject({ date: '2026-10-02', answers: 0, future: true })
  })
})

describe('getWeeklyAccuracy', () => {
  it('adds up each week and leaves weeks without answers empty', () => {
    const activity = { '2026-09-28': { answers: 4, correct: 3 }, '2026-09-30': { answers: 6, correct: 5 } }
    const weeks = getWeeklyAccuracy(activity, new Date(2026, 9, 1), 2)
    expect(weeks).toEqual([
      { weekStart: '2026-09-21', answers: 0, accuracy: undefined },
      { weekStart: '2026-09-28', answers: 10, accuracy: 0.8 },
    ])
  })
})

describe('getReviewForecast', () => {
  it('counts reviews per day, with overdue ones today and basic items left out', () => {
    const progress = createEmptyProgress()
    const record = (itemId: StudyItemId, nextReviewAt: Date, basic?: true) => ({
      itemId,
      timesSeen: 1,
      timesCorrect: 1,
      timesWrong: 0,
      masteryLevel: 1,
      lastReviewedAt: monday.toISOString(),
      nextReviewAt: nextReviewAt.toISOString(),
      ...(basic && { basic }),
    })
    progress.items = {
      'word:你好': record('word:你好', new Date(2026, 8, 20)),
      'word:谢谢': record('word:谢谢', new Date(2026, 8, 30)),
      'word:再见': record('word:再见', new Date(2026, 8, 30), true),
      'word:老师': record('word:老师', new Date(2026, 11, 1)),
    }
    expect(getReviewForecast(progress, monday, 3)).toEqual([
      { date: '2026-09-28', count: 1 },
      { date: '2026-09-29', count: 0 },
      { date: '2026-09-30', count: 1 },
    ])
  })
})

describe('getGoalStreak', () => {
  const activity = {
    '2026-09-26': { answers: 25, correct: 20 },
    '2026-09-27': { answers: 20, correct: 20 },
    '2026-09-28': { answers: 5, correct: 5 },
  }

  it('counts days in a row with the goal met, from yesterday while today is not met yet', () => {
    expect(getGoalStreak(activity, monday, 20)).toBe(2)
  })

  it('includes today once it is met', () => {
    expect(getGoalStreak(activity, monday, 5)).toBe(3)
  })
})
