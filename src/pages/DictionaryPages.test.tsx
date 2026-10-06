import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../app/AppRoutes.tsx'
import { allCharacters, allWords } from '../data/index.ts'
import { createEmptyProgress, isExcluded, recordAnswer, setItemExcluded } from '../features/progress/progress.ts'
import { loadProgress, saveProgress } from '../features/progress/storage.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'

describe('DictionaryPage', () => {
  it('without a search lists the whole dictionary in pages', () => {
    renderWithProviders(<AppRoutes />, { path: '/dictionary' })

    expect(screen.getByText(`Showing 50 of ${allCharacters.length + allWords.length}`)).toBeInTheDocument()
  })

  it('searches by hanzi, pinyin or English and sorts exact matches first', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { path: '/dictionary' })

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), '果')
    const results = within(await screen.findByRole('list', { name: 'Results' })).getAllByRole('link')
    // First the character 果, then the words starting with it, then the ones containing it
    expect(results[0]).toHaveAttribute('href', '/characters/%E6%9E%9C')
    expect(results.map((link) => link.getAttribute('href'))).toContain('/vocabulary/%E8%8B%B9%E6%9E%9C') // 苹果

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'xiexie')
    expect(await screen.findByRole('link', { name: /谢谢/ })).toHaveAttribute('href', '/vocabulary/%E8%B0%A2%E8%B0%A2')

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'apple')
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Results' })).getAllByRole('link')[0]).toHaveTextContent('苹果'),
    )
  })

  it('keeps the search in the URL and filters by kind', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { path: '/dictionary?q=hao&kind=character' })

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('hao')
    expect(screen.getByRole('radio', { name: 'Characters' })).toBeChecked()
    expect(within(screen.getByRole('list', { name: 'Results' })).getAllByRole('link').every((link) => link.textContent?.includes('Character'))).toBe(true)

    await user.click(screen.getByRole('radio', { name: 'Words' }))
    expect(within(screen.getByRole('list', { name: 'Results' })).getAllByRole('link').every((link) => link.textContent?.includes('Word'))).toBe(true)
  })

  it('the search box follows the URL when it changes through a link', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { path: '/dictionary?q=hao' })

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'ren')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('haoren')
    await user.click(screen.getAllByRole('link', { name: /Dictionary/ })[0]!)

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })

  it('says so when there are no results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { path: '/dictionary' })

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzz')

    expect(await screen.findByText(/No matches/)).toBeInTheDocument()
  })

  it('shows the tone color legend', () => {
    renderWithProviders(<AppRoutes />, { path: '/dictionary' })

    expect(screen.getByRole('heading', { name: 'Tone colors' })).toBeInTheDocument()
  })

  it('the old /vocabulary and /characters URLs lead to the dictionary', () => {
    renderWithProviders(<AppRoutes />, { path: '/characters' })

    expect(screen.getByRole('heading', { level: 1, name: 'Dictionary' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Characters' })).toBeChecked()
  })
})

describe('EntryDetailPage', () => {
  it('shows a word entry with its characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { path: '/vocabulary/谢谢' })

    expect(screen.getByRole('heading', { level: 1, name: '谢谢' })).toHaveAttribute('lang', 'zh-Hans')
    expect(screen.getByText('xiè xie')).toBeInTheDocument()
    expect(screen.getByText(/Not studied yet/)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /谢/ }))

    expect(screen.getByRole('heading', { level: 1, name: '谢' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Appears in' })).toBeInTheDocument()
  })

  it('shows which sets the item is in (it can be in several)', () => {
    renderWithProviders(<AppRoutes />, { path: '/vocabulary/苹果' })

    const sets = screen.getByRole('heading', { name: 'In study sets' }).nextElementSibling as HTMLElement
    expect(within(sets).getByRole('link', { name: 'HSK 1' })).toHaveAttribute('href', '/study/sets/hsk-1')
    expect(within(sets).getByRole('link', { name: 'Food & drink' })).toHaveAttribute('href', '/study/sets/topic-food')
  })

  it('shows the item\'s progress', () => {
    const storage = memoryStorage()
    saveProgress(recordAnswer(createEmptyProgress(), 'char:好', false, new Date()), storage)
    renderWithProviders(<AppRoutes />, { path: '/characters/好', storage })

    expect(screen.getByText('Times seen').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Mistakes').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Next review').nextElementSibling).toHaveTextContent('Now')
  })

  it('a word the user chose not to learn says so and can be brought back to Learn', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveProgress(setItemExcluded(createEmptyProgress(), 'word:苹果', true, new Date()), storage)
    renderWithProviders(<AppRoutes />, { path: '/vocabulary/苹果', storage })

    expect(screen.getByText("You chose not to learn this, so Learn won't offer it.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Learn it after all' }))

    expect(isExcluded(loadProgress(storage), 'word:苹果')).toBe(false)
    expect(screen.getByText('Not studied yet. It will come up in your practice sessions.')).toBeInTheDocument()
  })

  it('a nonexistent entry shows "Page not found" after looking it up in the full dictionary', async () => {
    renderWithProviders(<AppRoutes />, { path: '/characters/不存在' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })
})
