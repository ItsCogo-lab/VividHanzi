import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { topicDefinitions } from '../data/topics.ts'
import { loadMyStudies } from '../features/myStudies/storage.ts'
import { createEmptyProgress, getItemStatus, introduceItem, isDue, isExcluded, recordAnswer } from '../features/progress/progress.ts'
import { loadProgress, saveProgress } from '../features/progress/storage.ts'
import type { ProgressData } from '../features/progress/types.ts'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../features/settings/settings.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { PracticePage } from './PracticePage.tsx'
import { answerCurrentExercise, startSession } from '../test/answerExercise.ts'

/** Answers until the session ends: a missed choice question comes back at the end. */
async function finishSession(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 50 && !screen.queryByRole('heading', { name: 'Session complete' }); i++) {
    await answerCurrentExercise(user)
  }
}

describe('PracticePage', () => {
  it('uses the session size from the settings', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, sessionSize: 5 }, storage)
    renderWithProviders(<PracticePage />, { storage })
    await startSession(user)

    expect(screen.getByText('Card 1 of 5')).toBeInTheDocument()
  })

  it('saves each answer to progress', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<PracticePage />, { storage })
    await startSession(user)

    await answerCurrentExercise(user)
    await answerCurrentExercise(user)

    expect(screen.getByText(/^Card 3 of \d+$/)).toBeInTheDocument()
    expect(Object.keys(loadProgress(storage).items)).toHaveLength(2)
  })
})

describe('PracticePage: choosing exercise types before a session', () => {
  it('asks which exercise types to use, with the saved ones checked, before showing any exercise', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, exerciseTypes: ['flashcard', 'tone-choice'] }, storage)
    renderWithProviders(<PracticePage />, { storage })

    expect(screen.getByRole('group', { name: 'Which exercises do you want?' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^Flashcards/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /^Meaning/ })).not.toBeChecked()
    expect(screen.queryByText(/^Card 1/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus()
  })

  it('the session uses the types picked, and they are saved for next time', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<PracticePage />, { storage })

    for (const checkbox of screen.getAllByRole('checkbox')) {
      if (!checkbox.matches(':checked') || within(checkbox.closest('label')!).queryByText('Tones')) continue
      await user.click(checkbox)
    }
    await startSession(user)

    expect(screen.getByRole('heading', { name: 'Which tones are right?' })).toBeInTheDocument()
    expect(loadSettings(storage).exerciseTypes).toEqual(['tone-choice'])
  })

  it('the last type checked cannot be unchecked', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, exerciseTypes: ['writing'] }, storage)
    renderWithProviders(<PracticePage />, { storage })

    expect(screen.getByRole('checkbox', { name: /^Writing/ })).toBeDisabled()
  })

  it('with writing alone, writes the items that can be written', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, exerciseTypes: ['writing'] }, storage)
    let progress = recordAnswer(createEmptyProgress(), 'word:谢谢', true, new Date())
    progress = recordAnswer(progress, 'word:你好', false, new Date())
    saveProgress(progress, storage)
    renderWithProviders(<PracticePage />, { storage })
    await startSession(user)

    // Only 谢谢 was read right: 你好 can't be written yet
    expect(screen.getByText(/^Card 1 of 1$/)).toBeInTheDocument()
    expect(screen.getByText('New character: trace it')).toBeInTheDocument()
  })

  it('with writing alone and nothing that can be written, says so and lets you pick again', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, exerciseTypes: ['writing'] }, storage)
    renderWithProviders(<PracticePage />, { storage })
    await startSession(user)

    expect(screen.getByText(/^Nothing to write here yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose other exercises' }))
    await user.click(screen.getByRole('checkbox', { name: /^Meaning/ }))
    await startSession(user)
    expect(screen.getByRole('heading', { name: 'What does it mean?' })).toBeInTheDocument()
  })

  it('an empty session says so without asking', () => {
    renderWithProviders(<PracticePage />, { path: '/study/practice?focus=difficult' })
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })
})

describe('PracticePage: one exercise type', () => {
  it('?type= only gives exercises of that type, whatever the Settings say', async () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, exerciseTypes: ['flashcard'] }, storage)
    saveProgress(introduceItem(createEmptyProgress(), 'word:老师', new Date()), storage)
    renderWithProviders(<PracticePage />, { storage, path: '/study/practice?type=tone-choice' })

    expect(screen.getByRole('heading', { name: 'Tones practice' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Which tones are right?' })).toBeInTheDocument()
  })

  it('?type= only asks about what the user is studying, never new words', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    let progress = createEmptyProgress()
    for (const itemId of ['word:学生', 'word:谢谢', 'word:老师'] as const) progress = introduceItem(progress, itemId, new Date())
    saveProgress(progress, storage)
    renderWithProviders(<PracticePage />, { storage, path: '/study/practice?type=meaning-choice' })

    expect(await screen.findByText(/^Card 1 of 3$/)).toBeInTheDocument()
    await finishSession(user)
    expect(Object.keys(loadProgress(storage).items).sort()).toEqual(['word:学生', 'word:老师', 'word:谢谢'])
  })

  it('?type= without anything studied says so', async () => {
    renderWithProviders(<PracticePage />, { path: '/study/practice?type=meaning-choice' })
    expect(await screen.findByText(/Nothing to practice yet/)).toBeInTheDocument()
  })

  it('an unknown type is not found', () => {
    renderWithProviders(<PracticePage />, { path: '/study/practice?type=karaoke' })
    expect(screen.queryByText(/^Card 1/)).not.toBeInTheDocument()
  })
})

describe('PracticePage: difficult items', () => {
  it('only asks about the difficult items', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    let progress = createEmptyProgress()
    for (const itemId of ['char:你', 'word:谢谢'] as const) {
      for (let i = 0; i < 3; i++) progress = recordAnswer(progress, itemId, false, new Date())
    }
    progress = recordAnswer(progress, 'word:你好', false, new Date())
    saveProgress(progress, storage)
    renderWithProviders(<PracticePage />, { storage, path: '/study/practice?focus=difficult' })

    expect(screen.getByRole('heading', { name: 'Difficult items' })).toBeInTheDocument()
    await startSession(user)
    expect(screen.getByText(/^Card 1 of 2$/)).toBeInTheDocument()
    await finishSession(user)

    // Only the two difficult items got new answers; 你好 kept its single one
    const saved = loadProgress(storage).items
    expect(saved['word:你好']?.timesSeen).toBe(1)
    expect(saved['char:你']!.timesSeen).toBeGreaterThan(3)
    expect(saved['word:谢谢']!.timesSeen).toBeGreaterThan(3)
  })

  it('with no difficult items says so', () => {
    renderWithProviders(<PracticePage />, { path: '/study/practice?focus=difficult' })
    expect(screen.getByText('You have no difficult items right now.')).toBeInTheDocument()
  })
})

describe('PracticePage: practice writing', () => {
  it('only asks to write items already read right', () => {
    const storage = memoryStorage()
    let progress = recordAnswer(createEmptyProgress(), 'word:谢谢', true, new Date())
    progress = recordAnswer(progress, 'word:你好', false, new Date())
    saveProgress(progress, storage)
    renderWithProviders(<PracticePage />, { storage, path: '/study/practice?focus=writing' })

    expect(screen.getByRole('heading', { name: 'Practice writing' })).toBeInTheDocument()
    expect(screen.getByText(/^Card 1 of 1$/)).toBeInTheDocument()
    // 谢 was never written: it is traced first
    expect(screen.getByText('New character: trace it')).toBeInTheDocument()
  })

  it('with nothing to write says so', () => {
    renderWithProviders(<PracticePage />, { path: '/study/practice?focus=writing' })
    expect(screen.getByText(/^Nothing to write yet/)).toBeInTheDocument()
  })
})

describe('PracticePage: Learn and Study of a set', () => {
  const colorIds = topicDefinitions.find((topic) => topic.id === 'colors')!.words.map((word) => `word:${word}` as const)
  const now = new Date()

  beforeEach(() => {
    // Entry pages request strokes and sentences when opened; there is no server here
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderSession(query: string, progress: ProgressData = createEmptyProgress()) {
    const storage = memoryStorage()
    saveProgress(progress, storage)
    renderWithProviders(<PracticePage />, { storage, path: `/study/practice?set=topic-colors&${query}` })
    return storage
  }

  /** The large hanzi of the entry Learn introduces. */
  function currentLearnHanzi() {
    return document.querySelector('.text-7xl')?.textContent
  }

  it('Learn introduces only unlearned set items and saves the confirmed ones', async () => {
    const user = userEvent.setup()
    const alreadyLearned = introduceItem(createEmptyProgress(), colorIds[0]!, now)
    const storage = renderSession('mode=learn', alreadyLearned)

    expect(screen.getByText('Learn new vocabulary')).toBeInTheDocument()
    expect(screen.getByText('Item 1 of 6')).toBeInTheDocument()
    const shown: string[] = []
    for (const action of ["I've learned it", "Don't learn", "I've learned it"]) {
      shown.push(currentLearnHanzi()!)
      await user.click(screen.getByRole('button', { name: action }))
    }

    expect(shown).not.toContain(colorIds[0]!.slice('word:'.length))
    const progress = loadProgress(storage)
    expect(Object.keys(progress.items).toSorted()).toEqual(
      [colorIds[0], `word:${shown[0]}`, `word:${shown[2]}`].toSorted(),
    )
    // Learning is not answering: it does not add to activity or the streak
    expect(progress.activity).toEqual({})
    expect(Object.keys(loadMyStudies(storage).lastStudied)).toEqual(['topic-colors'])
  })

  it('Learn lets you mark an item as already mastered: it is not due for review for a long time', async () => {
    const user = userEvent.setup()
    const storage = renderSession('mode=learn')

    const known = currentLearnHanzi()!
    await user.click(screen.getByRole('button', { name: 'I already know it' }))

    const item = loadProgress(storage).items[`word:${known}`]
    expect(getItemStatus(item)).toBe('mastered')
    expect(isDue(item, new Date())).toBe(false)
  })

  it("Learn's \"Don't learn\" leaves the item out of later Learn sessions, without learning it", async () => {
    const user = userEvent.setup()
    const storage = renderSession('mode=learn')

    const total = Number(screen.getByText(/^Item 1 of/).textContent!.split(' of ')[1])
    const excluded = currentLearnHanzi()!
    await user.click(screen.getByRole('button', { name: "Don't learn" }))

    const progress = loadProgress(storage)
    expect(progress.items[`word:${excluded}`]).toBeUndefined()
    expect(isExcluded(progress, `word:${excluded}`)).toBe(true)

    // A new Learn session has one item less
    cleanup()
    renderSession('mode=learn', progress)
    expect(screen.getByText(`Item 1 of ${total - 1}`)).toBeInTheDocument()
  })

  it("Learn also works with the keys 1 (don't learn), 2 (already know it) and 3 (learned)", async () => {
    const user = userEvent.setup()
    const storage = renderSession('mode=learn')

    const skipped = currentLearnHanzi()!
    await user.keyboard('1')
    const known = currentLearnHanzi()!
    await user.keyboard('2')
    const learned = currentLearnHanzi()!
    await user.keyboard('3')

    const { items, excluded } = loadProgress(storage)
    expect(items[`word:${skipped}`]).toBeUndefined()
    expect(excluded[`word:${skipped}`]?.excluded).toBe(true)
    expect(getItemStatus(items[`word:${known}`])).toBe('mastered')
    expect(getItemStatus(items[`word:${learned}`])).toBe('learning')
  })

  it('Learn with nothing new says so and does not switch to Study on its own', () => {
    renderSession('mode=learn', colorIds.reduce((result, itemId) => introduceItem(result, itemId, now), createEmptyProgress()))

    expect(screen.getByText("You're caught up. There are no new words to learn in this set.")).toBeInTheDocument()
    expect(screen.queryByText(/^Item 1/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Study' })).toHaveAttribute('href', '/study/practice?set=topic-colors&mode=study')
  })

  it('Study only asks about learned items, never a new one', async () => {
    const user = userEvent.setup()
    const learned = colorIds.slice(0, 3)
    const storage = renderSession('mode=study', learned.reduce((result, itemId) => introduceItem(result, itemId, now), createEmptyProgress()))

    expect(screen.getByText("Review vocabulary you've already learned")).toBeInTheDocument()
    await startSession(user)
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
    await finishSession(user)

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    expect(Object.keys(loadProgress(storage).items).toSorted()).toEqual(learned.toSorted())
  })

  it('Study with nothing learned says so and offers to start learning', () => {
    renderSession('mode=study')

    expect(screen.getByText("You haven't learned any words from this set yet.")).toBeInTheDocument()
    expect(screen.queryByText(/^Card 1/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start learning' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-colors&mode=learn',
    )
  })

  it('Study with everything up to date offers to review anyway, and that review only uses learned items', () => {
    const upToDate = recordAnswer(createEmptyProgress(), colorIds[0]!, true, now) // due tomorrow
    renderSession('mode=study', upToDate)

    expect(screen.getByText('All learned items are currently up to date.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review learned vocabulary anyway' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-colors&mode=study&scope=all',
    )
  })

  it('"Review anyway" reviews learned items even if not due', async () => {
    const user = userEvent.setup()
    renderSession('mode=study&scope=all', recordAnswer(createEmptyProgress(), colorIds[0]!, true, now))
    await startSession(user)

    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument()
  })

  /** Opens the dictionary, searches and closes: returns the page text before and after. */
  async function openAndCloseDictionary(user: ReturnType<typeof userEvent.setup>) {
    const before = document.body.textContent
    await user.click(screen.getByRole('button', { name: 'Dictionary' }))
    const panel = screen.getByRole('dialog', { name: 'Dictionary' })
    await user.type(within(panel).getByRole('searchbox', { name: 'Search' }), 'red')
    expect(await within(panel).findByRole('list', { name: 'Results' })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    return { before, after: document.body.textContent }
  }

  it('in Learn the dictionary works and after closing it the same item and session type remain', async () => {
    const user = userEvent.setup()
    renderSession('mode=learn')
    await user.click(screen.getByRole('button', { name: "I've learned it" }))
    const hanzi = currentLearnHanzi()

    const { before, after } = await openAndCloseDictionary(user)

    expect(after).toBe(before)
    expect(screen.getByText('Learn new vocabulary')).toBeInTheDocument()
    expect(screen.getByText('Item 2 of 7')).toBeInTheDocument()
    expect(currentLearnHanzi()).toBe(hanzi)
  })

  it('in Study the dictionary works and after closing it the same card and session type remain', async () => {
    const user = userEvent.setup()
    renderSession('mode=study', colorIds.reduce((result, itemId) => introduceItem(result, itemId, now), createEmptyProgress()))
    await startSession(user)
    await answerCurrentExercise(user)

    const { before, after } = await openAndCloseDictionary(user)

    expect(after).toBe(before)
    expect(screen.getByText("Review vocabulary you've already learned")).toBeInTheDocument()
    expect(screen.getByText(/^Card 2 of \d+$/)).toBeInTheDocument()
  })
})
