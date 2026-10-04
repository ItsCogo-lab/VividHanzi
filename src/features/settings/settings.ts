import { isRecord, readJson, writeJson, type KeyValueStorage } from '../../lib/storage.ts'
import type { HskLevel } from '../dictionary/types.ts'
import { DEFAULT_SESSION_SIZE } from '../practice/session.ts'
import { HSK_LEVELS } from '../studySets/studySets.ts'
import { isThemePreference, type ThemePreference } from './theme.ts'

/** Session sizes that can be chosen in Settings. */
export const SESSION_SIZE_OPTIONS = [5, 10, 20] as const

export type SessionSize = (typeof SESSION_SIZE_OPTIONS)[number]

/** Daily goals (answers per day) that can be chosen in Settings. */
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const

export type DailyGoal = (typeof DAILY_GOAL_OPTIONS)[number]

export interface Settings {
  sessionSize: SessionSize
  /** Answers per day the user aims for. */
  dailyGoal: DailyGoal
  /** Color characters by the tone of their pronunciation. */
  toneColors: boolean
  /** Also show pinyin with tone numbers ("ni3 hao3"). */
  toneNumbers: boolean
  /** Include writing exercises in Study sessions. */
  writingExercises: boolean
  /** Color theme: system, light or dark. */
  theme: ThemePreference
  /** HSK level the user says they have (see applyHskLevel), or `null` if they haven't given one. */
  hskLevel: HskLevel | null
}

export const DEFAULT_SETTINGS: Settings = {
  sessionSize: DEFAULT_SESSION_SIZE,
  dailyGoal: 20,
  toneColors: true,
  toneNumbers: false,
  writingExercises: true,
  theme: 'system',
  hskLevel: null,
}

/** The index.html script reads the theme from this same key before the app loads. */
export const SETTINGS_STORAGE_KEY = 'hanzivocab.settings'
const CURRENT_VERSION = 1

export function saveSettings(settings: Settings, storage?: KeyValueStorage): boolean {
  return writeJson(SETTINGS_STORAGE_KEY, { version: CURRENT_VERSION, ...settings }, storage)
}

/**
 * Loads settings; any missing or invalid value takes its default. That way
 * settings saved before an option existed keep working without a version
 * change.
 */
export function loadSettings(storage?: KeyValueStorage): Settings {
  const saved = readJson(SETTINGS_STORAGE_KEY, storage)
  if (!isRecord(saved) || saved.version !== CURRENT_VERSION) return DEFAULT_SETTINGS
  return {
    sessionSize: isSessionSize(saved.sessionSize) ? saved.sessionSize : DEFAULT_SETTINGS.sessionSize,
    dailyGoal: DAILY_GOAL_OPTIONS.find((goal) => goal === saved.dailyGoal) ?? DEFAULT_SETTINGS.dailyGoal,
    toneColors: typeof saved.toneColors === 'boolean' ? saved.toneColors : DEFAULT_SETTINGS.toneColors,
    toneNumbers: typeof saved.toneNumbers === 'boolean' ? saved.toneNumbers : DEFAULT_SETTINGS.toneNumbers,
    writingExercises:
      typeof saved.writingExercises === 'boolean' ? saved.writingExercises : DEFAULT_SETTINGS.writingExercises,
    theme: isThemePreference(saved.theme) ? saved.theme : DEFAULT_SETTINGS.theme,
    hskLevel: HSK_LEVELS.find((level) => level === saved.hskLevel) ?? DEFAULT_SETTINGS.hskLevel,
  }
}

export function isSessionSize(value: unknown): value is SessionSize {
  return SESSION_SIZE_OPTIONS.some((option) => option === value)
}
