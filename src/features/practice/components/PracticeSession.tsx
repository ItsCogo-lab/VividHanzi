import { useReducer } from 'react'
import { t } from '../../../i18n/index.ts'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import {
  createExerciseResult,
  createSessionState,
  getCurrentExercise,
  getFirstAttemptResults,
  isRetry,
  sessionReducer,
  summarizeResults,
} from '../session.ts'
import type { Exercise, ExerciseResult } from '../types.ts'
import { ExerciseView } from './ExerciseView.tsx'
import { SessionFrame } from './SessionFrame.tsx'
import { SessionSummary } from './SessionSummary.tsx'

type PracticeSessionProps = {
  exercises: readonly Exercise[]
  dictionary: Dictionary
  /** Called with each answer, to save it to progress right away. */
  onResult: (result: ExerciseResult) => void
  onRestart: () => void
}

/**
 * A practice session: shows the exercises one by one and, at the end, the
 * summary. All the logic lives in session.ts; this only renders.
 */
export function PracticeSession({ exercises, dictionary, onResult, onRestart }: PracticeSessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, exercises, createSessionState)
  const exercise = getCurrentExercise(state)

  if (!exercise) {
    const firstAttempts = getFirstAttemptResults(state)
    const missedItems = firstAttempts.flatMap((result, index) =>
      result.correct ? [] : [state.exercises[index]!.item],
    )
    return <SessionSummary summary={summarizeResults(firstAttempts)} missedItems={missedItems} onRestart={onRestart} />
  }

  const current = state.currentIndex + 1
  const total = state.exercises.length

  return (
    <SessionFrame
      progressText={t('practice.progress', { current, total })}
      value={state.currentIndex}
      max={total}
    >
      {(lookUp) => (
        <>
          {isRetry(state) && <p className="text-center text-sm text-ink-muted">{t('practice.retry')}</p>}
          {/* key: each exercise is a new component, so its state (e.g. "revealed") starts from scratch */}
          <ExerciseView
            key={state.currentIndex}
            exercise={exercise}
            dictionary={dictionary}
            onAnswer={(correct, skills) => {
              onResult(createExerciseResult(exercise, correct, skills))
              dispatch({ type: 'answer', correct, skills })
            }}
            onSkip={() => dispatch({ type: 'skip' })}
            onLookUp={lookUp}
          />
        </>
      )}
    </SessionFrame>
  )
}
