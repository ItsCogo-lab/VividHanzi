import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { hskStudyItems } from '../features/dictionary/hskDictionary.ts'
import { getMeaningLabel, getPinyinLabel } from '../features/practice/choiceExercises.ts'

/** Answers the current exercise, whatever its type (the type is random). */
export async function answerCurrentExercise(user: ReturnType<typeof userEvent.setup>) {
  const showAnswer = screen.queryByRole('button', { name: 'Show answer' })
  if (showAnswer) {
    await user.click(showAnswer)
    await user.click(screen.getByRole('button', { name: 'Both' }))
    return
  }
  const hanziSide = screen.queryByRole('list', { name: 'Hanzi' })
  if (hanziSide) {
    await solveMatch(user, hanziSide)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    return
  }
  const [firstOption] = within(screen.getByRole('list', { name: 'Options' })).getAllByRole('button')
  await user.click(firstOption!)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

/**
 * Pairs every hanzi with its answer, looking up what each pair should be. An
 * item outside HSK (from a custom set) can't be looked up here, but it is
 * at most one, so it takes the answer left at the end.
 */
async function solveMatch(user: ReturnType<typeof userEvent.setup>, hanziSide: HTMLElement) {
  const answerSide = screen.getByRole('list', { name: 'Answers' })
  const isPinyin = screen.queryByRole('heading', { name: /pinyin/ }) !== null
  const unresolved: HTMLElement[] = []
  for (const button of within(hanziSide).getAllByRole('button')) {
    const candidates = hskStudyItems.filter((item) => item.entry.hanzi === button.textContent?.replace(/^\d/, ''))
    const labels = candidates.map((item) => (isPinyin ? getPinyinLabel(item) : getMeaningLabel(item)))
    const answer = labels.map((label) => within(answerSide).queryByRole('button', { name: label })).find(Boolean)
    if (!answer) {
      unresolved.push(button)
      continue
    }
    await user.click(button)
    await user.click(answer)
  }
  for (const button of unresolved) {
    const [left] = within(answerSide).getAllByRole('button').filter((answer) => !(answer as HTMLButtonElement).disabled)
    await user.click(button)
    await user.click(left!)
  }
}
