import { shuffle } from '../../lib/random.ts'
import { meaningChoiceDefinition, pickDistractors, pinyinChoiceDefinition } from './choiceExercises.ts'
import type { ExerciseDefinition } from './exerciseDefinitions.ts'
import type { MatchExercise, MatchExerciseType } from './types.ts'

/**
 * Matching reuses the choice rules: the three extra items are the same
 * distractors a pinyin or meaning question would use, so no two share a
 * reading or a meaning and every pair has a single answer.
 */
const CHOICE_DEFINITIONS = {
  'match-pinyin': pinyinChoiceDefinition,
  'match-meaning': meaningChoiceDefinition,
} as const

function createMatchDefinition(type: MatchExerciseType): ExerciseDefinition<MatchExercise> {
  const choice = CHOICE_DEFINITIONS[type]
  return {
    type,
    canBuild: (item, pool) => choice.canBuild(item, pool),
    build: (item, pool, random) => {
      const others = pickDistractors(choice.type, item, shuffle(pool, random))
      return { type, item, items: shuffle([item, ...others], random), answers: shuffle([item, ...others], random) }
    },
  }
}

export const matchPinyinDefinition = createMatchDefinition('match-pinyin')
export const matchMeaningDefinition = createMatchDefinition('match-meaning')
