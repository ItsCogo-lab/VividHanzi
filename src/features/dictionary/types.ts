/** HSK levels the app will cover (HSK 2.0 standard). */
export type HskLevel = 1 | 2 | 3 | 4

/** Languages the learning content (meanings) can be in. */
export type ContentLocale = 'es' | 'en' | 'ca'

/**
 * An entry's meanings by language. English is required because it's the
 * source's language (CC-CEDICT); Spanish and Catalan can be added later
 * without changing the model.
 */
export type Translations = { en: string[] } & Partial<Record<Exclude<ContentLocale, 'en'>, string[]>>

/**
 * How a character was formed (Make Me a Hanzi). In pictophonetic ones, the
 * semantic component provides the meaning and the phonetic one, the pronunciation:
 * 柠 = 木 (tree) + 宁 (níng).
 */
export interface Etymology {
  type: 'pictographic' | 'ideographic' | 'pictophonetic'
  /** Short hint in English: "tree" in 柠, or the explanation for pictographic ones. */
  hint?: string
  semantic?: string
  phonetic?: string
}

/** A single Chinese character (hanzi). */
export interface Character {
  /** Unique identifier: the character itself, e.g. "好". */
  id: string
  hanzi: string
  /** Pinyin with tone marks. Some characters have several readings (了: le, liǎo). */
  pinyin: string[]
  meanings: Translations
  /** HSK level. Characters from the full dictionary that aren't in HSK 1-4 have none. */
  hskLevel?: HskLevel
  /*
   * Optional on purpose: only filled in if we have a reliable source.
   * Better missing data than made-up data.
   */
  /** Total number of strokes (Unihan kTotalStrokes). */
  strokeCount?: number
  /** Kangxi radical as a regular character: 木, or its simplified form: 讠 (Unihan kRSUnicode). */
  radical?: string
  /** Kangxi radical number, from 1 to 214: 木 → 75 (Unihan kRSUnicode). */
  radicalNumber?: number
  /** Position in a frequency list (1 = the most frequent). */
  frequencyRank?: number
  /**
   * Traditional forms (Unihan kTraditionalVariant): 柠 → ["檸"]. May
   * include the character itself if it's also used in traditional.
   */
  traditional?: string[]
  /**
   * Decomposition into components as a Unicode IDS sequence (Make Me a
   * Hanzi): 柠 → "⿰木宁" (木 on the left, 宁 on the right).
   */
  decomposition?: string
  etymology?: Etymology
}

/**
 * An HSK 5 word (HSK 2.0). Only Today's Word uses them: HSK 5 is not a study
 * set. The word itself lives in the full dictionary, so `entry` says where
 * to open it: its full-dictionary word, or its character if it is a
 * single-character word.
 */
export interface Hsk5Word {
  hanzi: string
  /** Exam pinyin from the HSK list, like the HSK 1-4 words. */
  pinyin: string
  meanings: Translations
  entry: { kind: 'character' | 'word'; id: string }
}

/** A vocabulary word, made of one or more characters. */
export interface Word {
  /**
   * Unique identifier: the word itself, e.g. "你好". If there are several
   * words with the same hanzi and different pronunciation (长 cháng "long" and
   * 长 zhǎng "to grow"), each one carries its pinyin: "长[cháng]" (see getWordId).
   */
  id: string
  hanzi: string
  /** Pinyin of the whole word with tone marks, e.g. "nǐ hǎo". */
  pinyin: string
  meanings: Translations
  /** HSK level. Words from the full dictionary that aren't in HSK 1-4 have none. */
  hskLevel?: HskLevel
  /** Traditional form of the word (CC-CEDICT): 柠檬 → "檸檬". */
  traditional?: string
  /** Position in a frequency list (1 = the most frequent). */
  frequencyRank?: number
}

/**
 * An example sentence from Tatoeba with its English translation. The ids
 * and authors of both sentences are kept so they can be attributed and linked.
 */
export interface ExampleSentence {
  tatoebaId: number
  zh: string
  /** Tatoeba user who wrote the Chinese sentence. */
  author: string
  en: string
  translationTatoebaId: number
  /** Author of the translation; some old translations have none (orphaned). */
  translationAuthor?: string
  /** Dataset words the sentence was chosen as an example for. */
  words: string[]
  /** Kept only because a grammar note quotes it: no word uses it as an example. */
  grammarOnly?: true
}

/** A level's examples file (public/examples/hsk1.json ... hsk4.json). */
export interface ExampleSet {
  source: 'Tatoeba'
  /** All Tatoeba sentences have this license (some are also CC0). */
  license: 'CC BY 2.0 FR'
  /** Date of the Tatoeba export used, "2026-09-26". */
  exportDate: string
  sentences: ExampleSentence[]
}
