import { compareByFrequency, getStudyItemId, type StudyItem } from '../dictionary/studyItem.ts'
import { createEmptyProgress, isDue } from '../progress/progress.ts'
import { EXERCISE_SKILLS, getSkillStreak, type SkillResults } from '../progress/skills.ts'
import type { ProgressData } from '../progress/types.ts'
import { shuffle, type RandomFn } from '../../lib/random.ts'
import { EXERCISE_DEFINITIONS, type ExerciseDefinition } from './exerciseDefinitions.ts'
import type { Exercise, ExerciseResult } from './types.ts'
import { isWritingDue } from './writing.ts'

export const DEFAULT_SESSION_SIZE = 10

interface CreateSessionOptions {
  size?: number
  random?: RandomFn
  definitions?: readonly ExerciseDefinition[]
  /** The user's progress: decides which items go into the session. */
  progress?: ProgressData
  now?: Date
  /**
   * Where the wrong answers of choice questions come from. By default, the
   * same `pool`. When studying a small set (a 7-word topic) it is better to
   * take them from the whole dictionary.
   */
  distractorPool?: readonly StudyItem[]
  /** Include writing exercises (the Settings switch). */
  writing?: boolean
}

/**
 * Creates the exercises of a session: picks the items based on progress
 * (see selectSessionItems) and, for each one, the exercise. If writing is on
 * and it is time to write the item (isWritingDue), it is written; otherwise,
 * a recognition type among those that can be built, at random but leaning
 * towards the item's weaker skills (see pickDefinition).
 *
 * So writing reviews happen when the item comes up in a session, and a
 * miss while writing only affects the writing progress.
 */
export function createSessionExercises(
  pool: readonly StudyItem[],
  {
    size = DEFAULT_SESSION_SIZE,
    random = Math.random,
    definitions = EXERCISE_DEFINITIONS,
    progress = createEmptyProgress(),
    now = new Date(),
    distractorPool = pool,
    writing = false,
  }: CreateSessionOptions = {},
): Exercise[] {
  const exercises: Exercise[] = []
  for (const item of selectSessionItems(pool, progress, now, size, random)) {
    if (writing && isWritingDue(item, progress, now)) {
      exercises.push({ type: 'writing', item })
      continue
    }
    const candidates = definitions.filter((definition) => definition.canBuild(item, distractorPool))
    const definition = pickDefinition(candidates, item, progress, random)
    if (definition) exercises.push(definition.build(item, distractorPool, random))
  }
  return exercises
}

/**
 * Picks an exercise type for an item. Each type weighs 1 / (1 + correct
 * answers in a row of its skill): a skill never practiced or just missed
 * comes up more often than one the item already knows well, but every type
 * keeps some chance.
 */
export function pickDefinition(
  candidates: readonly ExerciseDefinition[],
  item: StudyItem,
  progress: ProgressData,
  random: RandomFn,
): ExerciseDefinition | undefined {
  const itemId = getStudyItemId(item)
  const weights = candidates.map((definition) => 1 / (1 + getSkillStreak(progress, itemId, EXERCISE_SKILLS[definition.type])))
  let target = random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (const [index, weight] of weights.entries()) {
    target -= weight
    if (target < 0) return candidates[index]
  }
  return candidates.at(-1)
}

/**
 * Picks the items of a session, in order of priority:
 *
 * 1. Due reviews, starting with the ones that have been waiting longest.
 * 2. New items, the most frequent first (at random if they have no rank).
 * 3. If still short, already studied items whose review is closest
 *    (basic ones last).
 *
 * At the end they are shuffled so they do not come out grouped by kind.
 */
export function selectSessionItems(
  pool: readonly StudyItem[],
  progress: ProgressData,
  now: Date,
  size: number,
  random: RandomFn,
): StudyItem[] {
  const progressOf = (item: StudyItem) => progress.items[getStudyItemId(item)]
  // ISO dates in UTC sort correctly as text
  const byNextReview = (a: StudyItem, b: StudyItem) =>
    (progressOf(a)?.nextReviewAt ?? '').localeCompare(progressOf(b)?.nextReviewAt ?? '')

  const shuffled = shuffle(pool, random)
  const due = shuffled.filter((item) => isDue(progressOf(item), now)).sort(byNextReview)
  const fresh = shuffled.filter((item) => progressOf(item) === undefined).sort(compareByFrequency)
  // Basic items (see applyHskLevel) are never due: they go at the very end
  const isBasic = (item: StudyItem) => Number(progressOf(item)?.basic === true)
  const upcoming = shuffled
    .filter((item) => progressOf(item) !== undefined && !isDue(progressOf(item), now))
    .sort((a, b) => isBasic(a) - isBasic(b) || byNextReview(a, b))

  return shuffle([...due, ...fresh, ...upcoming].slice(0, size), random)
}

// --- State of an ongoing session -------------------------------------------

export interface SessionState {
  exercises: readonly Exercise[]
  currentIndex: number
  results: readonly ExerciseResult[]
  /**
   * How many exercises the session started with. Every missed exercise is
   * added again at the end (see sessionReducer), so the ones from this index
   * on are retries.
   */
  firstAttemptCount: number
}

/**
 * - `answer`: the current exercise was answered.
 * - `skip`: it couldn't be done (a writing exercise without stroke data, when
 *   offline): it leaves the session without counting as an answer.
 */
export type SessionAction = { type: 'answer'; correct: boolean; skills?: SkillResults } | { type: 'skip' }

export function createSessionState(exercises: readonly Exercise[]): SessionState {
  return { exercises, currentIndex: 0, results: [], firstAttemptCount: exercises.length }
}

/**
 * Session reducer: takes the state and an action and returns the new state,
 * without modifying the previous one. It is a pure function, so it can be
 * tested without React; the component uses it with useReducer.
 *
 * A missed exercise comes back at the end of the session until it is
 * answered correctly, like the relearning step in Anki: the session doesn't
 * end with something you just got wrong.
 */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const exercise = getCurrentExercise(state)
  if (!exercise) return state

  switch (action.type) {
    case 'answer': {
      const result = createExerciseResult(exercise, action.correct, action.skills)
      const exercises = action.correct ? state.exercises : [...state.exercises, createRetryExercise(exercise)]
      return { ...state, exercises, currentIndex: state.currentIndex + 1, results: [...state.results, result] }
    }
    case 'skip': {
      // Removed rather than left without a result, so results keep matching exercises by position
      const exercises = state.exercises.filter((_, index) => index !== state.currentIndex)
      const firstAttemptCount = state.firstAttemptCount - (isRetry(state) ? 0 : 1)
      return { ...state, exercises, firstAttemptCount }
    }
  }
}

/**
 * The same exercise, to ask again. In a choice question the options move
 * one place, so the answer can't be found by remembering where it was.
 */
export function createRetryExercise(exercise: Exercise): Exercise {
  switch (exercise.type) {
    case 'flashcard':
    case 'writing':
      return exercise
    case 'tone-choice':
      return { ...exercise, options: rotate(exercise.options) }
    case 'match-pinyin':
    case 'match-meaning':
      return { ...exercise, answers: rotate(exercise.answers) }
    default:
      return { ...exercise, options: rotate(exercise.options) }
  }
}

function rotate<T>(items: readonly T[]): T[] {
  const [first, ...rest] = items
  return first === undefined ? rest : [...rest, first]
}

/** Is the current exercise a retry of one missed earlier in the session? */
export function isRetry(state: SessionState): boolean {
  return state.currentIndex >= state.firstAttemptCount
}

/** Results of the first attempts only: retries don't change the session score. */
export function getFirstAttemptResults(state: SessionState): readonly ExerciseResult[] {
  return state.results.slice(0, state.firstAttemptCount)
}

export function createExerciseResult(exercise: Exercise, correct: boolean, skills?: SkillResults): ExerciseResult {
  return { itemId: getStudyItemId(exercise.item), exerciseType: exercise.type, correct, ...(skills && { skills }) }
}

export function getCurrentExercise(state: SessionState): Exercise | undefined {
  return state.exercises[state.currentIndex]
}

export function isSessionFinished(state: SessionState): boolean {
  return state.currentIndex >= state.exercises.length
}

export interface SessionSummary {
  total: number
  correct: number
  wrong: number
}

export function summarizeResults(results: readonly ExerciseResult[]): SessionSummary {
  const correct = results.filter((result) => result.correct).length
  return { total: results.length, correct, wrong: results.length - correct }
}
