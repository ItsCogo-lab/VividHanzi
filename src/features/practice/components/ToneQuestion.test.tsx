import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import type { Word } from '../../dictionary/types.ts'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import type { ToneExercise } from '../types.ts'
import { ToneQuestion } from './ToneQuestion.tsx'

const item: StudyItem = { kind: 'word', entry: { id: '你好', hanzi: '你好', pinyin: 'nǐ hǎo', meanings: { en: ['hello'] }, hskLevel: 1 } }
const exercise: ToneExercise = { type: 'tone-choice', item, answer: 'nǐ hǎo', options: ['ní hǎo', 'nǐ hǎo', 'nǐ hào', 'nì hǎo'] }

function renderQuestion(onAnswer = vi.fn()) {
  const dictionary = createDictionary([], [item.entry as Word])
  renderWithProviders(<ToneQuestion exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={() => {}} />)
  return onAnswer
}

describe('ToneQuestion', () => {
  it('shows the pinyin without tones and four spellings to choose from', () => {
    renderQuestion()

    expect(screen.getByText('ni hao')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Which tones are right?' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Options' })).getAllByRole('button')).toHaveLength(4)
  })

  it('grades a wrong pick and reports it on continue', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    await user.click(screen.getByRole('button', { name: 'nǐ hào' }))
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nǐ hǎo.*correct answer/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('can be answered with the keyboard', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    await user.keyboard('2')
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledWith(true)
  })
})
