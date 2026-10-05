/**
 * Fusion: combines what each adapter returns into the dataset entries.
 *
 * Rules:
 * - Each field has ONE owning source (FIELD_SOURCES). No other source
 *   fills it, not even when the owner lacks the data: the field is then
 *   left empty.
 * - Everything is deterministic: same input order, same result.
 */
import { getWordId } from '../../src/features/dictionary/dictionary.ts'
import type { Character, Hsk5Word, HskLevel, Word } from '../../src/features/dictionary/types.ts'
import { findEntries, readingOf, traditionalOf, usableMeanings, type CedictEntry, type CedictIndex } from './sources/cedict.ts'
import type { HskWord } from './sources/hsk.ts'
import type { MakeMeAHanziCharacter } from './sources/makemeahanzi.ts'
import type { UnihanCharacter } from './sources/unihan.ts'

/** Which source rules each field. Also documented in docs/DATA_SOURCES.md. */
export const FIELD_SOURCES = {
  character: {
    hskLevel: 'HSK list',
    pinyin: 'CC-CEDICT (reading used in the HSK words)',
    meanings: 'CC-CEDICT',
    strokeCount: 'hanzi-writer-data',
    radical: 'Unihan',
    radicalNumber: 'Unihan',
    traditional: 'Unihan',
    decomposition: 'Make Me a Hanzi',
    etymology: 'Make Me a Hanzi',
    strokeOrder: 'hanzi-writer-data (public/strokes/)',
  },
  word: {
    hskLevel: 'HSK list',
    pinyin: 'HSK list',
    meanings: 'CC-CEDICT',
    traditional: 'CC-CEDICT',
  },
} as const

/** An HSK 1-4 entry: it always has a level. */
export type HskEntry<T extends Character | Word> = T & { hskLevel: HskLevel }

export interface BaseEntries {
  characters: HskEntry<Character>[]
  words: HskEntry<Word>[]
  problems: string[]
  /** Repeated entries in the HSK list (same hanzi and pinyin) that were merged into one. */
  duplicates: string[]
  /**
   * HSK list words that are not in CC-CEDICT with that pinyin. They are
   * left out (there is nowhere to take their meaning from) and listed in
   * docs/DATA_CONFLICTS.md.
   */
  leftOut: string[]
}

/** The words of one level of the HSK list. */
export interface HskLevelList {
  level: HskLevel
  words: readonly HskWord[]
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Words and characters of every level from the HSK list and CC-CEDICT.
 * Levels are read in order (1, 2, 3...).
 *
 * - Words: those in the list, with CC-CEDICT's meanings for that same
 *   hanzi and pinyin. If the list repeats a word with the same pinyin
 *   (等 děng in HSK 4, with two senses), it is stored once, at its first
 *   level. If it repeats it with another pinyin (长 cháng / zhǎng), they are
 *   two words with different ids (getWordId).
 * - Characters: all those appearing in the words, with the readings they
 *   are used with there. Their level is that of the first word they
 *   appear in.
 */
export function buildBaseEntries(levels: readonly HskLevelList[], cedict: CedictIndex): BaseEntries {
  const problems: string[] = []
  const duplicates: string[] = []
  const leftOut: string[] = []

  // Exact repeats are removed first, to know which hanzi have several pronunciations
  const seen = new Set<string>()
  const entries: (HskWord & { level: HskLevel })[] = []
  for (const { level, words } of levels) {
    for (const { hanzi, pinyin } of words) {
      const key = `${hanzi} ${pinyin}`
      if (seen.has(key)) {
        duplicates.push(`${hanzi} [${pinyin}] (HSK ${level})`)
        continue
      }
      seen.add(key)
      entries.push({ hanzi, pinyin, level })
    }
  }
  const readingsPerHanzi = new Map<string, number>()
  for (const { hanzi } of entries) readingsPerHanzi.set(hanzi, (readingsPerHanzi.get(hanzi) ?? 0) + 1)

  const words: HskEntry<Word>[] = []
  for (const { hanzi, pinyin, level } of entries) {
    const cedictEntries = findEntries(cedict, hanzi, pinyin)
    const meanings = usableMeanings(cedictEntries)
    if (meanings.length === 0) {
      leftOut.push(`${hanzi} [${pinyin}] (HSK ${level})`)
      continue
    }
    const traditional = traditionalOf(cedictEntries)
    words.push({
      id: getWordId(hanzi, pinyin, readingsPerHanzi.get(hanzi)! > 1),
      hanzi,
      pinyin,
      meanings: { en: meanings },
      hskLevel: level,
      ...(traditional !== undefined && { traditional }),
    })
  }

  const readingsByCharacter = new Map<string, { level: HskLevel; readings: string[] }>()
  // Characters that appear in proper nouns (汉语 Hàn yǔ, 中国 Zhōng guó):
  // capitalized entries also apply to them (汉 "Han; Chinese").
  const properNounCharacters = new Set<string>()
  // Characters that also appear in lowercase (京 in 北京 Běi jīng, but
  // Jīng in 京剧): their general meanings go before the proper-noun ones.
  const commonNounCharacters = new Set<string>()

  for (const { hanzi, pinyin, hskLevel: level } of words) {
    const characters = Array.from(hanzi)
    const syllables = pinyin.split(/\s+/)
    if (characters.length !== syllables.length) {
      problems.push(`Word ${hanzi} [${pinyin}]: not one syllable per character`)
      continue
    }
    characters.forEach((character, index) => {
      const syllable = syllables[index]!
      if (syllable !== syllable.toLowerCase()) properNounCharacters.add(character)
      else commonNounCharacters.add(character)

      const reading = readingOf(cedict, character, syllable.toLowerCase())
      if (!reading) {
        problems.push(`Character ${character} [${syllable}] (in ${hanzi}): no reading in CC-CEDICT`)
        return
      }
      const known = readingsByCharacter.get(character) ?? { level, readings: [] }
      if (!known.readings.includes(reading)) known.readings.push(reading)
      readingsByCharacter.set(character, known)
    })
  }

  const characters: HskEntry<Character>[] = [...readingsByCharacter].map(([hanzi, { level, readings }]) => {
    const cedictEntries = readings.flatMap((reading) => {
      const common = findEntries(cedict, hanzi, reading)
      if (!properNounCharacters.has(hanzi)) return common
      const proper = findEntries(cedict, hanzi, capitalize(reading))
      return commonNounCharacters.has(hanzi) ? [...common, ...proper] : [...proper, ...common]
    })
    return { id: hanzi, hanzi, pinyin: readings, meanings: { en: usableMeanings(cedictEntries) }, hskLevel: level }
  })

  return { characters, words, problems, duplicates, leftOut }
}

/** What each source knows about a character. A source with no data for it is undefined. */
export interface CharacterSources {
  unihan?: UnihanCharacter
  makeMeAHanzi?: MakeMeAHanziCharacter
  /**
   * Stroke count according to hanzi-writer-data. It overrides Unihan's so
   * it matches the animation, which draws the simplified form.
   */
  hanziWriterStrokeCount?: number
  /**
   * Kangxi number (according to Unihan) of the radical Make Me a Hanzi gives.
   * Used to compare radicals written in another form: 亻 and 人 are radical 9.
   */
  makeMeAHanziRadicalNumber?: number
}

/**
 * Adds the other sources' fields to a character, each from its owning
 * source. Only existing values are copied: undefined is never written and
 * data is never taken from another source.
 */
export function enrichCharacter(base: Character, sources: CharacterSources): Character {
  const { unihan, makeMeAHanzi, hanziWriterStrokeCount } = sources
  return {
    ...base,
    ...(hanziWriterStrokeCount !== undefined && { strokeCount: hanziWriterStrokeCount }),
    ...(unihan?.radical !== undefined && { radical: unihan.radical }),
    ...(unihan?.radicalNumber !== undefined && { radicalNumber: unihan.radicalNumber }),
    ...(unihan?.traditional !== undefined && { traditional: unihan.traditional }),
    ...(makeMeAHanzi?.decomposition !== undefined && { decomposition: makeMeAHanzi.decomposition }),
    ...(makeMeAHanzi?.etymology !== undefined && { etymology: makeMeAHanzi.etymology }),
  }
}

/**
 * Compares what two sources say about the same data point. It corrects nothing:
 * the dataset always uses the owning source, and this only flags the
 * disagreement so a person can review it.
 */
export function crossCheckCharacter(hanzi: string, sources: CharacterSources): string[] {
  const { unihan, makeMeAHanzi, hanziWriterStrokeCount, makeMeAHanziRadicalNumber } = sources
  const conflicts: string[] = []
  if (unihan?.strokeCount !== undefined && hanziWriterStrokeCount !== undefined) {
    if (unihan.strokeCount !== hanziWriterStrokeCount) {
      conflicts.push(
        `${hanzi}: Unihan says ${unihan.strokeCount} strokes and hanzi-writer-data has ${hanziWriterStrokeCount}. Using hanzi-writer-data's.`,
      )
    }
  }
  if (
    unihan?.radical !== undefined &&
    makeMeAHanzi !== undefined &&
    unihan.radical !== makeMeAHanzi.radical &&
    unihan.radicalNumber !== makeMeAHanziRadicalNumber
  ) {
    conflicts.push(
      `${hanzi}: the radical is ${unihan.radical} in Unihan and ${makeMeAHanzi.radical} in Make Me a Hanzi. Using Unihan's.`,
    )
  }
  return conflicts
}

export interface FullEntries {
  /** CC-CEDICT characters that are not in HSK 1-4, without a level. */
  characters: Character[]
  /** CC-CEDICT words that are not in HSK 1-4, without a level. */
  words: Word[]
  /** Words left out, with the reason (listed in docs/DATA_CONFLICTS.md). */
  leftOut: string[]
}

const HAN_ONLY = /^\p{Script=Han}+$/u
/** CC-CEDICT writes "xx5" when it doesn't know the reading (々). No reading, no entry. */
const UNKNOWN_READING = /xx/

/**
 * The rest of CC-CEDICT, for the full dictionary. Complements
 * buildBaseEntries: what is already in HSK 1-4 is not repeated.
 *
 * - Only entries written entirely in Chinese characters ("T恤", "110" or
 *   "%" are left out) and with a known reading (not "xx5").
 * - A single-character entry is a character; if it has several readings,
 *   the character carries them all. If any is lowercase, the proper-noun
 *   ones (surname Xxx) don't count as readings, but their meanings do
 *   go after.
 * - Entries of two or more characters are words: one per distinct pinyin
 *   (capitalization included: 苹果 píng guǒ is already in HSK, 苹果 Píng guǒ
 *   "Apple" goes here).
 * - Words already used by HSK (the same entries buildBaseEntries chose
 *   with findEntries) are not repeated.
 * - Id: the hanzi, or the hanzi with its pinyin if there is another word
 *   with the same hanzi (in HSK or here).
 * - A word with a character that has no entry of its own is left out:
 *   its entry card could not teach that character.
 */
export function buildFullEntries(cedict: CedictIndex, hsk: Pick<BaseEntries, 'characters' | 'words'>): FullEntries {
  const hskCharacters = new Set(hsk.characters.map((character) => character.hanzi))
  const usedByHsk = new Set(hsk.words.flatMap((word) => findEntries(cedict, word.hanzi, word.pinyin)))
  const leftOut: string[] = []

  const characters: Character[] = []
  // Words grouped by hanzi and pinyin, in CC-CEDICT order
  const groups = new Map<string, { hanzi: string; pinyin: string; entries: CedictEntry[] }>()
  for (const [hanzi, allEntries] of cedict) {
    if (!HAN_ONLY.test(hanzi)) continue
    const entries = allEntries.filter((entry) => !UNKNOWN_READING.test(entry.pinyin))
    if (entries.length < allEntries.length) leftOut.push(`${hanzi}: CC-CEDICT does not know its reading`)
    if (Array.from(hanzi).length === 1) {
      if (hskCharacters.has(hanzi)) continue
      const common = entries.filter((entry) => entry.pinyin === entry.pinyin.toLowerCase())
      const proper = entries.filter((entry) => entry.pinyin !== entry.pinyin.toLowerCase())
      const readings = (common.length > 0 ? common : proper).map((entry) => entry.pinyin.toLowerCase())
      const meanings = usableMeanings([...common, ...proper])
      if (entries.length > 0 && meanings.length > 0) characters.push({ id: hanzi, hanzi, pinyin: [...new Set(readings)], meanings: { en: meanings } })
      continue
    }
    for (const entry of entries) {
      if (usedByHsk.has(entry)) continue
      const key = `${hanzi} ${entry.pinyin}`
      const group = groups.get(key)
      if (group) group.entries.push(entry)
      else groups.set(key, { hanzi, pinyin: entry.pinyin, entries: [entry] })
    }
  }

  const knownCharacters = new Set([...hskCharacters, ...characters.map((character) => character.hanzi)])
  const kept = [...groups.values()].filter(({ hanzi, pinyin, entries }) => {
    const missing = Array.from(hanzi).filter((character) => !knownCharacters.has(character))
    if (missing.length > 0) {
      leftOut.push(`${hanzi} [${pinyin}]: no entry for ${missing.join(', ')}`)
      return false
    }
    if (usableMeanings(entries).length === 0) {
      leftOut.push(`${hanzi} [${pinyin}]: no meanings`)
      return false
    }
    return true
  })

  const wordsPerHanzi = new Map<string, number>()
  for (const { hanzi } of [...hsk.words, ...kept]) wordsPerHanzi.set(hanzi, (wordsPerHanzi.get(hanzi) ?? 0) + 1)

  const words = kept.map(({ hanzi, pinyin, entries }): Word => {
    const traditional = traditionalOf(entries)
    return {
      id: getWordId(hanzi, pinyin, wordsPerHanzi.get(hanzi)! > 1),
      hanzi,
      pinyin,
      meanings: { en: usableMeanings(entries) },
      ...(traditional !== undefined && { traditional }),
    }
  })

  return { characters, words, leftOut }
}

export interface Hsk5Entries {
  words: Hsk5Word[]
  /** Words already in HSK 1-4 with the same pinyin, or repeated in the list. */
  duplicates: string[]
  /** Words with no CC-CEDICT entry or no dictionary entry to open (listed in docs/DATA_CONFLICTS.md). */
  leftOut: string[]
}

/**
 * HSK 5 words for Today's Word. Meanings come from CC-CEDICT (same
 * findEntries as HSK 1-4) and each word points to the entry that already
 * holds those CC-CEDICT entries: an HSK 1-4 word, a full-dictionary word, or,
 * for a single character, its character entry. Nothing new is added to the
 * dictionary, so its files stay the same.
 */
export function buildHsk5Words(
  list: readonly HskWord[],
  cedict: CedictIndex,
  hsk: Pick<BaseEntries, 'characters' | 'words'>,
  full: Pick<FullEntries, 'characters' | 'words'>,
): Hsk5Entries {
  const duplicates: string[] = []
  const leftOut: string[] = []
  const seen = new Set(hsk.words.map((word) => `${word.hanzi} ${word.pinyin}`))
  const wordByEntry = new Map<CedictEntry, Word>()
  for (const word of [...hsk.words, ...full.words]) {
    for (const entry of findEntries(cedict, word.hanzi, word.pinyin)) {
      if (!wordByEntry.has(entry)) wordByEntry.set(entry, word)
    }
  }
  const characters = new Set([...hsk.characters, ...full.characters].map((character) => character.hanzi))

  const words: Hsk5Word[] = []
  for (const { hanzi, pinyin } of list) {
    const key = `${hanzi} ${pinyin}`
    if (seen.has(key)) {
      duplicates.push(`${hanzi} [${pinyin}] (HSK 5)`)
      continue
    }
    seen.add(key)
    const entries = findEntries(cedict, hanzi, pinyin)
    const meanings = usableMeanings(entries)
    const word = entries.map((entry) => wordByEntry.get(entry)).find((found) => found !== undefined)
    const entry = word
      ? { kind: 'word' as const, id: word.id }
      : Array.from(hanzi).length === 1 && characters.has(hanzi)
        ? { kind: 'character' as const, id: hanzi }
        : undefined
    if (meanings.length === 0 || !entry) {
      leftOut.push(`${hanzi} [${pinyin}] (HSK 5)`)
      continue
    }
    words.push({ hanzi, pinyin, meanings: { en: meanings }, entry })
  }
  return { words, duplicates, leftOut }
}
