import type { Character, ContentLocale, HskLevel, Translations, Word } from './types.ts'

/**
 * All available characters and words, indexed by id.
 *
 * We use a Map to look up by id in constant time. A Map keeps insertion
 * order, so listings come out in dataset order.
 */
export interface Dictionary {
  characters: ReadonlyMap<string, Character>
  words: ReadonlyMap<string, Word>
}

/**
 * A word's id: its hanzi or, if the same word appears with several
 * pronunciations (homographs like 长 cháng / zhǎng), the hanzi with its
 * pinyin in brackets, as in CC-CEDICT: "长[cháng]".
 */
export function getWordId(hanzi: string, pinyin: string, isHomograph: boolean): string {
  return isHomograph ? `${hanzi}[${pinyin}]` : hanzi
}

export function createDictionary(characters: readonly Character[], words: readonly Word[]): Dictionary {
  return {
    characters: new Map(characters.map((character) => [character.id, character])),
    words: new Map(words.map((word) => [word.id, word])),
  }
}

export function getCharacter(dictionary: Dictionary, id: string): Character | undefined {
  return dictionary.characters.get(id)
}

export function getWord(dictionary: Dictionary, id: string): Word | undefined {
  return dictionary.words.get(id)
}

/** Lists the characters, optionally only those of one HSK level. */
export function listCharacters(dictionary: Dictionary, level?: HskLevel): Character[] {
  const all = [...dictionary.characters.values()]
  return level === undefined ? all : all.filter((character) => character.hskLevel === level)
}

/** Lists the words, optionally only those of one HSK level. */
export function listWords(dictionary: Dictionary, level?: HskLevel): Word[] {
  const all = [...dictionary.words.values()]
  return level === undefined ? all : all.filter((word) => word.hskLevel === level)
}

/**
 * Characters that make up a word, in order and without repeats (谢谢 → 谢).
 *
 * We don't store this list in the data because it follows from `word.hanzi`:
 * data that can be computed can't get out of sync.
 */
export function getCharactersOfWord(dictionary: Dictionary, word: Word): Character[] {
  const uniqueHanzi = new Set(Array.from(word.hanzi))
  return [...uniqueHanzi]
    .map((hanzi) => dictionary.characters.get(hanzi))
    .filter((character) => character !== undefined)
}

/**
 * Words that contain a character (the "related words").
 * Walks through every word: with a few thousand entries it's instant.
 */
export function getWordsWithCharacter(dictionary: Dictionary, characterId: string): Word[] {
  return listWords(dictionary).filter((word) => word.hanzi.includes(characterId))
}

/**
 * The same hanzi read another way: 只 zhī "classifier" and 只 zhǐ "only"
 * are two words, each with its own meanings.
 */
export function getOtherReadings(dictionary: Dictionary, word: Word): Word[] {
  return listWords(dictionary).filter((other) => other.hanzi === word.hanzi && other.id !== word.id)
}

/** Meanings in a language; if there are none in that language, returns the English ones. */
export function getMeanings(translations: Translations, locale: ContentLocale = 'en'): string[] {
  return translations[locale] ?? translations.en
}

/** Pinyin ready to display. If a character has several readings, they are separated by commas. */
export function formatPinyin(entry: Character | Word): string {
  return typeof entry.pinyin === 'string' ? entry.pinyin : entry.pinyin.join(', ')
}

/**
 * Traditional forms that are written differently from the simplified one: 柠 → [檸],
 * 八 → []. If a character is written the same in both systems, there's nothing
 * to show.
 */
export function getTraditionalForms(entry: Character | Word): string[] {
  const forms = typeof entry.traditional === 'string' ? [entry.traditional] : (entry.traditional ?? [])
  return forms.filter((form) => form !== entry.hanzi)
}
