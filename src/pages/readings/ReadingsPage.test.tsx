import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../../app/AppRoutes.tsx'
import { parseReadings } from '../../features/readings/reading.ts'
import { createMemoryReadings, TEST_READING_JSON } from '../../features/readings/testReading.ts'
import { ReadingsStoreContext } from '../../features/readings/useReadings.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'

describe('Readings', () => {
  it('is not there for other accounts', async () => {
    renderWithProviders(<AppRoutes />, { path: '/readings' })
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Readings/ })).not.toBeInTheDocument()
  })

  it('adds a reading and reads it word by word', async () => {
    const user = userEvent.setup()
    const store = createMemoryReadings()
    renderWithProviders(
      <ReadingsStoreContext value={store}>
        <AppRoutes />
      </ReadingsStoreContext>,
      { path: '/readings' },
    )
    expect(await screen.findByText('No readings yet. Add one below.')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Or paste the JSON'))
    await user.paste(TEST_READING_JSON)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Added 1 reading.')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Test Book' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /我喜欢“快”/ }))

    expect(await screen.findByText(/Tap a word/)).toBeInTheDocument()
    // Underline color by HSK level
    expect(screen.getByRole('button', { name: /很/ })).toHaveAttribute('data-hsk', '1')
    expect(screen.getByRole('button', { name: /价格/ })).toHaveAttribute('data-hsk', '4')
    await user.click(screen.getByRole('button', { name: /很/ }))
    expect(screen.getByText('I am very busy.')).toBeInTheDocument()
    expect(screen.getByText('very')).toBeInTheDocument()
    expect(screen.getAllByText('HSK 1')).toHaveLength(2) // legend and badge
    expect(screen.getByRole('button', { name: /很/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.queryByText('I am very busy.')).not.toBeInTheDocument()

    // An erhua word: its characters, without the 儿
    await user.click(screen.getByRole('button', { name: /快点儿/ }))
    const details = screen.getByText('hurry up').parentElement!.parentElement!
    expect(within(details).getByText('diǎn')).toBeInTheDocument()
    expect(within(details).getAllByRole('listitem')).toHaveLength(2)

    // A dialogue line and the questions
    expect(screen.getByRole('button', { name: /老师/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy questions' })).toBeInTheDocument()
  })

  it('adds a word to learn to the book set of its HSK level', async () => {
    const user = userEvent.setup()
    const store = createMemoryReadings()
    await store.save(parseReadings(TEST_READING_JSON))
    renderWithProviders(
      <ReadingsStoreContext value={store}>
        <AppRoutes />
      </ReadingsStoreContext>,
      { path: '/readings/reading-1' },
    )
    await user.click(await screen.findByRole('button', { name: /价格/ }))
    await user.click(screen.getByRole('button', { name: '+ Learn: add to Book words · HSK 4' }))
    expect(screen.getByRole('button', { name: '✓ In Book words · HSK 4 (remove)' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Study' }))
    const [setLink] = await screen.findAllByRole('link', { name: /Book words · HSK 4/ })
    await user.click(setLink!)
    expect((await screen.findAllByText('price')).length).toBeGreaterThan(0)
  })
})
