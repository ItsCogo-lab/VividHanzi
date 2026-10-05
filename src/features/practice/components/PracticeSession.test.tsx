import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { testCharacters, testWords } from '../../dictionary/testData.ts'
import type { Exercise } from '../types.ts'
import { hanzi } from '../../../test/hanzi.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { PracticeSession } from './PracticeSession.tsx'

const dictionary = createDictionary(testCharacters, testWords)

const exercises: Exercise[] = [
  { type: 'flashcard', item: { kind: 'character', entry: testCharacters[0]! } }, // 你
  { type: 'flashcard', item: { kind: 'word', entry: testWords[2]! } }, // 谢谢
]

function renderSession({ onRestart = () => {}, onResult = () => {}, sessionExercises = exercises } = {}) {
  renderWithProviders(
    <PracticeSession
      exercises={sessionExercises}
      dictionary={dictionary}
      onResult={onResult}
      onRestart={onRestart}
    />,
  )
}

async function answer(user: ReturnType<typeof userEvent.setup>, buttonName: string) {
  await user.click(screen.getByRole('button', { name: 'Show answer' }))
  await user.click(screen.getByRole('button', { name: buttonName }))
}

describe('PracticeSession', () => {
  it('shows the exercises one by one with the progress', async () => {
    const user = userEvent.setup()
    renderSession()

    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('你')).toBeInTheDocument()

    await answer(user, 'Both')

    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('谢谢')).toBeInTheDocument()
    // The new card starts unrevealed
    expect(screen.getByRole('button', { name: 'Show answer' })).toBeInTheDocument()
  })

  it('at the end shows the summary with what needs reviewing', async () => {
    const user = userEvent.setup()
    renderSession()

    await answer(user, 'Both')
    await answer(user, 'Neither')
    // The missed card comes back at the end; the retry doesn't change the score
    expect(screen.getByText('Once more: you missed this one earlier.')).toBeInTheDocument()
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument()
    await answer(user, 'Both')

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    expect(screen.getByText('You knew 1 of 2.')).toBeInTheDocument()
    expect(screen.getByText('To review')).toBeInTheDocument()
    expect(screen.getByText('谢谢')).toBeInTheDocument()
    expect(screen.queryByText('你')).not.toBeInTheDocument()
  })

  it('reports each answer as soon as it is given, so it can be saved', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderSession({ onResult })

    await answer(user, 'Neither')
    const both = { pinyin: true, meaning: true }
    expect(onResult).toHaveBeenLastCalledWith({
      itemId: 'char:你',
      exerciseType: 'flashcard',
      correct: false,
      skills: { pinyin: false, meaning: false },
    })

    await answer(user, 'Both')
    expect(onResult).toHaveBeenLastCalledWith({ itemId: 'word:谢谢', exerciseType: 'flashcard', correct: true, skills: both })

    // The retry of 你 is an answer too
    await answer(user, 'Both')
    expect(onResult).toHaveBeenLastCalledWith({ itemId: 'char:你', exerciseType: 'flashcard', correct: true, skills: both })
    expect(onResult).toHaveBeenCalledTimes(3)
  })

  it('works the same with multiple-choice exercises', async () => {
    const user = userEvent.setup()
    const characters = testCharacters.map((entry) => ({ kind: 'character' as const, entry }))
    renderSession({ sessionExercises: [{ type: 'pinyin-choice', item: characters[0]!, options: characters }] }) // 你

    await user.click(screen.getByRole('button', { name: 'hǎo' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'nǐ' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('You knew 0 of 1.')).toBeInTheDocument()
    expect(screen.getByText('你')).toBeInTheDocument()
  })

  it('"Practice again" requests a new session', async () => {
    const user = userEvent.setup()
    const onRestart = vi.fn()
    renderSession({ onRestart })

    await answer(user, 'Both')
    await answer(user, 'Both')
    expect(screen.getByText('You knew all of them. Great job!')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Practice again' }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})

describe('PracticeSession: dictionary without leaving the session', () => {
  beforeEach(() => {
    // Entry pages request strokes and sentences when opened; there is no server here
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function getPanel() {
    return screen.getByRole('dialog', { name: 'Dictionary' })
  }

  it('opens the dictionary, searches a character and on close stays on the same card', async () => {
    const user = userEvent.setup()
    renderSession()
    await answer(user, 'Both') // moves to card 2: 谢谢
    await user.click(screen.getByRole('button', { name: 'Show answer' }))

    await user.click(screen.getByRole('button', { name: 'Dictionary' }))
    const search = within(getPanel()).getByRole('searchbox', { name: 'Search' })
    expect(search).toHaveFocus()

    await user.type(search, '你')
    const results = await within(getPanel()).findByRole('list', { name: 'Results' })
    await user.click(within(results).getAllByRole('button')[0]!)
    // The entry opens inside the panel, without changing page
    expect(within(getPanel()).getByRole('heading', { name: 'Meanings' })).toBeInTheDocument()
    expect(within(getPanel()).getByText(hanzi('你'), { selector: '.text-7xl' })).toBeInTheDocument()

    await user.click(within(getPanel()).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The session is exactly the same: card 2, with the answer revealed
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dictionary' })).toHaveFocus()
  })

  it('looks up a character from the answer and after closing with Escape the chosen answer is still there', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    const characters = testCharacters.map((entry) => ({ kind: 'character' as const, entry }))
    renderSession({ onResult, sessionExercises: [{ type: 'meaning-choice', item: characters[2]!, options: characters }] }) // 谢

    await user.click(screen.getByRole('button', { name: 'good; well' })) // wrong answer
    expect(screen.getByText('Not quite')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Look up 谢 in the dictionary' }))
    expect(within(getPanel()).getByRole('heading', { name: 'Meanings' })).toBeInTheDocument()
    // From the entry you can follow on to another (谢 → 谢谢) without leaving the panel
    await user.click(within(getPanel()).getByRole('button', { name: /谢谢/ }))
    expect(within(getPanel()).getByText('thanks')).toBeInTheDocument()
    await user.click(within(getPanel()).getByRole('button', { name: 'Back' }))
    // The panel uses the app's dictionary: 谢 "to thank" and, among its words, 谢谢
    expect(within(getPanel()).getAllByText('to thank')[0]).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /good; well/ })).toBeDisabled()
    // Looking up does not count as an answer: it is only saved on pressing Continue
    expect(onResult).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onResult).toHaveBeenCalledWith({ itemId: 'char:谢', exerciseType: 'meaning-choice', correct: false })
  })

  it('keyboard shortcuts are off while the dictionary is open', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderSession({ onResult })
    await user.keyboard(' ')

    await user.click(screen.getByRole('button', { name: 'Dictionary' }))
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('2')
    expect(onResult).not.toHaveBeenCalled()

    await user.click(within(getPanel()).getByRole('button', { name: 'Close' }))
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('2')
    expect(onResult).toHaveBeenCalledOnce()
  })

  it('does not offer to look up the item before answering, so as not to give away the answer', () => {
    renderSession()
    expect(screen.queryByRole('button', { name: /^Look up/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dictionary' })).toBeInTheDocument()
  })

  it('for a word offers to look up the word and each character', async () => {
    const user = userEvent.setup()
    renderSession({ sessionExercises: [{ type: 'flashcard', item: { kind: 'word', entry: testWords[0]! } }] }) // 你好
    await user.click(screen.getByRole('button', { name: 'Show answer' }))

    for (const target of ['你好', '你', '好']) {
      expect(screen.getByRole('button', { name: `Look up ${target} in the dictionary` })).toBeInTheDocument()
    }
  })
})
