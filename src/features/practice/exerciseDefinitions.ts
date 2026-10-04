import type { StudyItem } from '../dictionary/studyItem.ts'
import type { RandomFn } from '../../lib/random.ts'
import { hanziChoiceDefinition, meaningChoiceDefinition, pinyinChoiceDefinition } from './choiceExercises.ts'
import { toneChoiceDefinition } from './toneExercises.ts'
import type { Exercise, FlashcardExercise } from './types.ts'

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

/** Available exercise types. Adding a new one = adding its definition here. */
export const EXERCISE_DEFINITIONS: readonly ExerciseDefinition[] = [
  flashcardDefinition,
  meaningChoiceDefinition,
  pinyinChoiceDefinition,
  hanziChoiceDefinition,
  toneChoiceDefinition,
]
