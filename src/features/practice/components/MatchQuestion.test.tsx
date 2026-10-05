import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import type { Character } from '../../dictionary/types.ts'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import type { MatchExercise } from '../types.ts'
import { MatchQuestion } from './MatchQuestion.tsx'

function character(hanzi: string, pinyin: string, meaning: string): StudyItem {
  return { kind: 'character', entry: { id: hanzi, hanzi, pinyin: [pinyin], meanings: { en: [meaning] }, hskLevel: 1 } }
}

const [one, two, three, four] = [
  character('一', 'yī', 'one'),
  character('二', 'èr', 'two'),
  character('三', 'sān', 'three'),
  character('四', 'sì', 'four'),
] as const

function renderQuestion(type: MatchExercise['type'] = 'match-meaning') {
  const onAnswer = vi.fn()
  const exercise: MatchExercise = { type, item: two, items: [one, two, three, four], answers: [four, three, two, one] }
  const dictionary = createDictionary([one, two, three, four].map((item) => item.entry as Character), [])
  renderWithProviders(<MatchQuestion exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={() => {}} />)
  return onAnswer
}

const hanziButton = (text: string) => within(screen.getByRole('list', { name: 'Hanzi' })).getByRole('button', { name: text })
const answerButton = (text: string) => within(screen.getByRole('list', { name: 'Answers' })).getByRole('button', { name: text })

describe('MatchQuestion', () => {
  it('is correct when all pairs are matched without missing the item', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    for (const [hanzi, meaning] of [['一', 'one'], ['二', 'two'], ['三', 'three'], ['四', 'four']]) {
      await user.click(hanziButton(hanzi!))
      await user.click(answerButton(meaning!))
    }

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('a matched pair is disabled and a wrong pair with the item makes it a miss', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    await user.click(hanziButton('一'))
    await user.click(answerButton('one'))
    expect(screen.getByRole('button', { name: /一.*matched/ })).toBeDisabled()

    // 二 is the graded item: pairing it wrongly counts against it
    await user.click(answerButton('three'))
    await user.click(hanziButton('二'))
    expect(screen.getByRole('button', { name: /二.*not a pair/ })).toBeInTheDocument()
    await screen.findByRole('button', { name: '二' }, { timeout: 2000 })

    for (const [hanzi, meaning] of [['二', 'two'], ['三', 'three'], ['四', 'four']]) {
      await user.click(hanziButton(hanzi!))
      await user.click(answerButton(meaning!))
    }
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('can be played with keys 1-4 and 5-8', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion('match-pinyin')

    // Answers are 四 三 二 一: hanzi key n pairs with answer key 9 - n
    await user.keyboard('18273645')
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledWith(true)
  })
})
