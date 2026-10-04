import { en, type MessageKey } from './en.ts'
import { es } from './es.ts'

export type { MessageKey }

export type UiLocale = 'en' | 'es'

const messages: Record<UiLocale, Record<MessageKey, string>> = { en, es }

/**
 * Active UI language. Fixed for now; once there is a language picker in
 * Settings, this value will come from the user's preferences.
 */
export const ACTIVE_UI_LOCALE: UiLocale = 'en'

/**
 * Returns the UI text for a key in the active language.
 * Placeholders in braces are filled from `params`:
 * t('practice.progress', { current: 3, total: 10 }) → "Card 3 of 10".
 */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[ACTIVE_UI_LOCALE][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  )
}

/**
 * Text with a number that changes between singular and plural:
 * tCount(1, 'sets.wordCountOne', 'sets.wordCount') → "1 word"; with 3 → "3 words".
 */
export function tCount(count: number, one: MessageKey, other: MessageKey): string {
  return t(count === 1 ? one : other, { count })
}

/** Percentage in the active language's format: 0.75 → "75%". */
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(ACTIVE_UI_LOCALE, { style: 'percent' }).format(ratio)
}

/** Short day in the active language: "Mon, Sep 28". */
export function formatShortDay(date: Date): string {
  return new Intl.DateTimeFormat(ACTIVE_UI_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

/** Date in the active language's medium format: "Sep 28, 2026". */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(ACTIVE_UI_LOCALE, { dateStyle: 'medium' }).format(date)
}

/** Short month in the active language: "Sep". */
export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat(ACTIVE_UI_LOCALE, { month: 'short' }).format(date)
}

/** Day and month in the active language: "Sep 28". */
export function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat(ACTIVE_UI_LOCALE, { month: 'short', day: 'numeric' }).format(date)
}
