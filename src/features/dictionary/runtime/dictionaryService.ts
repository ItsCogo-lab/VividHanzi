import { rankExamples } from '../exampleChoice.ts'
import { getExamplesFor, loadExampleSet, MAX_EXAMPLES_SHOWN } from '../examples.ts'
import type { DictionaryChunk } from '../fullDictionary.ts'
import { hskDictionary } from '../hskDictionary.ts'
import type { StrokeData } from '../strokeData.ts'
import { strokeFileName } from '../strokes.ts'
import type { StudyItem } from '../studyItem.ts'
import type { ExampleSentence } from '../types.ts'
import type { DictionaryCache } from './dictionaryCache.ts'
import { fetchChunk, fetchManifest } from './dictionarySource.ts'
import { fetchJson, SourceError } from './http.ts'
import type { ResourceService } from './resourceService.ts'
import { fetchStrokeData, parseStrokeData, STROKE_DATA_VERSION } from './strokeSource.ts'
import { fetchTatoebaExamples, TATOEBA_LICENSE } from './tatoebaSource.ts'

/**
 * Runtime dictionary service: the only thing components use to request
 * external data. Decides where each piece of data comes from, in
 * this order:
 *
 * 1. Up-to-date cache (IndexedDB).
 * 2. Expired cache (refreshed in the background).
 * 3. The source's API.
 * 4. The local HSK 1-4 data (public/strokes/, public/examples/).
 * 5. "Unavailable": the entry page says so and makes nothing up.
 */

/** The strokes of a hanzi-writer-data version never change. */
export const STROKE_TTL_MS = 365 * 24 * 60 * 60 * 1000
/** Tatoeba sentences get corrected and added: one week. */
export const EXAMPLES_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** How often to check for a new version of the full dictionary. */
export const MANIFEST_TTL_MS = 24 * 60 * 60 * 1000

export interface RuntimeSources {
  resources: ResourceService
  cache: DictionaryCache
  fetchFn: typeof fetch
}

export type Availability<T> =
  | { status: 'ready'; data: T; source: string; stale: boolean }
  /** The source doesn't have this data (e.g. a character without strokes): the section isn't shown. */
  | { status: 'missing' }
  /** Couldn't be fetched (offline, rate limit): the entry page says so. */
  | { status: 'unavailable' }

export interface LoadOptions<T> {
  signal?: AbortSignal
  /** Newer data arrives after an expired one was returned. */
  onUpdate?: (result: Availability<T>) => void
}

/** Whether the source says it doesn't have the data, as opposed to not being able to ask. */
function isMissing(error: unknown): boolean {
  return error instanceof SourceError && (error.kind === 'invalid' || (error.kind === 'http' && error.status === 404))
}

function rethrowAbort(error: unknown) {
  if (error instanceof SourceError && error.kind === 'aborted') throw error
}

/**
 * A character's strokes: hanzi-writer-data from jsDelivr and, if that fails,
 * the local copy in public/strokes/ (HSK 1-4 characters only).
 */
export async function loadStrokes(
  sources: RuntimeSources,
  hanzi: string,
  hasLocalCopy: boolean,
  { signal, onUpdate }: LoadOptions<StrokeData> = {},
): Promise<Availability<StrokeData>> {
  let remoteError: unknown
  try {
    const resource = await sources.resources.load({
      key: `strokes:${STROKE_DATA_VERSION}:${hanzi}`,
      ttlMs: STROKE_TTL_MS,
      fetch: (fetchSignal) =>
        fetchStrokeData(hanzi, {
          signal: fetchSignal,
          fetchFn: sources.fetchFn,
        }),
      signal,
      onUpdate: (fresh) => onUpdate?.({ status: 'ready', ...fresh }),
    })
    return { status: 'ready', ...resource }
  } catch (error) {
    rethrowAbort(error)
    remoteError = error
  }
  if (hasLocalCopy) {
    try {
      const url = `${import.meta.env.BASE_URL}strokes/${strokeFileName(hanzi)}`
      const data = parseStrokeData(await fetchJson(url, { signal, fetchFn: sources.fetchFn }))
      return {
        status: 'ready',
        data,
        source: 'public/strokes (HSK 1-4)',
        stale: false,
      }
    } catch (error) {
      rethrowAbort(error)
    }
  }
  return isMissing(remoteError) ? { status: 'missing' } : { status: 'unavailable' }
}

export interface Examples {
  sentences: ExampleSentence[]
  license: string
}

let knownCharacters: Set<string> | undefined

/**
 * Picks the sentences to show: first those that only use HSK 1-4 characters
 * (or those of the term itself), which the learner can read in full; within
 * those, the ones that show the term in context (rankExamples); then, the
 * shortest. The API already returns them from shortest to longest.
 */
export function pickExamples(term: string, candidates: readonly ExampleSentence[]): ExampleSentence[] {
  knownCharacters ??= new Set([...hskDictionary.characters.values()].map((character) => character.hanzi))
  const known = knownCharacters
  const readable = (text: string) =>
    Array.from(text).every((symbol) => !/\p{Script=Han}/u.test(symbol) || known.has(symbol) || term.includes(symbol))
  return rankExamples(candidates, term, (sentence) => sentence.zh)
    .map((sentence, index) => ({
      sentence,
      index,
      readable: readable(sentence.zh),
    }))
    .sort((a, b) => Number(b.readable) - Number(a.readable) || a.index - b.index)
    .slice(0, MAX_EXAMPLES_SHOWN)
    .map(({ sentence }) => sentence)
}

/**
 * Example sentences for a character or word: Tatoeba at runtime and, if
 * that fails or there are none, the local sentences for its HSK level.
 */
export async function loadExamples(
  sources: RuntimeSources,
  item: StudyItem,
  { signal, onUpdate }: LoadOptions<Examples> = {},
): Promise<Availability<Examples>> {
  const term = item.entry.hanzi
  const toResult = (resource: { data: ExampleSentence[]; source: string; stale: boolean }): Availability<Examples> =>
    resource.data.length === 0
      ? { status: 'missing' }
      : {
          status: 'ready',
          data: {
            sentences: pickExamples(term, resource.data),
            license: TATOEBA_LICENSE,
          },
          source: resource.source,
          stale: resource.stale,
        }

  let remote: Availability<Examples> = { status: 'unavailable' }
  try {
    const resource = await sources.resources.load({
      key: `examples:tatoeba-v1:${term}`,
      ttlMs: EXAMPLES_TTL_MS,
      fetch: (fetchSignal) =>
        fetchTatoebaExamples(term, {
          signal: fetchSignal,
          fetchFn: sources.fetchFn,
        }),
      signal,
      onUpdate: (fresh) => {
        const result = toResult(fresh)
        if (result.status === 'ready') onUpdate?.(result)
      },
    })
    remote = toResult(resource)
    if (remote.status === 'ready') return remote
  } catch (error) {
    rethrowAbort(error)
    if (isMissing(error)) remote = { status: 'missing' }
  }

  const level = item.entry.hskLevel
  if (level !== undefined) {
    try {
      const set = await loadExampleSet(level, sources.fetchFn)
      const sentences = getExamplesFor(set, item)
      if (sentences.length > 0) {
        return {
          status: 'ready',
          data: { sentences, license: set.license },
          source: 'public/examples (HSK 1-4)',
          stale: false,
        }
      }
    } catch {
      // No local copy: keep what the remote source said
    }
  }
  return remote
}

/** A stored chunk, with the data version it came from. */
interface CachedChunk {
  version: string
  chunk: DictionaryChunk
}

/**
 * A chunk of the full dictionary (data repository on jsDelivr). The
 * current version comes from the manifest (with its own one-day cache); each
 * chunk is stored with its version and requested again only when it changes. That way
 * the cache never mixes versions or piles up old ones.
 *
 * Offline: a stored chunk is used even if it's from an older version.
 * If nothing is stored, it fails and search stays on HSK 1-4, saying so.
 */
export async function loadDictionaryChunk(
  sources: RuntimeSources,
  index: number,
  signal?: AbortSignal,
): Promise<DictionaryChunk> {
  const { resources, cache, fetchFn } = sources
  let version: string | undefined
  let manifestError: unknown
  try {
    const manifest = await resources.load({
      key: 'dictionary:manifest',
      ttlMs: MANIFEST_TTL_MS,
      fetch: (fetchSignal) => fetchManifest({ signal: fetchSignal, fetchFn }),
      signal,
    })
    version = manifest.data.version
  } catch (error) {
    rethrowAbort(error)
    manifestError = error
  }

  const key = `dictionary:chunk:${index}`
  const cached = (await cache.get<CachedChunk>(key))?.data
  if (cached && (version === undefined || cached.version === version)) return cached.chunk
  if (version === undefined) throw manifestError

  try {
    const chunk = await fetchChunk(version, index, { signal, fetchFn })
    await cache.set<CachedChunk>({
      key,
      data: { version, chunk },
      fetchedAt: Date.now(),
      source: `HanziDict@${version}`,
    })
    return chunk
  } catch (error) {
    rethrowAbort(error)
    if (cached) return cached.chunk
    throw error
  }
}
