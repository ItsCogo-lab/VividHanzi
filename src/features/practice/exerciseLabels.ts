import type { MessageKey } from '../../i18n/index.ts'
import type { ExerciseType } from './types.ts'

/** Short name of each exercise type, for Settings, Home and session titles. */
export const EXERCISE_TYPE_LABELS: Record<ExerciseType, MessageKey> = {
  flashcard: 'exerciseType.flashcard',
  'meaning-choice': 'exerciseType.meaning',
  'hanzi-choice': 'exerciseType.hanzi',
  'pinyin-choice': 'exerciseType.pinyin',
  'tone-choice': 'exerciseType.tones',
  'match-pinyin': 'exerciseType.matchPinyin',
  'match-meaning': 'exerciseType.matchMeaning',
  writing: 'exerciseType.writing',
}

/** One line on what the exercise asks. */
export const EXERCISE_TYPE_HINTS: Record<ExerciseType, MessageKey> = {
  flashcard: 'exerciseType.flashcardHint',
  'meaning-choice': 'exerciseType.meaningHint',
  'hanzi-choice': 'exerciseType.hanziHint',
  'pinyin-choice': 'exerciseType.pinyinHint',
  'tone-choice': 'exerciseType.tonesHint',
  'match-pinyin': 'exerciseType.matchPinyinHint',
  'match-meaning': 'exerciseType.matchMeaningHint',
  writing: 'exerciseType.writingHint',
}
