import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../app/AppProviders.tsx'
import { AppRoutes } from '../app/AppRoutes.tsx'
import { addItem, createCustomSet, setMeaning } from '../features/customSets/customSets.ts'
import { annotateSentence } from '../features/customSets/pinyinEngine.ts'
import { getDatasetReadings } from '../features/customSets/sentenceProcessing.ts'
import { addSentence, createSentence } from '../features/customSets/sentences.ts'
import { saveCustomSets } from '../features/customSets/storage.ts'
import { hskDictionary } from '../features/dictionary/hskDictionary.ts'
import { getStudyItem } from '../features/dictionary/studyItem.ts'
import { loadProgress } from '../features/progress/storage.ts'
import type { KeyValueStorage } from '../lib/storage.ts'
import { answerCurrentExercise } from '../test/answerExercise.ts'
import { createChunkLoader } from '../test/dictionaryChunks.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { paragraphWithText } from '../test/text.ts'

const now = new Date(2026, 8, 28)
const ITEM_IDS = ['word:苹果', 'word:机场', 'word:学习'] as const

/** The final verification set: "My Chinese" with 苹果, 机场 and 学习, a meaning and a sentence. */
function savedMyChinese(): KeyValueStorage {
  let set = createCustomSet({ name: 'My Chinese', description: '' }, 'custom-mine', now)
  for (const itemId of ITEM_IDS) set = addItem(set, itemId)
  set = setMeaning(set, 'word:机场', 'airport when travelling')
  const chinese = '我每天学习中文。'
  set = addSentence(
    set,
    createSentence({ chinese, tokens: annotateSentence(chinese, getDatasetReadings), itemId: 'word:学习' }, 'sentence-1', now),
  )
  const storage = memoryStorage()
  saveCustomSets([set], storage)
  return storage
}

function renderAt(path: string, storage: KeyValueStorage) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders storage={storage} loadChunk={createChunkLoader()}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

/** Answers until the session ends: a missed choice question comes back at the end. */
async function finishSession(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 50 && !screen.queryByRole('heading', { name: 'Session complete' }); i++) {
    await answerCurrentExercise(user)
  }
}

describe('Learn and Study with a custom set', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('the set page offers Learn with its 3 items and an empty Study', () => {
    renderAt('/study/sets/custom-mine', savedMyChinese())

    expect(screen.getByRole('heading', { level: 1, name: 'My Chinese' })).toBeInTheDocument()
    expect(screen.getByText('3 new items to learn')).toBeInTheDocument()
    expect(screen.getByText("You haven't learned any words from this set yet.")).toBeInTheDocument()
  })

  it('learns, reviews and reviews anyway, always with the set items', async () => {
    const user = userEvent.setup()
    const storage = savedMyChinese()
    renderAt('/study/practice?set=custom-mine&mode=learn', storage)

    const shown: string[] = []
    for (let i = 1; i <= 3; i++) {
      expect(screen.getByText(`Item ${i} of 3`)).toBeInTheDocument()
      shown.push(document.querySelector('.text-7xl')!.textContent!)
      // The user's notes accompany the official entry
      if (shown.at(-1) === '学习') {
        expect(screen.getByRole('heading', { name: 'My notes in My Chinese' })).toBeInTheDocument()
        expect(screen.getByText(paragraphWithText('wǒ měi tiān xué xí zhōng wén。'))).toBeInTheDocument()
      }
      await user.click(screen.getByRole('button', { name: "I've learned it" }))
    }
    expect(shown.toSorted()).toEqual(['学习', '机场', '苹果'].toSorted())
    expect(Object.keys(loadProgress(storage).items).toSorted()).toEqual([...ITEM_IDS].toSorted())

    // Study: what was learned is due for review today
    await user.click(screen.getByRole('link', { name: 'Review them now' }))
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
    await finishSession(user)
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    expect(Object.keys(loadProgress(storage).items)).toHaveLength(3)
  })

  it('the dictionary works inside the custom set session', async () => {
    const user = userEvent.setup()
    renderAt('/study/practice?set=custom-mine&mode=learn', savedMyChinese())

    await user.click(screen.getByRole('button', { name: 'Dictionary' }))
    const panel = screen.getByRole('dialog', { name: 'Dictionary' })
    await user.type(within(panel).getByRole('searchbox', { name: 'Search' }), 'airport')
    expect(await within(panel).findByRole('list', { name: 'Results' })).toHaveTextContent('机场')
    await user.click(within(panel).getByRole('button', { name: 'Close' }))

    expect(screen.getByText('Item 1 of 3')).toBeInTheDocument()
  })

  it('Learn and Study work with non-HSK words', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveCustomSets([addItem(createCustomSet({ name: 'Zoo', description: '' }, 'custom-zoo', now), 'word:企鹅')], storage)
    renderAt('/study/practice?set=custom-zoo&mode=learn', storage)

    expect(await screen.findByText('Item 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('penguin')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "I've learned it" }))
    expect(Object.keys(loadProgress(storage).items)).toEqual(['word:企鹅'])

    await user.click(screen.getByRole('link', { name: 'Review them now' }))
    expect(await screen.findByText('Card 1 of 1')).toBeInTheDocument()
    await finishSession(user)
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
  })

  it('the dictionary entry lists the custom set and its official content does not change', () => {
    renderAt(`/vocabulary/${encodeURIComponent('机场')}`, savedMyChinese())

    const inSets = screen.getByRole('heading', { name: 'In study sets' }).parentElement!
    expect(within(inSets).getByRole('link', { name: 'My Chinese' })).toBeInTheDocument()
    // Without ?set=, the entry is the dictionary one without the user's notes
    expect(screen.queryByText('airport when travelling')).not.toBeInTheDocument()
    expect(getStudyItem(hskDictionary, 'word:机场')?.entry.meanings.en).not.toContain('airport when travelling')
  })
})
