import { getSyllableTone, splitSyllables } from '../../lib/tones.ts'
import type { SentenceToken } from '../customSets/types.ts'
import { MAX_MEANING_LENGTH } from '../customSets/customSets.ts'
import { MAX_SENTENCE_LENGTH } from '../customSets/sentences.ts'
import { sentenceText } from './reading.ts'
import type { ReadingSentence } from './types.ts'

const HAN = /\p{Script=Han}/u

/**
 * A reading's sentence as a custom-set sentence, with the reading's own
 * pinyin (no engine needed). Too long for a set sentence → `undefined`.
 */
export function toSetSentence(sentence: ReadingSentence): { chinese: string; tokens: SentenceToken[] } | undefined {
  const chinese = sentenceText(sentence).trim()
  if ([...chinese].length > MAX_SENTENCE_LENGTH) return undefined
  const tokens: SentenceToken[] = []
  for (const word of sentence.words) {
    const syllables = splitSyllables(word.pinyin ?? '')
    let next = 0
    for (const character of word.text) {
      const last = tokens.at(-1)
      if (word.pinyin && HAN.test(character)) {
        const pinyin = syllables[next++] ?? ''
        const tone = getSyllableTone(pinyin)
        tokens.push({ text: character, pinyin, ...(tone !== undefined && { tone }) })
      } else if (last && !last.pinyin && !HAN.test(last.text)) last.text += character
      else tokens.push({ text: character })
    }
  }
  return { chinese, tokens }
}

/** The word's meaning in the text, as the set's note (cut to what a note allows). */
export function toSetMeaning(meaning: string): string {
  return meaning.trim().slice(0, MAX_MEANING_LENGTH)
}
