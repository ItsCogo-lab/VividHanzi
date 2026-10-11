/**
 * Tatoeba adapter (CC BY 2.0 FR sentences).
 *
 * Responsibility: choosing Chinese example sentences with an English translation
 * for the dataset's words. Reads the per-language exports from
 * https://downloads.tatoeba.org/exports/per_language/:
 *
 * - cmn_sentences_detailed.tsv and eng_sentences_detailed.tsv:
 *   id, language, text, user, date added, date modified.
 * - cmn-eng_links.tsv: id pairs (Chinese sentence, English translation).
 *
 * No sentence is generated or modified: they are copied as is.
 */
import { rankExamples } from '../../../src/features/dictionary/exampleChoice.ts'
import type { ExampleSentence } from '../../../src/features/dictionary/types.ts'

export interface TatoebaSentence {
  id: number
  text: string
  /** Undefined if the sentence is orphaned (no author). */
  author?: string
}

/** Tatoeba uses "\N" for empty values (orphaned sentences, no author). */
const NULL_VALUE = '\\N'

/** Maximum example sentences per word. */
export const MAX_EXAMPLES_PER_WORD = 3

/** Maximum length of an example sentence, in characters. Short ones are easier to read. */
export const MAX_SENTENCE_LENGTH = 16

const HAN = /\p{Script=Han}/u
/** Latin letters and digits: usually proper nouns or numbers that distract. */
const LATIN_OR_DIGIT = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/

/** Reads a line of `*_sentences_detailed.tsv`. */
export function parseSentenceLine(line: string): TatoebaSentence | undefined {
  const [id, , text, author] = line.split('\t')
  const numericId = Number(id)
  if (!text || !Number.isInteger(numericId) || numericId <= 0) return undefined
  return { id: numericId, text, ...(author && author !== NULL_VALUE && { author }) }
}

/** Reads a line of `cmn-eng_links.tsv`: [Chinese sentence id, translation id]. */
export function parseLinkLine(line: string): [number, number] | undefined {
  const [from, to] = line.split('\t').map(Number)
  if (!from || !to) return undefined
  return [from, to]
}

/**
 * Whether a sentence works as an example: short, with no Latin letters or digits, and
 * with all its Chinese characters among those being studied (so the learner
 * can read it in full). Orphaned Chinese sentences (no author) are not used:
 * nobody vouches for them on Tatoeba.
 */
export function isUsableSentence(text: string, knownCharacters: ReadonlySet<string>): boolean {
  const symbols = Array.from(text)
  if (symbols.length > MAX_SENTENCE_LENGTH || LATIN_OR_DIGIT.test(text)) return false
  return symbols.every((symbol) => !HAN.test(symbol) || knownCharacters.has(symbol))
}

export interface ExampleInputs {
  /** The dataset's words, in order. */
  words: readonly string[]
  knownCharacters: ReadonlySet<string>
  chinese: ReadonlyMap<number, TatoebaSentence>
  english: ReadonlyMap<number, TatoebaSentence>
  /** English translations of each Chinese sentence. */
  translations: ReadonlyMap<number, readonly number[]>
  /**
   * Sentences to keep even if no word picks them: the grammar notes quote
   * them (often short ones, like 你呢？). Those that fit this level are added.
   */
  keep?: ReadonlySet<number>
}

/**
 * Chooses up to MAX_EXAMPLES_PER_WORD sentences per word. Deterministic
 * criterion: sentences that show the word in context first (rankExamples),
 * then shortest first and, at equal length, the one with the lowest id. The
 * translation with the lowest id is used.
 */
export function selectExamples(inputs: ExampleInputs): ExampleSentence[] {
  const { words, knownCharacters, chinese, english, translations, keep = new Set<number>() } = inputs

  const candidates = [...chinese.values()]
    .filter((sentence) => sentence.author !== undefined && isUsableSentence(sentence.text, knownCharacters))
    .map((sentence) => {
      const translation = [...(translations.get(sentence.id) ?? [])]
        .sort((a, b) => a - b)
        .map((id) => english.get(id))
        .find((found) => found !== undefined)
      return translation && { sentence, translation }
    })
    .filter((candidate) => candidate !== undefined)
    .sort(
      (a, b) =>
        Array.from(a.sentence.text).length - Array.from(b.sentence.text).length || a.sentence.id - b.sentence.id,
    )

  const selected = new Map<number, ExampleSentence>()
  const toExample = ({ sentence, translation }: (typeof candidates)[number]): ExampleSentence => ({
    tatoebaId: sentence.id,
    zh: sentence.text,
    author: sentence.author!,
    en: translation.text,
    translationTatoebaId: translation.id,
    ...(translation.author !== undefined && { translationAuthor: translation.author }),
    words: [],
  })
  for (const word of words) {
    const matching = candidates.filter(({ sentence }) => sentence.text.includes(word))
    const examples = rankExamples(matching, word, ({ sentence }) => sentence.text).slice(0, MAX_EXAMPLES_PER_WORD)
    for (const candidate of examples) {
      const example = selected.get(candidate.sentence.id) ?? toExample(candidate)
      example.words.push(word)
      selected.set(candidate.sentence.id, example)
    }
  }
  for (const candidate of candidates) {
    if (keep.has(candidate.sentence.id) && !selected.has(candidate.sentence.id)) {
      selected.set(candidate.sentence.id, { ...toExample(candidate), grammarOnly: true })
    }
  }
  return [...selected.values()].sort((a, b) => a.tatoebaId - b.tatoebaId)
}
