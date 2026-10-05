import { useSessionShortcuts, type Shortcuts } from './shortcuts.ts'

/** Keys 1-4 pick an option; once answered, Enter or Space continue. */
export function useChoiceShortcuts(optionCount: number, isAnswered: boolean, select: (index: number) => void, next: () => void) {
  const shortcuts: Shortcuts = isAnswered
    ? { Enter: next, ' ': next }
    : Object.fromEntries(Array.from({ length: optionCount }, (_, index) => [String(index + 1), () => select(index)]))
  useSessionShortcuts(shortcuts)
}

export type OptionState = 'idle' | 'correct' | 'wrong' | 'other'

export function getOptionState(isAnswered: boolean, isAnswer: boolean, isSelected: boolean): OptionState {
  if (!isAnswered) return 'idle'
  if (isAnswer) return 'correct'
  return isSelected ? 'wrong' : 'other'
}

