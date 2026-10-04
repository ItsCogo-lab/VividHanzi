import type { StudyItem, StudyItemId } from '../dictionary/studyItem.ts'

/** Flashcard: the hanzi is shown and the user says whether they knew it. */
export interface FlashcardExercise {
  type: 'flashcard'
  item: StudyItem
}

/**
 * Multiple-choice exercise types:
 * - `meaning-choice`: the hanzi is shown and its meaning is picked.
 * - `pinyin-choice`: the hanzi is shown and its pinyin is picked.
 * - `hanzi-choice`: the meaning is shown and the hanzi is picked.
 */
export type ChoiceExerciseType = 'meaning-choice' | 'pinyin-choice' | 'hanzi-choice'

/** Multiple choice: one of the options is `item` and the rest are distractors. */
export interface ChoiceExercise {
  type: ChoiceExerciseType
  item: StudyItem
  /** Options in the order they are shown. */
  options: readonly StudyItem[]
}

/**
 * Tones: the hanzi and its pinyin without tone marks are shown, and the user
 * picks the right tones among four spellings that differ only in tones.
 */
export interface ToneExercise {
  type: 'tone-choice'
  item: StudyItem
  /** Pinyin with tone marks, in the order they are shown; one of them is `answer`. */
  options: readonly string[]
  answer: string
}

/**
 * Writing: the meaning and pinyin are shown and the user writes the hanzi
 * stroke by stroke. It has its own progress (ProgressData.writing).
 */
export interface WritingExercise {
  type: 'writing'
  item: StudyItem
}

/**
 * All exercise types. It is a union discriminated by `type`:
 * to add a new exercise, add its interface here.
 */
export type Exercise = FlashcardExercise | ChoiceExercise | ToneExercise | WritingExercise

export type ExerciseType = Exercise['type']

/** Result of answering an exercise. Progress is updated with it. */
export interface ExerciseResult {
  itemId: StudyItemId
  exerciseType: ExerciseType
  correct: boolean
}
