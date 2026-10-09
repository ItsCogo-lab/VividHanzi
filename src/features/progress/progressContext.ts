import { createContext, use } from 'react'
import type { StudyItemId } from '../dictionary/studyItem.ts'
import type { HskLevel } from '../dictionary/types.ts'
import type { ExerciseResult } from '../practice/types.ts'
import type { LeveledItem } from './progress.ts'
import type { ProgressData } from './types.ts'

export interface ProgressContextValue {
  progress: ProgressData
  recordAnswer: (itemId: StudyItemId, correct: boolean) => void
  /** Saves an exercise's answer: writing ones to writing progress, the rest to recognition. */
  recordResult: (result: ExerciseResult) => void
  /** Marks an item as learned (Learn session). */
  introduceItem: (itemId: StudyItemId) => void
  /** Marks characters as taught for writing (see markCharactersTaught). */
  markCharactersTaught: (characters: readonly string[]) => void
  /** Marks an item as already mastered (Learn session): it comes up again only very occasionally. */
  markItemKnown: (itemId: StudyItemId) => void
  /** Marks an item as one the user doesn't want to learn, or undoes it (see setItemExcluded). */
  setItemExcluded: (itemId: StudyItemId, excluded: boolean) => void
  /** Applies the user's HSK level to those items (see applyHskLevel in progress.ts). */
  applyHskLevel: (items: readonly LeveledItem[], level: HskLevel | null) => void
  resetProgress: () => void
}

export const ProgressContext = createContext<ProgressContextValue | null>(null)

/** The user's progress and actions to change it. Requires a <ProgressProvider> above. */
export function useProgress(): ProgressContextValue {
  const value = use(ProgressContext)
  if (!value) throw new Error('useProgress must be used within <ProgressProvider>')
  return value
}
