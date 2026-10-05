import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { testCharacters, testWords } from '../../dictionary/testData.ts'
import type { FlashcardExercise } from '../types.ts'
import { hanzi } from '../../../test/hanzi.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { Flashcard } from './Flashcard.tsx'

const dictionary = createDictionary(testCharacters, testWords)

const wordExercise: FlashcardExercise = { type: 'flashcard', item: { kind: 'word', entry: testWords[0]! } } // 你好
const characterExercise: FlashcardExercise = {
  type: 'flashcard',
  item: { kind: 'character', entry: testCharacters[1]! }, // 好
}

describe('Flashcard', () => {
  it('shows the hanzi and hides the answer until "Show answer" is pressed', () => {
    renderWithProviders(<Flashcard exercise={wordExercise} dictionary={dictionary} onAnswer={() => {}} onLookUp={() => {}} />)

    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.queryByText('nǐ hǎo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument()
  })

  it('on reveal shows pinyin, meaning and the characters of the word', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Flashcard exercise={wordExercise} dictionary={dictionary} onAnswer={() => {}} onLookUp={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Show answer' }))

    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(screen.getByText('Characters').nextElementSibling).toHaveTextContent('你')
    expect(screen.getByRole('group', { name: 'Answer' })).toHaveFocus()
  })

  it('for a character shows the words it appears in', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Flashcard exercise={characterExercise} dictionary={dictionary} onAnswer={() => {}} onLookUp={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Show answer' }))

    expect(screen.getByText('Appears in')).toBeInTheDocument()
    const related = screen.getByText('Appears in').nextElementSibling as HTMLElement
    expect(related).toHaveTextContent('你好')
    // The word 好 is the same character: it is not shown as related
    expect(within(related).queryByText(hanzi('好'))).not.toBeInTheDocument()
  })

  it.each([
    ['Both', true, { pinyin: true, meaning: true }],
    ['Only the pinyin', false, { pinyin: true, meaning: false }],
    ['Only the meaning', false, { pinyin: false, meaning: true }],
    ['Neither', false, { pinyin: false, meaning: false }],
  ])('"%s" answers %s, with each skill apart', async (buttonName, expected, skills) => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    renderWithProviders(<Flashcard exercise={wordExercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByRole('group', { name: 'What did you know?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: buttonName }))

    expect(onAnswer).toHaveBeenCalledWith(expected, skills)
  })

  it('Space shows the answer and keys 1-4 grade it (2: only the pinyin)', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    renderWithProviders(<Flashcard exercise={wordExercise} dictionary={dictionary} onAnswer={onAnswer} onLookUp={() => {}} />)

    await user.keyboard('1')
    expect(onAnswer).not.toHaveBeenCalled()

    await user.keyboard(' ')
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()

    await user.keyboard('2')
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false, { pinyin: true, meaning: false })
  })
})
