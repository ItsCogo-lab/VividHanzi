import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { DEFAULT_SETTINGS, isSessionSize, loadSettings, saveSettings } from './settings.ts'

describe('saveSettings / loadSettings', () => {
  it('saves and loads settings', () => {
    const storage = memoryStorage()
    const settings = { sessionSize: 20, dailyGoal: 50, toneColors: false, toneNumbers: true, writingExercises: false, theme: 'dark', hskLevel: 3 } as const
    saveSettings(settings, storage)

    expect(loadSettings(storage)).toEqual(settings)
  })

  it('uses the defaults with no saved settings', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('settings saved before tones existed take the default values', () => {
    const storage = memoryStorage({ 'hanzivocab.settings': JSON.stringify({ version: 1, sessionSize: 5 }) })
    expect(loadSettings(storage)).toEqual({ sessionSize: 5, dailyGoal: 20, toneColors: true, toneNumbers: false, writingExercises: true, theme: 'system', hskLevel: null })
  })

  it('ignores invalid values', () => {
    const storage = memoryStorage({ 'hanzivocab.settings': JSON.stringify({ version: 1, sessionSize: 7, theme: 'sepia', hskLevel: 6 }) })
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('isSessionSize', () => {
  it('only accepts the available options', () => {
    expect(isSessionSize(5)).toBe(true)
    expect(isSessionSize(7)).toBe(false)
    expect(isSessionSize('10')).toBe(false)
  })
})
