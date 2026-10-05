import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addDays } from '../lib/dates.ts'
import { createEmptyProgress, recordAnswer } from '../features/progress/progress.ts'
import { saveProgress } from '../features/progress/storage.ts'
import type { ProgressData } from '../features/progress/types.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { ProgressPage } from './ProgressPage.tsx'

function renderProgressPage(progress: ProgressData) {
  const storage = memoryStorage()
  saveProgress(progress, storage)
  renderWithProviders(<ProgressPage />, { storage })
}

function getStat(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

describe('ProgressPage', () => {
  it('with no answers invites the user to practice', () => {
    renderProgressPage(createEmptyProgress())

    expect(screen.getByText(/No statistics yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start session' })).toHaveAttribute('href', '/study/practice')
  })

  it('shows totals, streaks, recent activity and states', () => {
    const today = new Date()
    const yesterday = addDays(today, -1)
    let progress = createEmptyProgress()
    progress = recordAnswer(progress, 'char:你', false, yesterday)
    progress = recordAnswer(progress, 'char:你', false, today)
    progress = recordAnswer(progress, 'word:谢谢', true, today)
    progress = recordAnswer(progress, 'word:谢谢', true, today)

    renderProgressPage(progress)

    expect(getStat('Answers')).toBe('4')
    expect(getStat('Accuracy')).toBe('50%')
    expect(getStat('Day streak')).toBe('2')
    expect(getStat('Longest streak')).toBe('2')

    const lastDays = screen.getByRole('table', { name: 'Last 30 days' })
    // Header + 30 days; the last one is today, with 3 answers
    const rows = within(lastDays).getAllByRole('row')
    expect(rows).toHaveLength(31)
    expect(within(rows[30]!).getByRole('cell')).toHaveTextContent('3')

    expect(screen.getByRole('img', { name: /studied on 2 of the last/ })).toBeInTheDocument()

    const byStatus = screen.getByRole('table', { name: 'By status' })
    const wordsRow = within(byStatus).getByRole('rowheader', { name: 'Words' }).closest('tr')!
    // 1196 words: 1195 new, 1 learning (谢谢), 0 mastered
    expect(within(wordsRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['1195', '1', '0'])

    const bySkill = screen.getByRole('table', { name: 'By skill' })
    // recordAnswer without a skill (as before skills existed) counts for none
    const meaningRow = within(bySkill).getByRole('rowheader', { name: 'Meaning' }).closest('tr')!
    expect(within(meaningRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['0', '0', '–'])

    // 你 was missed only twice: it isn't difficult yet
    expect(screen.getByText(/^None right now/)).toBeInTheDocument()
  })

  it('lists the difficult items and offers a session with them', () => {
    let progress = createEmptyProgress()
    for (const correct of [false, false, false, true]) progress = recordAnswer(progress, 'char:你', correct, new Date())
    progress = recordAnswer(progress, 'word:谢谢', false, new Date())

    renderProgressPage(progress)

    const difficult = screen.getByRole('table', { name: 'Difficult items' })
    expect(within(difficult).getAllByRole('row')).toHaveLength(2)
    expect(within(difficult).getByText('你')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Practice difficult items (1)' })).toHaveAttribute(
      'href',
      '/study/practice?focus=difficult',
    )
  })
})
