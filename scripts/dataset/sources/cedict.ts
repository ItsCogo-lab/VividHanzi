/**
 * CC-CEDICT adapter (CC BY-SA 4.0), read from the `cedict-json` npm package.
 *
 * Responsibility: English meanings, each character's readings and each
 * word's traditional form. It knows nothing about HSK or other sources.
 */
import { numberedPinyinToToneMarks, removeToneMarks } from '../../../src/lib/pinyin.ts'

/** An entry as it comes in `cedict.json`, with the pinyin already in tone marks. */
export interface CedictEntry {
  traditional: string
  simplified: string
  pinyin: string
  english: string[]
}

/** CC-CEDICT entries grouped by their simplified form. */
export type CedictIndex = ReadonlyMap<string, readonly CedictEntry[]>

/** Maximum meanings per entry: CC-CEDICT's first ones are usually the main ones. */
const MAX_MEANINGS = 6

/**
 * When CC-CEDICT has several entries with the same reading, all are used
 * in their order. Here a specific traditional form is chosen when CC-CEDICT's
 * order would put first a sense that is not the HSK 1 one.
 */
const PREFERRED_TRADITIONAL: Record<string, string> = {
  // 里 "inside" (裡) and not the unit of length "li" (里)
  里: '裡',
  // Avoid the entries for the variants 妳 (note about Taiwan) and 秊 (archaic senses)
  你: '你',
  年: '年',
}

/**
 * Characters where CC-CEDICT's own order is better than the one by use
 * (see sortByTraditionalUse): 喂 "hey" before 餵 "to feed", 須 "must"
 * before 鬚 "beard", 游 "to swim" before 遊 "to walk".
 */
const KEEP_CEDICT_ORDER = new Set(['喂', '须', '游'])

/** Meanings that are dictionary notes rather than translations useful for studying. */
const NON_TRANSLATION_MEANINGS = [
  /^(old |unofficial |archaic |erroneous )?variant of /i,
  /^see /i,
  /^used in /i,
  /^surname /i,
  /^\(surname\)/i,
  /^abbr\. for /i,
  /^CL:/,
  /^Taiwan pr\./i,
  /^also pr\./i,
  /^Kangxi radical/i,
]

/** Reads `cedict.json` and groups the entries by simplified form, with the pinyin in tone marks. */
export function createCedictIndex(json: string): CedictIndex {
  const entries: CedictEntry[] = JSON.parse(json)
  const index = new Map<string, CedictEntry[]>()
  for (const entry of entries) {
    const toneMarked = { ...entry, pinyin: numberedPinyinToToneMarks(entry.pinyin) }
    const list = index.get(entry.simplified) ?? []
    list.push(toneMarked)
    index.set(entry.simplified, list)
  }
  return sortByTraditionalUse(index)
}

/**
 * Orders a character's entries with the same reading by how common their
 * traditional form is. A simplified character can stand for several
 * traditional ones, and CC-CEDICT lists them in code point order, not by
 * use: 只 zhī put 秖 "grain that has begun to ripen" before 隻 "classifier
 * for birds", and 后 hòu put 后 "empress" before 後 "back; after".
 *
 * How common a form is: how many CC-CEDICT words write that character
 * with that traditional form and reading (隻 zhī appears in 23 words, 秖
 * in none). Readings keep their order; ties keep CC-CEDICT's.
 */
function sortByTraditionalUse(index: Map<string, CedictEntry[]>): CedictIndex {
  const uses = new Map<string, number>()
  for (const entries of index.values()) {
    for (const entry of entries) {
      const simplified = Array.from(entry.simplified)
      const traditional = Array.from(entry.traditional)
      const syllables = entry.pinyin.toLowerCase().split(/\s+/)
      if (simplified.length < 2 || traditional.length !== simplified.length || syllables.length !== simplified.length) continue
      simplified.forEach((hanzi, position) => {
        const key = formKey(hanzi, traditional[position]!, syllables[position]!)
        uses.set(key, (uses.get(key) ?? 0) + 1)
      })
    }
  }

  for (const [simplified, entries] of index) {
    if (Array.from(simplified).length !== 1 || KEEP_CEDICT_ORDER.has(simplified)) continue
    const readings = new Map<string, CedictEntry[]>()
    for (const entry of entries) readings.set(entry.pinyin, [...(readings.get(entry.pinyin) ?? []), entry])
    const usesOf = (entry: CedictEntry) => uses.get(formKey(entry.simplified, entry.traditional, entry.pinyin.toLowerCase())) ?? 0
    index.set(
      simplified,
      [...readings.values()].flatMap((sameReading) => [...sameReading].sort((a, b) => usesOf(b) - usesOf(a))),
    )
  }
  return index
}

function formKey(simplified: string, traditional: string, syllable: string): string {
  return `${simplified}${traditional} ${syllable}`
}

/**
 * Comparable pinyin: without spaces, but with tones and capitals. Capitals
 * matter: in CC-CEDICT they mark proper nouns (苹果 píng guǒ
 * "apple" versus Píng guǒ "Apple, the company").
 */
function comparablePinyin(pinyin: string): string {
  return pinyin.replace(/\s+/g, '')
}

/**
 * Cleans up CC-CEDICT's internal notation so the text reads well:
 * "(abbr. to 京[Jing1])" → "(abbr. to 京)", "兩|两[liang3]" → "两",
 * and removes the classifier notes "(CL:...)" and Taiwan pronunciation notes.
 */
export function cleanMeaning(meaning: string): string {
  return meaning
    .replace(/\s*\((CL:|Taiwan pr\.)[^)]*\)/g, '')
    .replace(/\S+\|(\S+?)\[[^\]]+\]/g, '$1')
    .replace(/([㐀-鿿]+)\[[^\]]+\]/g, '$1')
    .replace(/\[([^\]]+)\]/g, (_match, pinyin: string) => numberedPinyinToToneMarks(pinyin))
    .trim()
}

function hasToneMark(syllable: string): boolean {
  return removeToneMarks(syllable) !== syllable.toLowerCase()
}

function isTranslation(meaning: string): boolean {
  return !NON_TRANSLATION_MEANINGS.some((pattern) => pattern.test(meaning))
}

/**
 * Meanings useful for studying. If a reading only has notes (漂 piào:
 * "used in 漂亮"), the notes are kept: they say something true and useful.
 */
export function usableMeanings(entries: readonly CedictEntry[]): string[] {
  const all = entries.flatMap((entry) => entry.english)
  const translations = all.filter(isTranslation)
  const meanings = (translations.length > 0 ? translations : all).map(cleanMeaning).filter((meaning) => meaning !== '')
  return [...new Set(meanings)].slice(0, MAX_MEANINGS)
}

/**
 * CC-CEDICT entries for a hanzi with a specific reading. If there is
 * none with that exact pinyin, it tries, in this order:
 *
 * 1. The same word with a neutral tone where the HSK list has the tone
 *    (关系: HSK guān xì, CC-CEDICT guān xi). It is the same word: CC-CEDICT
 *    records the colloquial pronunciation.
 * 2. Entries that explicitly say it is also pronounced that way
 *    (钥 yuè: "also pr. [yao4]").
 */
export function findEntries(index: CedictIndex, hanzi: string, pinyin: string): CedictEntry[] {
  const all = index.get(hanzi) ?? []
  const exact = all.filter((entry) => comparablePinyin(entry.pinyin) === comparablePinyin(pinyin))
  const entries =
    exact.length > 0
      ? exact
      : firstNonEmpty(
          all.filter((entry) => differsOnlyInNeutralTones(entry.pinyin, pinyin)),
          all.filter((entry) => isAlsoPronounced(entry, pinyin)),
        )
  const preferred = PREFERRED_TRADITIONAL[hanzi]
  return preferred ? entries.filter((entry) => entry.traditional === preferred) : entries
}

function firstNonEmpty<T>(...lists: T[][]): T[] {
  return lists.find((list) => list.length > 0) ?? []
}

/**
 * Whether CC-CEDICT's pinyin is the same as HSK's except for syllables that
 * CC-CEDICT gives a neutral tone: "guān xi" versus "guān xì".
 */
function differsOnlyInNeutralTones(cedictPinyin: string, hskPinyin: string): boolean {
  const cedictSyllables = cedictPinyin.split(/\s+/)
  const hskSyllables = hskPinyin.split(/\s+/)
  if (cedictSyllables.length !== hskSyllables.length) return false
  return cedictSyllables.every((syllable, index) => {
    const hskSyllable = hskSyllables[index]!
    return syllable === hskSyllable || (!hasToneMark(syllable) && removeToneMarks(hskSyllable) === syllable.toLowerCase())
  })
}

/** Whether the entry says "also pr. [yao4]" with this same reading. */
function isAlsoPronounced(entry: CedictEntry, pinyin: string): boolean {
  return entry.english.some((meaning) =>
    [...meaning.matchAll(/also pr\. \[([^\]]+)\]/gi)].some(
      (match) => comparablePinyin(numberedPinyinToToneMarks(match[1]!)) === comparablePinyin(pinyin),
    ),
  )
}

/**
 * Traditional form of a group of entries. Entries that are only notes
 * ("variant of 吃") are ignored, same as when choosing the meanings. If even
 * so CC-CEDICT gives two different forms, none is silently picked.
 */
export function traditionalOf(entries: readonly CedictEntry[]): string | undefined {
  const withTranslations = entries.filter((entry) => entry.english.some(isTranslation))
  const forms = new Set((withTranslations.length > 0 ? withTranslations : entries).map((entry) => entry.traditional))
  return forms.size === 1 ? [...forms][0] : undefined
}

/**
 * A character's reading as it is used in a word.
 *
 * If it has a neutral tone in the word, the CC-CEDICT entry with that
 * neutral tone is used if it exists (吗 ma, 们 men, 子 zi); otherwise, the
 * toned reading (东西 dōng xi → 西 xī), which is that of the character alone.
 */
export function readingOf(index: CedictIndex, hanzi: string, syllable: string): string | undefined {
  const candidates = (index.get(hanzi) ?? [])
    .map((entry) => entry.pinyin)
    .filter((pinyin) => pinyin === pinyin.toLowerCase())
  if (hasToneMark(syllable)) {
    const exact = candidates.find((pinyin) => pinyin === syllable)
    if (exact) return exact
    // 钥 only has the entry yuè, which says "also pr. [yao4]": in 钥匙 it is read yào
    const alsoPronounced = (index.get(hanzi) ?? []).some((entry) => isAlsoPronounced(entry, syllable))
    return alsoPronounced ? syllable : undefined
  }

  const sameSyllable = candidates.filter((pinyin) => removeToneMarks(pinyin) === syllable)
  return sameSyllable.find((pinyin) => pinyin === syllable) ?? sameSyllable[0]
}
