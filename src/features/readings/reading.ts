import { isRecord } from '../../lib/storage.ts'
import { getSyllableTone, splitSyllables, type Tone } from '../../lib/tones.ts'
import type { Reading, ReadingParagraph, ReadingSentence, ReadingSummary, ReadingWord } from './types.ts'

const HAN = /\p{Script=Han}/u

/** The sentence as plain text: 大晴的工作很忙。 */
export function sentenceText(sentence: ReadingSentence): string {
  return sentence.words.map((word) => word.text).join('')
}

/** All the text of a reading, to load the dictionary entries of its characters. */
export function readingText(reading: Reading): string {
  return listSentences(reading)
    .map(({ sentence }) => sentenceText(sentence))
    .join('')
}

/**
 * Every sentence of a reading with a stable key ("title", "p2-speaker",
 * "p2-0", "q1"), in reading order: what a selection points at.
 */
export function listSentences(reading: Reading): { key: string; sentence: ReadingSentence }[] {
  return [
    { key: 'title', sentence: reading.title },
    ...reading.paragraphs.flatMap((paragraph, p) => [
      ...(paragraph.speaker ? [{ key: `p${p}-speaker`, sentence: paragraph.speaker }] : []),
      ...paragraph.sentences.map((sentence, s) => ({ key: `p${p}-${s}`, sentence })),
    ]),
    ...(reading.questions ?? []).map((sentence, q) => ({ key: `q${q}`, sentence })),
    // A new word on its own: its "sentence" is just the word and its meaning
    ...(reading.vocabulary ?? []).map((word, v) => ({
      key: `v${v}`,
      sentence: { words: [word], translation: word.meaning ?? '' },
    })),
  ]
}

/** The first sentence of the text (title and paragraphs) where this word is written. */
export function findSentenceWith(reading: Reading, text: string): ReadingSentence | undefined {
  return [reading.title, ...reading.paragraphs.flatMap((paragraph) => paragraph.sentences)].find((sentence) =>
    sentenceText(sentence).includes(text),
  )
}

/**
 * Tone of each character of a word, from its pinyin: 快点儿 "kuài diǎn r"
 * → [4, 3, undefined]. Characters that aren't hanzi (and the "r" of erhua)
 * have none.
 */
export function getWordTones(word: ReadingWord): (Tone | undefined)[] {
  const characters = Array.from(word.text)
  if (!word.pinyin) return characters.map(() => undefined)
  const syllables = splitSyllables(word.pinyin)
  let next = 0
  return characters.map((character) => (HAN.test(character) ? getSyllableTone(syllables[next++] ?? '') : undefined))
}

const OPENING = /^[“‘《（(「『【]+$/u

/**
 * The sentence in unbreakable pieces: each word with the punctuation around
 * it, so a line never starts with "，" or ends with "“".
 */
export function groupWords(words: readonly ReadingWord[]): { word: ReadingWord; index: number }[][] {
  const groups: { word: ReadingWord; index: number }[][] = []
  let opening: { word: ReadingWord; index: number }[] = []
  words.forEach((word, index) => {
    const last = groups.at(-1)
    if (word.pinyin || !last || OPENING.test(word.text)) {
      if (word.pinyin) {
        groups.push([...opening, { word, index }])
        opening = []
      } else opening.push({ word, index })
    } else last.push({ word, index })
  })
  if (opening.length > 0) groups.push(opening)
  return groups
}

/** Pinyin as it is written: the erhua "r" joins its syllable ("kuài diǎn r" → "kuài diǎnr"). */
export function displayPinyin(pinyin: string): string {
  return pinyin.replace(/\s+r(?=\s|$)/g, 'r')
}

/**
 * Reads pasted or uploaded JSON: one reading or a list of them. Words are
 * written compactly as [text] or [text, pinyin, meaning]:
 *
 *   { "book": "...", "level": 4, "unit": "1", "position": 1,
 *     "title": { "words": [["简单", "jiǎn dān", "simple"]], "translation": "Simple" },
 *     "paragraphs": [[{ "words": [["我", "wǒ", "I"], ["。"]], "translation": "..." }]],
 *     "questions": [{ "words": [...], "translation": "..." }],
 *     "vocabulary": [["家具", "jiā jù", "n. furniture"]] }
 *
 * A paragraph is a list of sentences, or { "speaker": sentence, "sentences": [...] }
 * for a line of a dialogue. "level", "questions" and "vocabulary" (the
 * text's new words, 生词) are optional.
 *
 * Every word with pinyin needs one syllable per hanzi, so tone colors never
 * guess. Throws an Error saying what is wrong and where.
 */
export function parseReadings(json: string): Reading[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('This is not valid JSON.')
  }
  const list = Array.isArray(data) ? data : [data]
  if (list.length === 0) throw new Error('There are no readings in this JSON.')
  return list.map((item, index) => parseReading(item, list.length > 1 ? `Reading ${index + 1}` : 'Reading'))
}

function parseReading(value: unknown, where: string): Reading {
  if (!isRecord(value)) throw new Error(`${where}: expected an object.`)
  const book = requireText(value.book, `${where}: "book"`)
  const unit = typeof value.unit === 'number' ? String(value.unit) : requireText(value.unit, `${where}: "unit"`)
  for (const field of ['position', 'level']) {
    if (value[field] !== undefined && typeof value[field] !== 'number') {
      throw new Error(`${where}: "${field}" must be a number.`)
    }
  }
  const title = parseSentence(value.title, `${where}, title`)
  if (!Array.isArray(value.paragraphs) || value.paragraphs.length === 0) {
    throw new Error(`${where}: "paragraphs" must be a non-empty list.`)
  }
  const paragraphs = value.paragraphs.map((paragraph: unknown, p) => parseParagraph(paragraph, `${where}, paragraph ${p + 1}`))
  if (value.questions !== undefined && !Array.isArray(value.questions)) {
    throw new Error(`${where}: "questions" must be a list.`)
  }
  const questions = value.questions?.map((question: unknown, q) => parseSentence(question, `${where}, question ${q + 1}`))
  if (value.vocabulary !== undefined && !Array.isArray(value.vocabulary)) {
    throw new Error(`${where}: "vocabulary" must be a list.`)
  }
  const vocabulary = value.vocabulary?.map((word: unknown) => {
    const parsed = parseWord(word, `${where}, vocabulary`)
    if (!parsed.pinyin) throw new Error(`${where}, vocabulary: "${parsed.text}" needs its pinyin and meaning.`)
    return parsed
  })
  return {
    book,
    ...(value.level !== undefined && { level: value.level as number }),
    unit,
    ...(value.position !== undefined && { position: value.position as number }),
    title,
    paragraphs,
    ...(questions && questions.length > 0 && { questions }),
    ...(vocabulary && vocabulary.length > 0 && { vocabulary }),
  }
}

function parseParagraph(value: unknown, where: string): ReadingParagraph {
  const list = isRecord(value) ? value.sentences : value
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${where}: expected a list of sentences or { "speaker", "sentences" }.`)
  }
  const sentences = list.map((sentence: unknown, s) => parseSentence(sentence, `${where}, sentence ${s + 1}`))
  if (!isRecord(value) || value.speaker === undefined) return { sentences }
  return { speaker: parseSentence(value.speaker, `${where}, speaker`), sentences }
}

function parseSentence(value: unknown, where: string): ReadingSentence {
  if (!isRecord(value)) throw new Error(`${where}: expected an object.`)
  const translation = requireText(value.translation, `${where}: "translation"`)
  if (!Array.isArray(value.words) || value.words.length === 0) {
    throw new Error(`${where}: "words" must be a non-empty list.`)
  }
  return { words: value.words.map((word: unknown) => parseWord(word, where)), translation }
}

function parseWord(word: unknown, where: string): ReadingWord {
  // Saved readings (Supabase) keep words as { text, pinyin, meaning }
  const value = isRecord(word) ? [word.text, word.pinyin, word.meaning].filter((part) => part !== undefined) : word
  if (!Array.isArray(value) || !value.every((part) => typeof part === 'string')) {
    throw new Error(`${where}: each word must be ["text"] or ["text", "pinyin", "meaning"].`)
  }
  const [text, pinyin, meaning] = value as string[]
  if (!text) throw new Error(`${where}: a word has no text.`)
  if (value.length === 1) return { text }
  if (value.length !== 3 || !pinyin || !meaning) {
    throw new Error(`${where}: "${text}" must be ["text", "pinyin", "meaning"].`)
  }
  const hanzi = Array.from(text).filter((character) => HAN.test(character)).length
  const syllables = splitSyllables(pinyin).filter((syllable) => syllable !== 'r').length
  const erhua = splitSyllables(pinyin).length - syllables
  if (hanzi === 0 || syllables + erhua !== hanzi) {
    throw new Error(`${where}: "${text}" has ${hanzi} hanzi but its pinyin "${pinyin}" has ${syllables + erhua} syllables.`)
  }
  return { text, pinyin, meaning }
}

function requireText(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${what} must be a non-empty text.`)
  return value.trim()
}

export interface BookShelf {
  book: string
  units: { unit: string; readings: ReadingSummary[] }[]
}

/** The library: books by name, units in numeric order (2 before 10), readings by position. */
export function groupReadings(readings: readonly ReadingSummary[]): BookShelf[] {
  const compare = new Intl.Collator(undefined, { numeric: true }).compare
  const sorted = [...readings].sort(
    (a, b) =>
      compare(a.book, b.book) ||
      compare(a.unit, b.unit) ||
      (a.position ?? Infinity) - (b.position ?? Infinity) ||
      compare(a.title, b.title),
  )
  const shelves: BookShelf[] = []
  for (const reading of sorted) {
    let shelf = shelves.at(-1)
    if (shelf?.book !== reading.book) shelves.push((shelf = { book: reading.book, units: [] }))
    let unit = shelf.units.at(-1)
    if (unit?.unit !== reading.unit) shelf.units.push((unit = { unit: reading.unit, readings: [] }))
    unit.readings.push(reading)
  }
  return shelves
}

/**
 * SHA-256 of the email of the only account that sees Readings. It's a hash
 * so the owner's email isn't published with the code. This only hides the
 * section: what keeps the texts private are the table's policies.
 */
const OWNER_EMAIL_SHA256 = '5d424e597b57020c0c323c0ef22761df8c9b269694bc630fce1a64b96e126c82'

export async function isReadingsOwner(email: string | null): Promise<boolean> {
  if (!email) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex === OWNER_EMAIL_SHA256
}
