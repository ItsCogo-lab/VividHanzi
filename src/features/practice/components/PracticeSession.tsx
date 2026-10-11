import { useReducer, useState } from 'react'
import { t } from '../../../i18n/index.ts'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import { useProgress } from '../../progress/progressContext.ts'
import {
  createExerciseResult,
  createSessionState,
  getCurrentExercise,
  getFirstAttemptResults,
  getLastAnswer,
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
 *
 * Back undoes the last answer: the session returns to that exercise and the
 * item's progress goes back to how it was when the exercise was shown.
 */
export function PracticeSession({ exercises, dictionary, onResult, onRestart }: PracticeSessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, exercises, createSessionState)
  const { progress, restoreProgress } = useProgress()
  // The progress when the current exercise was shown, to undo its answer later
  // (updated while rendering, the React way of adjusting state to a change)
  const [shown, setShown] = useState({ index: state.currentIndex, progress })
  if (shown.index !== state.currentIndex) setShown({ index: state.currentIndex, progress })
  const exercise = getCurrentExercise(state)

  const lastAnswer = getLastAnswer(state)
  const back =
    lastAnswer &&
    (() => {
      restoreProgress(lastAnswer.progress, [lastAnswer.itemId])
      dispatch({ type: 'back' })
    })

  if (!exercise) {
    const firstAttempts = getFirstAttemptResults(state)
    const missedItems = firstAttempts.flatMap((result, index) =>
      result.correct ? [] : [state.exercises[index]!.item],
    )
    return (
      <SessionSummary
        summary={summarizeResults(firstAttempts)}
        missedItems={missedItems}
        onRestart={onRestart}
        onBack={back}
      />
    )
  }

  const current = state.currentIndex + 1
  const total = state.exercises.length

  return (
    <SessionFrame
      progressText={t('practice.progress', { current, total })}
      value={state.currentIndex}
      max={total}
      onBack={back}
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
              dispatch({ type: 'answer', correct, skills, progress: shown.progress })
            }}
            onSkip={() => dispatch({ type: 'skip' })}
            onLookUp={lookUp}
          />
        </>
      )}
    </SessionFrame>
  )
}
