import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createEmptyProgress, recordAnswer } from '../features/progress/progress.ts'
import { loadProgress, saveProgress } from '../features/progress/storage.ts'
import { loadSettings } from '../features/settings/settings.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { SettingsPage } from './SettingsPage.tsx'

describe('SettingsPage', () => {
  it('changes and saves the number of exercises per session', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<SettingsPage />, { storage })

    const sessionSize = screen.getByRole('group', { name: 'Exercises per session' })
    expect(within(sessionSize).getByRole('radio', { name: '10' })).toBeChecked()
    await user.click(within(sessionSize).getByRole('radio', { name: '20' }))

    expect(within(sessionSize).getByRole('radio', { name: '20' })).toBeChecked()
    expect(loadSettings(storage).sessionSize).toBe(20)
  })

  it('changes and saves the daily goal', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<SettingsPage />, { storage })

    const dailyGoal = screen.getByRole('group', { name: 'Daily goal (answers)' })
    expect(within(dailyGoal).getByRole('radio', { name: '20' })).toBeChecked()
    await user.click(within(dailyGoal).getByRole('radio', { name: '50' }))

    expect(loadSettings(storage).dailyGoal).toBe(50)
  })

  it('changes the theme and applies it to the page', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<SettingsPage />, { storage })

    // Without matchMedia (jsdom), "System" resolves to light
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(loadSettings(storage).theme).toBe('dark')
    delete document.documentElement.dataset.theme
  })

  it('turns tone colors and tone numbers on and off', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<SettingsPage />, { storage })

    const colors = screen.getByRole('checkbox', { name: /Color characters by tone/ })
    const numbers = screen.getByRole('checkbox', { name: /Show tone numbers/ })
    expect(colors).toBeChecked()
    expect(numbers).not.toBeChecked()

    await user.click(colors)
    await user.click(numbers)

    expect(loadSettings(storage)).toMatchObject({ toneColors: false, toneNumbers: true })
    // The legend also explains the tones with text, not only with color
    expect(screen.getByText('mā')).toBeInTheDocument()
  })

  it('resets progress only after confirming', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveProgress(recordAnswer(createEmptyProgress(), 'char:你', true, new Date()), storage)
    renderWithProviders(<SettingsPage />, { storage })

    await user.click(screen.getByRole('button', { name: 'Delete progress' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(loadProgress(storage).items['char:你']).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Delete progress' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete everything' }))

    expect(loadProgress(storage)).toEqual(createEmptyProgress())
    expect(screen.getByRole('status')).toHaveTextContent('Your progress has been deleted.')
  })

  it('credits the dataset sources and their licenses', () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('link', { name: 'CC-CEDICT' })).toHaveAttribute('href', 'https://cc-cedict.org/wiki/')
    for (const source of ['Unicode Unihan', 'Make Me a Hanzi', 'Hanzi Writer data', 'Tatoeba']) {
      expect(screen.getByRole('link', { name: source })).toBeInTheDocument()
    }
    expect(screen.getByText(/CC BY-SA 4\.0\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'clem109/hsk-vocabulary' })).toBeInTheDocument()
  })

  it('links to the source code', () => {
    renderWithProviders(<SettingsPage />)

    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/ItsCogo-lab/VividHanzi',
    )
  })

  it('chooses the exercise types, keeping at least one besides writing', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(<SettingsPage />, { storage })

    const types = screen.getByRole('group', { name: 'Exercise types in Study sessions' })
    await user.click(within(types).getByRole('checkbox', { name: /^Tones/ }))
    expect(loadSettings(storage).exerciseTypes).not.toContain('tone-choice')

    // Turn off every recognition type but Pinyin: its box can't be unchecked
    for (const name of [/^Flashcards/, /^Meaning/, /^Hanzi/, /^Match pinyin/, /^Match meanings/]) {
      await user.click(within(types).getByRole('checkbox', { name }))
    }
    expect(within(types).getByRole('checkbox', { name: /^Pinyin/ })).toBeDisabled()
    expect(loadSettings(storage).exerciseTypes).toEqual(['pinyin-choice', 'writing'])
  })
})
