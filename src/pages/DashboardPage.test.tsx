import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { hskWordItems } from '../features/dictionary/hskDictionary.ts'
import { createEmptyProgress, recordAnswer } from '../features/progress/progress.ts'
import { saveProgress } from '../features/progress/storage.ts'
import type { ProgressData } from '../features/progress/types.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { DashboardPage } from './DashboardPage.tsx'

function renderDashboard(progress: ProgressData = createEmptyProgress()) {
  const storage = memoryStorage()
  saveProgress(progress, storage)
  renderWithProviders(<DashboardPage />, { storage })
}

/** Value of a summary figure, found by its label. */
function getStat(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

describe('DashboardPage', () => {
  it('welcomes a new user with everything at zero', () => {
    renderDashboard()

    expect(screen.getByText(/start your first session/)).toBeInTheDocument()
    expect(getStat('Due for review')).toBe('0')
    expect(getStat('Day streak')).toBe('0')
    expect(getStat('Studied')).toBe(`0 of ${hskWordItems.length}`)
    expect(screen.getByRole('link', { name: 'Start session' })).toHaveAttribute('href', '/study/practice')
  })

  it('shows due reviews, what was studied and the streak', () => {
    const now = new Date()
    let progress = recordAnswer(createEmptyProgress(), 'word:朋友', false, now) // due today
    progress = recordAnswer(progress, 'word:谢谢', true, now) // due tomorrow

    renderDashboard(progress)

    expect(screen.getByText(/ready for review/)).toBeInTheDocument()
    expect(getStat('Due for review')).toBe('1')
    expect(getStat('Studied')).toMatch(/^2 of/)
    expect(getStat('Day streak')).toBe('1')
    // Characters are learned through words: 朋友 and 谢谢 give 朋, 友 and 谢
    expect(screen.getByRole('progressbar', { name: /^Characters: 3 of \d+ studied/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^Words: 2 of 1196 studied/ })).toBeInTheDocument()
  })

  it('with no due reviews suggests learning new items', () => {
    renderDashboard(recordAnswer(createEmptyProgress(), 'word:朋友', true, new Date()))

    expect(screen.getByText(/teach you new items/)).toBeInTheDocument()
  })

  it("shows how far today's answers are from the daily goal", () => {
    let progress = createEmptyProgress()
    for (let index = 0; index < 5; index++) progress = recordAnswer(progress, 'word:谢谢', true, new Date())
    renderDashboard(progress)

    expect(screen.getByRole('progressbar', { name: 'Daily goal: 5 of 20 answers' })).toBeInTheDocument()
    expect(screen.getByText(/15 more to reach it/)).toBeInTheDocument()
  })
})
