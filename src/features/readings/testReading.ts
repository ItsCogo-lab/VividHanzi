import { parseReadings } from './reading.ts'
import type { ReadingsStore } from './readingsStore.ts'
import type { Reading, ReadingSummary } from './types.ts'

/** A short reading written for the tests. */
export const TEST_READING_JSON = JSON.stringify({
  book: 'Test Book',
  level: 4,
  unit: '2',
  position: 1,
  title: { words: [['我', 'wǒ', 'I'], ['喜欢', 'xǐ huan', 'to like'], ['“'], ['快', 'kuài', 'fast'], ['”']], translation: 'I like "fast"' },
  paragraphs: [
    [
      {
        words: [['我', 'wǒ', 'I'], ['很', 'hěn', 'very'], ['忙', 'máng', 'busy'], ['。']],
        translation: 'I am very busy.',
      },
      {
        words: [['快点儿', 'kuài diǎn r', 'hurry up'], ['！']],
        translation: 'Hurry up!',
      },
    ],
    {
      speaker: { words: [['老师', 'lǎo shī', 'teacher']], translation: 'Teacher' },
      sentences: [{ words: [['价格', 'jià gé', 'price'], ['怎么样', 'zěn me yàng', 'how'], ['？']], translation: 'How is the price?' }],
    },
  ],
  questions: [{ words: [['你', 'nǐ', 'you'], ['忙', 'máng', 'busy'], ['吗', 'ma', '(question particle)'], ['？']], translation: 'Are you busy?' }],
})

/** A store kept in memory, as Supabase would keep it. */
export function createMemoryReadings(): ReadingsStore & { rows: Map<string, Reading> } {
  const rows = new Map<string, Reading>()
  const title = (reading: Reading) => reading.title.words.map((word) => word.text).join('')
  return {
    rows,
    list: async () =>
      [...rows].map(([id, reading]): ReadingSummary => ({
        id,
        book: reading.book,
        unit: reading.unit,
        ...(reading.position !== undefined && { position: reading.position }),
        title: title(reading),
        titleTranslation: reading.title.translation,
      })),
    // Like Supabase: the saved reading comes back as JSON and is parsed again
    get: async (id) => {
      const reading = rows.get(id)
      return reading ? (parseReadings(JSON.stringify(reading))[0] ?? null) : null
    },
    save: async (readings) => {
      for (const reading of readings) {
        const id = [...rows].find(([, row]) => row.book === reading.book && row.unit === reading.unit && title(row) === title(reading))?.[0]
        rows.set(id ?? `reading-${rows.size + 1}`, reading)
      }
    },
    remove: async (id) => {
      rows.delete(id)
    },
  }
}
