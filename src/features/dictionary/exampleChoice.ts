/**
 * Rules for choosing example sentences, shared by the dataset build (local
 * HSK sentences) and the runtime (Tatoeba API).
 *
 * Shortest sentences are the easiest to read, but the very shortest are
 * often the word on its own ("完成了！", "完成了。"), which shows nothing
 * about how it is used. And a sentence can contain the word's characters
 * only as part of a longer word (接 in 直接回家 is 直接 "directly"), which
 * shows nothing about the word itself. So sentences where the word stands
 * on its own come first, then those that add some context, and sentences
 * that only differ in punctuation count once.
 */

const HAN = /\p{Script=Han}/gu

/** Chinese characters a sentence must add to the word to count as showing it in use. */
export const MIN_CONTEXT_CHARACTERS = 4

function hanCount(text: string): number {
  return text.match(HAN)?.length ?? 0
}

/** Whether a sentence has enough around the word to show how it is used. */
export function givesContext(sentence: string, word: string): boolean {
  return hanCount(sentence) - hanCount(word) >= MIN_CONTEXT_CHARACTERS
}

/** The words a sentence is split into: the full CC-CEDICT at build time, HSK at runtime. */
export interface WordList {
  has: (hanzi: string) => boolean
  /** Length in characters of the longest word. */
  longest: number
}

export function createWordList(words: Iterable<string>): WordList {
  const set = new Set(words)
  let longest = 1
  for (const word of set) longest = Math.max(longest, Array.from(word).length)
  return { has: (hanzi) => set.has(hanzi), longest }
}

/**
 * Whether the word is one of the sentence's words when it is split by
 * longest match, as the entry page does (see segmentation.ts): 接 stands on
 * its own in 接电话 but not in 我不接受 (接受 "to accept").
 */
export function standsAlone(sentence: string, word: string, words: WordList): boolean {
  const symbols = Array.from(sentence)
  const isWord = (hanzi: string) => hanzi === word || words.has(hanzi)
  let position = 0
  while (position < symbols.length) {
    let length = Math.min(Math.max(words.longest, Array.from(word).length), symbols.length - position)
    while (length > 1 && !isWord(symbols.slice(position, position + length).join(''))) length--
    if (symbols.slice(position, position + length).join('') === word) return true
    position += length
  }
  return false
}

/** The sentence without punctuation or spaces: "完成了！" and "完成了。" are the same sentence. */
function sentenceKey(sentence: string): string {
  return sentence.replace(/[\p{P}\p{S}\s]/gu, '')
}

/**
 * Orders candidates for a word: those where it stands on its own first (if
 * a word list is given), then those that give context, keeping the incoming
 * order otherwise, and drops sentences that repeat an earlier one except for
 * punctuation.
 */
export function rankExamples<T>(
  candidates: readonly T[],
  word: string,
  textOf: (candidate: T) => string,
  words?: WordList,
): T[] {
  const seen = new Set<string>()
  const unique = candidates.filter((candidate) => {
    const key = sentenceKey(textOf(candidate))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const score = (candidate: T) => {
    const text = textOf(candidate)
    const alone = words === undefined || standsAlone(text, word, words)
    return (alone ? 0 : 2) + (givesContext(text, word) ? 0 : 1)
  }
  return unique
    .map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ candidate }) => candidate)
}
