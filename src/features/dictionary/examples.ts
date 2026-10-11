import { rankExamples, type WordList } from './exampleChoice.ts'
import type { StudyItem } from './studyItem.ts'
import type { ExampleSentence, ExampleSet, HskLevel } from './types.ts'

/** Maximum number of example sentences shown on an entry page. */
export const MAX_EXAMPLES_SHOWN = 3

/**
 * Loads a level's example sentences (public/examples/hsk1.json, generated
 * by `npm run data:build` from Tatoeba). They're requested when an entry page
 * opens so all sentences aren't loaded at app startup.
 */
export async function loadExampleSet(level: HskLevel, fetchFn: typeof fetch = fetch): Promise<ExampleSet> {
  const response = await fetchFn(`${import.meta.env.BASE_URL}examples/hsk${level}.json`)
  if (!response.ok) throw new Error(`No examples for HSK ${level} (HTTP ${response.status})`)
  return (await response.json()) as ExampleSet
}

/**
 * Sentences for an entry page: the ones chosen for that word or, for a
 * character, those of the words that contain it. With a word list, those
 * where the entry stands on its own come first (see exampleChoice.ts).
 */
export function getExamplesFor(set: ExampleSet, item: StudyItem, words?: WordList): ExampleSentence[] {
  const matches =
    item.kind === 'word'
      ? (words: string[]) => words.includes(item.entry.hanzi)
      : (words: string[]) => words.some((word) => word.includes(item.entry.hanzi))
  const matching = set.sentences.filter((sentence) => matches(sentence.words))
  return rankExamples(matching, item.entry.hanzi, (sentence) => sentence.zh, words).slice(0, MAX_EXAMPLES_SHOWN)
}

/** A sentence's page on Tatoeba, for attribution. */
export function tatoebaSentenceUrl(id: number): string {
  return `https://tatoeba.org/en/sentences/show/${id}`
}
