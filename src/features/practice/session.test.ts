import { describe, expect, it } from 'vitest'
import { createDictionary } from '../dictionary/dictionary.ts'
import { getStudyItemId, listStudyItems, type StudyItem } from '../dictionary/studyItem.ts'
import { testCharacters, testWords } from '../dictionary/testData.ts'
import { seededRandom } from '../../test/random.ts'
import type { ExerciseDefinition } from './exerciseDefinitions.ts'
import { applyHskLevel, createEmptyProgress, introduceItem, recordAnswer, recordWritingAnswer } from '../progress/progress.ts'
import type { ProgressData } from '../progress/types.ts'
import { hskStudyItems } from '../dictionary/hskDictionary.ts'
import { matchMeaningDefinition } from './matchExercises.ts'
import {
  createSessionExercises,
  createSessionState,
  getCurrentExercise,
  isSessionFinished,
  selectSessionItems,
  createRetryExercise,
  getFirstAttemptResults,
  isRetry,
  pickDefinition,
  sessionReducer,
  summarizeResults,
} from './session.ts'
import type { Exercise } from './types.ts'

const pool = listStudyItems(createDictionary(testCharacters, testWords))

describe('createSessionExercises', () => {
  it('creates as many exercises as the requested size, without repeating items', () => {
    const exercises = createSessionExercises(pool, { size: 5, random: seededRandom(1) })

    expect(exercises).toHaveLength(5)
    expect(new Set(exercises.map((exercise) => exercise.item)).size).toBe(5)
  })

  it('creates fewer exercises if there are not enough items', () => {
    expect(createSessionExercises(pool, { size: 100, random: seededRandom(1) })).toHaveLength(pool.length)
  })

  it('creates the same session with the same seed', () => {
    const first = createSessionExercises(pool, { size: 4, random: seededRandom(3) })
    const second = createSessionExercises(pool, { size: 4, random: seededRandom(3) })

    expect(first).toEqual(second)
  })

  it('skips items for which no exercise can be built', () => {
    const onlyWords: ExerciseDefinition = {
      type: 'flashcard',
      canBuild: (item) => item.kind === 'word',
      build: (item) => ({ type: 'flashcard', item }),
    }
    const exercises = createSessionExercises(pool, { size: 100, random: seededRandom(1), definitions: [onlyWords] })

    expect(exercises).toHaveLength(testWords.length)
    expect(exercises.every((exercise) => exercise.item.kind === 'word')).toBe(true)
  })
})

describe('createSessionExercises with matching', () => {
  const learnedIds = ['word:学生', 'word:老师', 'word:朋友', 'word:医生', 'word:谢谢', 'word:飞机'] as const
  const learnedItems = hskStudyItems.filter((item) => (learnedIds as readonly string[]).includes(getStudyItemId(item)))
  const options = (progress: ProgressData) => ({
    progress,
    size: 10,
    random: seededRandom(2),
    distractorPool: hskStudyItems,
    definitions: [matchMeaningDefinition],
  })

  it('takes the other three words from what the user has learned', () => {
    let progress = createEmptyProgress()
    for (const itemId of learnedIds) progress = introduceItem(progress, itemId, new Date())
    const exercises = createSessionExercises(learnedItems, options(progress))

    expect(exercises).toHaveLength(learnedIds.length)
    for (const exercise of exercises) {
      if (exercise.type !== 'match-meaning') throw new Error('expected a matching exercise')
      expect(exercise.items.every((item) => progress.items[getStudyItemId(item)] !== undefined)).toBe(true)
    }
  })

  it('falls back to all the vocabulary when too little is learned', () => {
    const [item] = learnedItems
    const progress = introduceItem(createEmptyProgress(), getStudyItemId(item!), new Date())
    const [exercise] = createSessionExercises([item!], options(progress))

    expect(exercise?.type).toBe('match-meaning')
    expect(exercise?.type === 'match-meaning' && exercise.items).toHaveLength(4)
  })
})

describe('selectSessionItems', () => {
  const monday = new Date(2026, 8, 28, 10, 0)
  const thursday = new Date(2026, 9, 1, 10, 0)
  const ids = (items: readonly StudyItem[]) => items.map(getStudyItemId).toSorted()

  // 你 and 好 were missed (already due); 谢 and 了 were answered correctly (due from tomorrow)
  let progress = createEmptyProgress()
  for (const [id, correct] of [
    ['char:你', false],
    ['char:好', false],
    ['char:谢', true],
    ['char:了', true],
  ] as const) {
    progress = recordAnswer(progress, id, correct, monday)
  }

  it('puts due reviews first', () => {
    expect(ids(selectSessionItems(pool, progress, monday, 2, seededRandom(1)))).toEqual(['char:你', 'char:好'])
  })

  it('then the new items', () => {
    expect(ids(selectSessionItems(pool, progress, monday, 5, seededRandom(1)))).toEqual(
      ['char:你', 'char:好', 'word:你好', 'word:好', 'word:谢谢'].toSorted(),
    )
  })

  it('takes the most frequent new items first', () => {
    const ranked = pool.map((item) =>
      item.kind === 'word' && item.entry.id === '谢谢' ? { ...item, entry: { ...item.entry, frequencyRank: 1 } } : item,
    )
    // Room for the 2 due reviews and 1 new item: always 谢谢, never at random
    for (const seed of [1, 2, 3]) {
      expect(ids(selectSessionItems(ranked, progress, monday, 3, seededRandom(seed)))).toContain('word:谢谢')
    }
  })

  it('and, if still short, the ones not yet due', () => {
    expect(selectSessionItems(pool, progress, monday, 100, seededRandom(1))).toHaveLength(pool.length)
  })

  it('basic items are never due and go after everything else', () => {
    // 你 was a due miss, but with HSK 3 it becomes basic
    const withBasic = applyHskLevel(progress, [{ itemId: 'char:你', hskLevel: 1 }], 3, monday)
    const items = pool.filter((item) => withBasic.items[getStudyItemId(item)] !== undefined)

    expect(ids(selectSessionItems(items, withBasic, thursday, 3, seededRandom(1)))).toEqual(
      ['char:好', 'char:谢', 'char:了'].toSorted(),
    )
  })

  it('when their date arrives, correctly answered items are also due reviews', () => {
    expect(ids(selectSessionItems(pool, progress, thursday, 4, seededRandom(1)))).toEqual(
      ['char:你', 'char:好', 'char:谢', 'char:了'].toSorted(),
    )
  })
})

describe('sessionReducer', () => {
  const exercises: Exercise[] = pool.slice(0, 2).map((item) => ({ type: 'flashcard', item }))

  it('on answering, stores the result and moves to the next exercise', () => {
    const state = sessionReducer(createSessionState(exercises), { type: 'answer', correct: true })

    expect(state.currentIndex).toBe(1)
    expect(state.results).toEqual([{ itemId: 'char:你', exerciseType: 'flashcard', correct: true }])
    expect(getCurrentExercise(state)).toBe(exercises[1])
  })

  it('finishes when all exercises have been answered correctly', () => {
    let state = createSessionState(exercises)
    state = sessionReducer(state, { type: 'answer', correct: true })
    expect(isSessionFinished(state)).toBe(false)

    state = sessionReducer(state, { type: 'answer', correct: true })
    expect(isSessionFinished(state)).toBe(true)
    expect(getCurrentExercise(state)).toBeUndefined()
  })

  it('asks a missed exercise again at the end until it is answered correctly', () => {
    let state = createSessionState(exercises)
    state = sessionReducer(state, { type: 'answer', correct: false })
    state = sessionReducer(state, { type: 'answer', correct: true })
    expect(isRetry(state)).toBe(true)
    expect(getCurrentExercise(state)?.item).toBe(exercises[0]!.item)

    state = sessionReducer(state, { type: 'answer', correct: false })
    expect(getCurrentExercise(state)?.item).toBe(exercises[0]!.item)

    state = sessionReducer(state, { type: 'answer', correct: true })
    expect(isSessionFinished(state)).toBe(true)
    expect(state.results).toHaveLength(4)
  })

  it('a skipped exercise leaves the session without a result', () => {
    let state = createSessionState(exercises)
    state = sessionReducer(state, { type: 'skip' })
    expect(getCurrentExercise(state)).toBe(exercises[1])
    expect(state.firstAttemptCount).toBe(1)

    state = sessionReducer(state, { type: 'answer', correct: true })
    expect(isSessionFinished(state)).toBe(true)
    expect(state.results).toHaveLength(1)
  })

  it('only the first attempts count for the score', () => {
    let state = createSessionState(exercises)
    state = sessionReducer(state, { type: 'answer', correct: false })
    state = sessionReducer(state, { type: 'answer', correct: true })
    state = sessionReducer(state, { type: 'answer', correct: true })

    expect(summarizeResults(getFirstAttemptResults(state))).toEqual({ total: 2, correct: 1, wrong: 1 })
  })

  it('ignores answers once the session has finished', () => {
    const finished = { ...createSessionState(exercises), currentIndex: 2 }

    expect(sessionReducer(finished, { type: 'answer', correct: true })).toBe(finished)
  })
})

describe('createSessionExercises with writing', () => {
  const monday = new Date(2026, 8, 28, 10, 0)
  const thursday = new Date(2026, 9, 1, 10, 0)
  const thanks = pool.find((item) => item.kind === 'word' && item.entry.id === '谢谢')!
  // Read right once: 谢谢 can now be written, and its recognition is due again on Thursday
  const progress = recordAnswer(createEmptyProgress(), 'word:谢谢', true, monday)

  it('writes an item when it is its turn to be written', () => {
    const [exercise] = createSessionExercises([thanks], { progress, now: thursday, writing: true, distractorPool: pool })
    expect(exercise?.type).toBe('writing')
  })

  it('never with writing off, and not when its writing review is still ahead', () => {
    const [off] = createSessionExercises([thanks], { progress, now: thursday, distractorPool: pool })
    expect(off?.type).not.toBe('writing')

    const written = recordWritingAnswer(progress, 'word:谢谢', true, thursday)
    const [notDue] = createSessionExercises([thanks], { progress: written, now: thursday, writing: true, distractorPool: pool })
    expect(notDue?.type).not.toBe('writing')
  })
})

describe('createRetryExercise', () => {
  it('moves the options of a choice question so the answer is somewhere else', () => {
    const [item, ...others] = pool.slice(0, 4)
    const exercise: Exercise = { type: 'meaning-choice', item: item!, options: [item!, ...others] }
    const retry = createRetryExercise(exercise)

    expect(retry.type === 'meaning-choice' && retry.options).toEqual([...others, item])
    expect(exercise.options[0]).toBe(item)
  })

  it('repeats a flashcard as it is', () => {
    const exercise: Exercise = { type: 'flashcard', item: pool[0]! }
    expect(createRetryExercise(exercise)).toBe(exercise)
  })
})

describe('summarizeResults', () => {
  it('counts correct and wrong answers', () => {
    const summary = summarizeResults([
      { itemId: 'char:你', exerciseType: 'flashcard', correct: true },
      { itemId: 'word:好', exerciseType: 'flashcard', correct: false },
      { itemId: 'word:谢谢', exerciseType: 'flashcard', correct: true },
    ])

    expect(summary).toEqual({ total: 3, correct: 2, wrong: 1 })
  })

  it('works with an empty session', () => {
    expect(summarizeResults([])).toEqual({ total: 0, correct: 0, wrong: 0 })
  })
})

describe('pickDefinition', () => {
  const item = pool.find((candidate) => candidate.kind === 'word')!
  const itemId = getStudyItemId(item)
  const definitions = [
    { type: 'meaning-choice', canBuild: () => true, build: () => ({ type: 'flashcard', item }) },
    { type: 'tone-choice', canBuild: () => true, build: () => ({ type: 'flashcard', item }) },
  ] as unknown as ExerciseDefinition[]

  it('picks evenly between skills that are equally known', () => {
    expect(pickDefinition(definitions, item, createEmptyProgress(), () => 0.49)?.type).toBe('meaning-choice')
    expect(pickDefinition(definitions, item, createEmptyProgress(), () => 0.51)?.type).toBe('tone-choice')
  })

  it('leans towards the weaker skill', () => {
    let progress = createEmptyProgress()
    for (let index = 0; index < 3; index++) progress = recordAnswer(progress, itemId, true, new Date(), { meaning: true })
    // Weights: meaning 1/4, tones 1 → meaning only below 0.2
    expect(pickDefinition(definitions, item, progress, () => 0.19)?.type).toBe('meaning-choice')
    expect(pickDefinition(definitions, item, progress, () => 0.21)?.type).toBe('tone-choice')
  })
})
