import { describe, expect, it } from 'vitest'
import { createFakeFetch, jsonResponse, offlineFetch } from '../../../test/fakeFetch.ts'
import { ningResponse } from '../../../test/tatoebaResponses.ts'
import type { StudyItem } from '../studyItem.ts'
import { ningCharacter, testExampleSet } from '../testData.ts'
import { createMemoryCache, type DictionaryCache } from './dictionaryCache.ts'
import { getChunkIndex } from '../fullDictionary.ts'
import {
  EXAMPLES_TTL_MS,
  loadDictionaryChunk,
  loadExamples,
  loadStrokes,
  MANIFEST_TTL_MS,
  pickExamples,
  type RuntimeSources,
} from './dictionaryService.ts'
import { chunkUrl, manifestUrl } from './dictionarySource.ts'
import { manifest } from './dictionarySource.test.ts'
import { createResourceService } from './resourceService.ts'

const strokes = { strokes: ['M 0 0'], medians: [[[0, 0]]] }
const ning: StudyItem = { kind: 'character', entry: ningCharacter }
const { hskLevel: _level, ...ningOutsideHsk } = ningCharacter

function sources(fetchFn: typeof fetch, cache: DictionaryCache = createMemoryCache(), now = () => 0): RuntimeSources {
  return { resources: createResourceService(cache, now), cache, fetchFn }
}

describe('loadStrokes', () => {
  it('uses the cache before the network', async () => {
    const cache = createMemoryCache()
    const online = createFakeFetch([[/jsdelivr/, jsonResponse(strokes)]])
    await loadStrokes(sources(online.fetch, cache), '柠', false)
    const result = await loadStrokes(sources(offlineFetch, cache), '柠', false)
    expect(result).toMatchObject({ status: 'ready', data: strokes, source: 'hanzi-writer-data@2.0.1 (jsDelivr)' })
  })

  it('tells "the source doesn\'t have it" apart from "could not be fetched"', async () => {
    const notFound = createFakeFetch([[/./, new Response('', { status: 404 })]])
    expect(await loadStrokes(sources(notFound.fetch), '柠', true)).toEqual({ status: 'missing' })
    expect(await loadStrokes(sources(offlineFetch), '柠', false)).toEqual({ status: 'unavailable' })
  })

  it('does not make up strokes: a malformed response is not shown', async () => {
    const broken = createFakeFetch([[/./, jsonResponse({ strokes: 'x' })]])
    expect(await loadStrokes(sources(broken.fetch), '柠', true)).toEqual({ status: 'missing' })
  })

  it('cancelling the request does not fall back to the local copy', async () => {
    const fake = createFakeFetch([['/strokes/', jsonResponse(strokes)]])
    const controller = new AbortController()
    controller.abort()
    await expect(loadStrokes(sources(fake.fetch), '柠', true, { signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    })
    expect(fake.requested).toEqual([])
  })
})

describe('loadExamples', () => {
  it('stores Tatoeba sentences and refreshes them when they expire (stale-while-revalidate)', async () => {
    const cache = createMemoryCache()
    let time = 0
    const online = createFakeFetch([['https://api.tatoeba.org/', jsonResponse(ningResponse)]])
    const first = await loadExamples(
      sources(online.fetch, cache, () => time),
      ning,
    )
    expect(first).toMatchObject({ status: 'ready', source: 'Tatoeba API v1', stale: false })

    time = EXAMPLES_TTL_MS + 1
    const updates: unknown[] = []
    const stale = await loadExamples(
      sources(online.fetch, cache, () => time),
      ning,
      {
        onUpdate: (fresh) => updates.push(fresh),
      },
    )
    expect(stale).toMatchObject({ status: 'ready', stale: true })
    await expect.poll(() => updates).toEqual([expect.objectContaining({ status: 'ready', stale: false })])
    expect(online.requested).toHaveLength(2)
  })

  it('offline uses the local sentences for its HSK level', async () => {
    const local = createFakeFetch([['/examples/hsk1.json', jsonResponse(testExampleSet)]])
    const result = await loadExamples(sources(local.fetch), ning)
    expect(result).toMatchObject({ status: 'ready', source: 'public/examples (HSK 1-4)' })
  })

  it('offline and outside HSK says so, without making up sentences', async () => {
    const outside: StudyItem = { kind: 'character', entry: ningOutsideHsk }
    expect(await loadExamples(sources(offlineFetch), outside)).toEqual({ status: 'unavailable' })
  })
})

describe('pickExamples', () => {
  it('prefers sentences readable with HSK 1-4 characters', () => {
    const sentence = (tatoebaId: number, zh: string) => ({
      tatoebaId,
      zh,
      author: 'a',
      en: 'x',
      translationTatoebaId: 1,
      words: ['柠'],
    })
    const picked = pickExamples('柠檬', [sentence(1, '柠檬很龘。'), sentence(2, '我吃了你的柠檬。')])
    expect(picked.map((example) => example.tatoebaId)).toEqual([2, 1])
  })

  it('prefers sentences that show the word in context over the word alone', () => {
    const sentence = (tatoebaId: number, zh: string) => ({
      tatoebaId,
      zh,
      author: 'a',
      en: 'x',
      translationTatoebaId: 1,
      words: ['完成'],
    })
    const picked = pickExamples('完成', [
      sentence(1, '完成了！'),
      sentence(2, '完成了。'),
      sentence(3, '我们完成了!'),
      sentence(4, '我已经完成作业了。'),
    ])
    expect(picked.map((example) => example.tatoebaId)).toEqual([4, 1, 3])
  })
})

describe('loadDictionaryChunk', () => {
  const penguin = getChunkIndex('企')
  const chunkV1 = {
    characters: [],
    words: [{ id: '企鹅', hanzi: '企鹅', pinyin: 'qǐ é', meanings: { en: ['penguin'] } }],
  }
  const chunkV2 = {
    characters: [],
    words: [{ id: '企鹅', hanzi: '企鹅', pinyin: 'qǐ é', meanings: { en: ['penguin (bird)'] } }],
  }
  const online = (version: string, chunk: unknown) =>
    createFakeFetch([
      [manifestUrl(), jsonResponse({ ...manifest, version })],
      [chunkUrl(version, penguin), jsonResponse(chunk)],
    ])

  it('downloads the chunk for the manifest version and stores it', async () => {
    const cache = createMemoryCache()
    const fake = online('1.0.0', chunkV1)
    expect(await loadDictionaryChunk(sources(fake.fetch, cache), penguin)).toEqual(chunkV1)
    // Another visit, offline: it comes from the cache
    expect(await loadDictionaryChunk(sources(offlineFetch, cache), penguin)).toEqual(chunkV1)
  })

  it('when a new version is published, requests it once the manifest expires', async () => {
    const cache = createMemoryCache()
    let time = 0
    await loadDictionaryChunk(
      sources(online('1.0.0', chunkV1).fetch, cache, () => time),
      penguin,
    )
    time = MANIFEST_TTL_MS + 1
    const v2 = online('1.1.0', chunkV2)
    const service = sources(v2.fetch, cache, () => time)
    // Stale-while-revalidate: this time it still serves 1.0.0 and refreshes the manifest in the background
    expect(await loadDictionaryChunk(service, penguin)).toEqual(chunkV1)
    await expect.poll(() => v2.requested).toContain(manifestUrl())
    await expect.poll(() => loadDictionaryChunk(service, penguin)).toEqual(chunkV2)
  })

  it('offline uses a stored chunk even if it is from an older version', async () => {
    const cache = createMemoryCache()
    await loadDictionaryChunk(sources(online('1.0.0', chunkV1).fetch, cache), penguin)
    const manifestOnly = createFakeFetch([[manifestUrl(), jsonResponse({ ...manifest, version: '1.1.0' })]])
    const fresh = sources(manifestOnly.fetch, cache)
    expect(await loadDictionaryChunk(fresh, penguin)).toEqual(chunkV1)
  })

  it('offline with nothing stored fails (search stays on HSK)', async () => {
    await expect(loadDictionaryChunk(sources(offlineFetch), penguin)).rejects.toMatchObject({ kind: 'network' })
  })
})
