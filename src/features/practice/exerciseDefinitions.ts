import type { StudyItem } from '../dictionary/studyItem.ts'
import type { RandomFn } from '../../lib/random.ts'
import { hanziChoiceDefinition, meaningChoiceDefinition, pinyinChoiceDefinition } from './choiceExercises.ts'
import { matchMeaningDefinition, matchPinyinDefinition } from './matchExercises.ts'
import { toneChoiceDefinition } from './toneExercises.ts'
import type { Exercise, ExerciseType, FlashcardExercise } from './types.ts'

/**
 * How an exercise type is built. Each type knows whether it can be created
 * for an item (e.g. a choice exercise needs enough items to make up wrong
 * answers) and how to create it.
 *
 * `pool` is all the available items and `random` is injected so that the
 * tests are deterministic.
 */
export interface ExerciseDefinition<E extends Exercise = Exercise> {
  type: E['type']
  canBuild(item: StudyItem, pool: readonly StudyItem[]): boolean
  build(item: StudyItem, pool: readonly StudyItem[], random: RandomFn): E
}

export const flashcardDefinition: ExerciseDefinition<FlashcardExercise> = {
  type: 'flashcard',
  canBuild: () => true,
  build: (item) => ({ type: 'flashcard', item }),
}

/**
 * Every exercise type, in the order Settings and Home list them. Writing has
 * no definition: sessions add it on their own when an item's writing is due.
 */
export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'flashcard',
  'meaning-choice',
  'hanzi-choice',
  'pinyin-choice',
  'tone-choice',
  'match-pinyin',
  'match-meaning',
  'writing',
]

/** Available exercise types. Adding a new one = adding its definition here. */
export const EXERCISE_DEFINITIONS: readonly ExerciseDefinition[] = [
  flashcardDefinition,
  meaningChoiceDefinition,
  pinyinChoiceDefinition,
  hanziChoiceDefinition,
  toneChoiceDefinition,
  matchPinyinDefinition,
  matchMeaningDefinition,
]

/** The definitions of the given types (writing has none, see EXERCISE_TYPES). */
export function getDefinitions(types: readonly ExerciseType[]): ExerciseDefinition[] {
  return EXERCISE_DEFINITIONS.filter((definition) => types.includes(definition.type))
}
