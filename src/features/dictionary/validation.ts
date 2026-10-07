import { getWordId } from './dictionary.ts'
import { getChunkIndex, type DictionaryChunk } from './fullDictionary.ts'
import { isValidIds } from './ids.ts'
import type { Character, Etymology, ExampleSet, Translations, Word } from './types.ts'

const HSK_LEVELS: readonly number[] = [1, 2, 3, 4]
const ETYMOLOGY_TYPES: readonly Etymology['type'][] = ['pictographic', 'ideographic', 'pictophonetic']
/** Kangxi radicals go from 1 to 214. */
const MAX_RADICAL_NUMBER = 214
const HAN = /^\p{Script=Han}$/u

/**
 * Checks that the character and word data are consistent and returns
 * a list of readable problems (empty if everything is fine).
 *
 * Used in the dataset tests: if someone adds an incorrect entry, the test
 * fails saying exactly which one and why.
 */
export function validateDictionaryData(characters: readonly Character[], words: readonly Word[]): string[] {
  const problems: string[] = []
  const characterIds = new Set<string>()
  const wordIds = new Set<string>()

  for (const character of characters) {
    const label = `Character "${character.id}"`

    if (characterIds.has(character.id)) problems.push(`${label}: duplicate id`)
    characterIds.add(character.id)

    if (character.id !== character.hanzi) problems.push(`${label}: the id must equal the hanzi`)
    if (Array.from(character.hanzi).length !== 1) problems.push(`${label}: must be a single character`)
    else if (!isHan(character.hanzi)) problems.push(`${label}: not a Chinese character`)
    if (character.hskLevel !== undefined && !HSK_LEVELS.includes(character.hskLevel)) {
      problems.push(`${label}: invalid HSK level`)
    }
    problems.push(...findEmptyValues(label, character))
    if (character.pinyin.length === 0 || character.pinyin.some(isBlank)) {
      problems.push(`${label}: missing pinyin`)
    }
    if (character.strokeCount !== undefined && !isPositiveInteger(character.strokeCount)) {
      problems.push(`${label}: invalid stroke count`)
    }
    if (character.frequencyRank !== undefined && !isPositiveInteger(character.frequencyRank)) {
      problems.push(`${label}: invalid frequency rank`)
    }
    if (character.radical !== undefined && !isSingleSymbol(character.radical)) {
      problems.push(`${label}: invalid radical`)
    }
    if (
      character.radicalNumber !== undefined &&
      !(isPositiveInteger(character.radicalNumber) && character.radicalNumber <= MAX_RADICAL_NUMBER)
    ) {
      problems.push(`${label}: invalid radical number`)
    }
    if (character.traditional !== undefined && (character.traditional.length === 0 || !character.traditional.every(isHan))) {
      problems.push(`${label}: invalid traditional form`)
    }
    if (typeof character.decomposition === 'string' && !isValidIds(character.decomposition)) {
      problems.push(`${label}: invalid decomposition`)
    }
    if (character.etymology !== undefined) problems.push(...validateEtymology(label, character.etymology))
    problems.push(...validateMeanings(label, character.meanings))
  }

  for (const word of words) {
    const label = `Word "${word.id}"`

    if (wordIds.has(word.id)) problems.push(`${label}: duplicate id`)
    wordIds.add(word.id)

    if (word.id !== word.hanzi && word.id !== getWordId(word.hanzi, word.pinyin, true)) {
      problems.push(`${label}: the id must be the hanzi, or the hanzi with its pinyin if it's a homograph`)
    }
    if (isBlank(word.pinyin)) problems.push(`${label}: missing pinyin`)
    if (word.hskLevel !== undefined && !HSK_LEVELS.includes(word.hskLevel)) problems.push(`${label}: invalid HSK level`)
    if (
      word.traditional !== undefined &&
      (Array.from(word.traditional).length !== Array.from(word.hanzi).length || !Array.from(word.traditional).every(isHan))
    ) {
      problems.push(`${label}: invalid traditional form`)
    }
    if (word.frequencyRank !== undefined && !isPositiveInteger(word.frequencyRank)) {
      problems.push(`${label}: invalid frequency rank`)
    }
    problems.push(...findEmptyValues(label, word))
    problems.push(...validateMeanings(label, word.meanings))

    for (const hanzi of Array.from(word.hanzi)) {
      if (!characterIds.has(hanzi)) problems.push(`${label}: the character "${hanzi}" is not in the dataset`)
    }
  }

  return problems
}

/**
 * Checks the full dictionary chunks: each entry in the chunk of its
 * first character (otherwise the app wouldn't find it) and none with an HSK
 * level (HSK 1-4 ones go in src/data). Entry consistency is checked
 * with validateDictionaryData, together with the HSK ones.
 */
export function validateFullDictionary(chunks: readonly DictionaryChunk[]): string[] {
  const problems: string[] = []
  chunks.forEach((chunk, index) => {
    for (const entry of [...chunk.characters, ...chunk.words]) {
      if (getChunkIndex(entry.hanzi) !== index) problems.push(`"${entry.id}": is in chunk ${index}, not its own`)
      if (entry.hskLevel !== undefined) problems.push(`"${entry.id}": the full dictionary has no HSK level`)
    }
  })
  return problems
}

/**
 * Checks an example sentences file: valid, non-repeated Tatoeba ids,
 * texts present, and words that exist and appear in the sentence.
 */
export function validateExampleSet(set: ExampleSet, words: readonly Word[]): string[] {
  const problems: string[] = []
  // Sentences are tied to the word's hanzi (a homograph shares sentences)
  const wordHanzi = new Set(words.map((word) => word.hanzi))
  const seen = new Set<number>()

  if (set.source !== 'Tatoeba' || set.license !== 'CC BY 2.0 FR') problems.push('Examples: invalid source or license')
  if (isBlank(set.exportDate)) problems.push('Examples: missing Tatoeba export date')

  for (const sentence of set.sentences) {
    const label = `Sentence ${sentence.tatoebaId}`
    if (!isPositiveInteger(sentence.tatoebaId) || !isPositiveInteger(sentence.translationTatoebaId)) {
      problems.push(`${label}: invalid Tatoeba id`)
    }
    if (seen.has(sentence.tatoebaId)) problems.push(`${label}: repeated`)
    seen.add(sentence.tatoebaId)
    if (isBlank(sentence.zh) || isBlank(sentence.en)) problems.push(`${label}: missing text`)
    if (isBlank(sentence.author)) problems.push(`${label}: missing author`)
    if (sentence.words.length === 0 && !sentence.grammarOnly) problems.push(`${label}: not linked to any word`)
    for (const word of sentence.words) {
      if (!wordHanzi.has(word)) problems.push(`${label}: the word "${word}" is not in the dataset`)
      else if (!sentence.zh.includes(word)) problems.push(`${label}: does not contain the word "${word}"`)
    }
    problems.push(...findEmptyValues(label, sentence))
  }
  return problems
}

function validateEtymology(label: string, etymology: Etymology): string[] {
  const problems: string[] = []
  if (!ETYMOLOGY_TYPES.includes(etymology.type)) problems.push(`${label}: invalid etymology type`)
  for (const component of [etymology.semantic, etymology.phonetic]) {
    if (component !== undefined && !isSingleSymbol(component)) {
      problems.push(`${label}: invalid etymology component`)
    }
  }
  return problems
}

/**
 * Fields with null, undefined or empty text. In the dataset, missing data
 * is omitted: if it shows up empty, something went wrong generating it.
 */
function findEmptyValues(label: string, entry: object): string[] {
  const empty = Object.entries(entry)
    .filter(([, value]) => value === null || value === undefined || (typeof value === 'string' && isBlank(value)))
    .map(([key]) => key)
  return empty.length > 0 ? [`${label}: empty fields (${empty.join(', ')})`] : []
}

function isHan(text: string): boolean {
  return HAN.test(text)
}

/** A single symbol: a character or a component like 亻 or ⺮. */
function isSingleSymbol(text: string): boolean {
  return Array.from(text).length === 1
}

function validateMeanings(label: string, meanings: Translations): string[] {
  if (meanings.en.length === 0 || meanings.en.some(isBlank)) {
    return [`${label}: missing English meaning`]
  }
  return []
}

function isBlank(text: string): boolean {
  return text.trim() === ''
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
