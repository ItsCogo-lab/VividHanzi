import type { SupabaseClient } from '@supabase/supabase-js'
import { parseReadings, sentenceText } from './reading.ts'
import type { Reading, ReadingSummary } from './types.ts'

/** Where the readings are kept. Supabase in the app, a fake in tests. */
export interface ReadingsStore {
  list: () => Promise<ReadingSummary[]>
  get: (id: string) => Promise<Reading | null>
  /** Saves new readings; one with the same book, unit and title is replaced. */
  save: (readings: readonly Reading[]) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Table with one row per reading, readable only by its owner (see supabase/readings.sql). */
const TABLE = 'readings'

type SummaryRow = {
  id: string
  book: string
  unit: string
  position: number | null
  title: string
  title_translation: string
}

export function createSupabaseReadings(client: SupabaseClient, userId: string): ReadingsStore {
  return {
    list: async () => {
      const { data, error } = await client.from(TABLE).select('id, book, unit, position, title, title_translation')
      if (error) throw error
      return (data as SummaryRow[]).map((row) => ({
        id: row.id,
        book: row.book,
        unit: row.unit,
        ...(row.position !== null && { position: row.position }),
        title: row.title,
        titleTranslation: row.title_translation,
      }))
    },
    get: async (id) => {
      const { data, error } = await client.from(TABLE).select('content').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return null
      // Parsed again so a row edited by hand in Supabase can't break the page
      const [reading] = parseReadings(JSON.stringify((data as { content: unknown }).content))
      return reading ?? null
    },
    save: async (readings) => {
      const rows = readings.map((reading) => ({
        user_id: userId,
        book: reading.book,
        unit: reading.unit,
        position: reading.position ?? null,
        title: sentenceText(reading.title),
        title_translation: reading.title.translation,
        content: reading,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'user_id,book,unit,title' })
      if (error) throw error
    },
    remove: async (id) => {
      const { error } = await client.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
  }
}
