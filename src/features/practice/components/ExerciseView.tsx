import type { Dictionary } from '../../dictionary/dictionary.ts'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import type { SkillResults } from '../../progress/skills.ts'
import type { Exercise } from '../types.ts'
import { ChoiceQuestion } from './ChoiceQuestion.tsx'
import { Flashcard } from './Flashcard.tsx'
import { MatchQuestion } from './MatchQuestion.tsx'
import { ToneQuestion } from './ToneQuestion.tsx'
import { WritingExercise } from './WritingExercise.tsx'

type ExerciseViewProps = {
  exercise: Exercise
  dictionary: Dictionary
  /** `skills` only from a flashcard, which tests pinyin and meaning separately. */
  onAnswer: (correct: boolean, skills?: SkillResults) => void
  /** Leaves an exercise that can't be done without counting it (see WritingExercise). */
  onSkip: () => void
  /** Opens an item in the dictionary without leaving the session. */
  onLookUp: (item: StudyItem) => void
}

/**
 * Picks the component that renders each exercise type. When a new type is
 * added, TypeScript forces adding its case here (the `switch` must cover
 * every value of `exercise.type`).
 */
export function ExerciseView({ exercise, dictionary, onAnswer, onSkip, onLookUp }: ExerciseViewProps) {
  switch (exercise.type) {
    case 'flashcard':
      return <Flashcard exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={onLookUp} />
    case 'meaning-choice':
    case 'pinyin-choice':
    case 'hanzi-choice':
      return <ChoiceQuestion exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={onLookUp} />
    case 'tone-choice':
      return <ToneQuestion exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={onLookUp} />
    case 'match-pinyin':
    case 'match-meaning':
      return <MatchQuestion exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={onLookUp} />
    case 'writing':
      return (
        <WritingExercise exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onSkip={onSkip} onLookUp={onLookUp} />
      )
    default: {
      // If a case is missing, `exercise` would not be `never` and TypeScript would error here
      const missingCase: never = exercise
      throw new Error(`Exercise type without a component: ${JSON.stringify(missingCase)}`)
    }
  }
}
