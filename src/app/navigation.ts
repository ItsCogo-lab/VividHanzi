import type { MessageKey } from '../i18n/index.ts'

export type NavigationItem = {
  path: string
  labelKey: MessageKey
  /** Decorative character used as an icon (not read by screen readers). */
  symbol: string
}

/**
 * Main navigation sections. Adding a new section = adding an entry here
 * and its <Route> in AppRoutes. Statistics and Settings are opened from
 * the profile.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { path: '/', labelKey: 'nav.dashboard', symbol: '首' },
  { path: '/study', labelKey: 'nav.study', symbol: '学' },
  { path: '/dictionary', labelKey: 'nav.dictionary', symbol: '典' },
  { path: '/profile', labelKey: 'nav.profile', symbol: '我' },
]

/** Readings: only for the account that has them (see features/readings), before Profile. */
export const READINGS_ITEM: NavigationItem = { path: '/readings', labelKey: 'nav.readings', symbol: '读' }
