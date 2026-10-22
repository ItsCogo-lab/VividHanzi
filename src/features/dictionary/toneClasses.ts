import type { Tone } from '../../lib/tones.ts'

/** Color class for each tone (--color-tone-* tokens in index.css). Written out in full so Tailwind finds them. */
export const TONE_TEXT_CLASSES: Record<Tone, string> = {
  1: 'text-tone-1',
  2: 'text-tone-2',
  3: 'text-tone-3',
  4: 'text-tone-4',
  5: 'text-tone-5',
}

/** Underline color for each tone, as in the readings. */
export const TONE_BORDER_CLASSES: Record<Tone, string> = {
  1: 'border-tone-1',
  2: 'border-tone-2',
  3: 'border-tone-3',
  4: 'border-tone-4',
  5: 'border-tone-5',
}
