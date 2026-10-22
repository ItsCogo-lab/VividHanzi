/**
 * A text to read, Du Chinese style: split into words, each with its pinyin
 * and its meaning in that sentence, and each sentence with its translation.
 * Readings are private to their owner (Supabase, see supabase/readings.sql),
 * never part of the repository.
 */

/**
 * A piece of a sentence. A word has its pinyin (one syllable per character,
 * "r" for an erhua 儿) and its meaning in this sentence; punctuation, numbers
 * and other text that isn't a word have neither.
 */
export interface ReadingWord {
  text: string
  pinyin?: string
  meaning?: string
}

export interface ReadingSentence {
  words: ReadingWord[]
  translation: string
}

/** A paragraph, or a line of a dialogue with who says it ("售货员"). */
export interface ReadingParagraph {
  speaker?: ReadingSentence
  sentences: ReadingSentence[]
}

export interface Reading {
  /** Book it comes from, e.g. "HSK 标准教程 4 上". */
  book: string
  /** HSK level of the book: words to learn go to that level's book set. */
  level?: number
  /** Unit inside the book, e.g. "1" or "Lesson 3". */
  unit: string
  /** Number of the text inside the unit (课文 1, 2, 3...). */
  position?: number
  title: ReadingSentence
  paragraphs: ReadingParagraph[]
  /** Questions about the text, to copy out (there is nothing to answer in the app). */
  questions?: ReadingSentence[]
}

/** What the library lists, without the whole text. */
export interface ReadingSummary {
  id: string
  book: string
  unit: string
  position?: number
  title: string
  titleTranslation: string
}
