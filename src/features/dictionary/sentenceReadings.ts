import { getSyllableTone, splitSyllables } from '../../lib/tones.ts'
import type { SentenceToken } from '../customSets/types.ts'
import type { SentenceWord, WordIndex } from './segmentation.ts'

/**
 * Fills in the readings the pinyin engine wasn't sure of, in two steps.
 *
 * 1. The full dictionary (CC-CEDICT). The sentence is already split into
 *    dictionary words, so each uncertain character falls in one: if every
 *    entry written with that word's hanzi reads the character the same way
 *    (还 in 还是 is always "hái"), that reading is taken. A word with several
 *    readings (homographs) confirms the engine's reading only if it is one of
 *    them. 一 and 不 are only confirmed, never replaced: their tone changes
 *    with the next syllable, which the engine already applies.
 *
 * 2. A character that is a word on its own and has several readings (得 de /
 *    dé / děi) is where the dictionary can't help. For the most common ones,
 *    the textbook grammar rules below decide from the words around it; the
 *    rest stay uncertain.
 */
export function resolveReadings(
  tokens: readonly SentenceToken[],
  words: readonly SentenceWord[],
  index: WordIndex,
): SentenceToken[] {
  // Each character's word, its position in it, and the words around it
  const places: Place[] = []
  words.forEach((word, wordIndex) => {
    Array.from(word.text).forEach((_, position) =>
      places.push({
        word: word.text,
        position,
        before: words[wordIndex - 1]?.text ?? '',
        after: words[wordIndex + 1]?.text ?? '',
      }),
    )
  })

  let offset = 0
  return tokens.map((token) => {
    const place = places[offset]
    offset += Array.from(token.text).length
    if (!token.uncertain || !place) return token

    const reading = fromDictionary(token, place, index) ?? fromContext(token.text, place)
    const tone = reading === undefined ? undefined : getSyllableTone(reading)
    if (reading === undefined || tone === undefined) return token
    return { text: token.text, pinyin: reading, tone }
  })
}

interface Place {
  /** The dictionary word (or non-word text) the character is in. */
  word: string
  position: number
  /** The text of the previous and next pieces of the sentence ('' at the edges). */
  before: string
  after: string
}

const SANDHI_CHARACTERS = new Set(['一', '不'])

function fromDictionary(token: SentenceToken, place: Place, index: WordIndex): string | undefined {
  const readings = getReadingsAt(place.word, place.position, index)
  const engine = token.pinyin?.toLowerCase()
  if (readings.length === 1 && !SANDHI_CHARACTERS.has(token.text)) return readings[0]
  if (Array.from(place.word).length > 1 && engine !== undefined && readings.includes(engine)) return engine
  return undefined
}

/** The readings the dictionary gives to the character at `position` of this word, without duplicates. */
function getReadingsAt(word: string, position: number, index: WordIndex): string[] {
  const length = Array.from(word).length
  const readings = new Set<string>()
  for (const item of index.find(word)) {
    if (item.kind === 'character') {
      for (const reading of item.entry.pinyin) readings.add(reading.toLowerCase())
      continue
    }
    const syllables = splitSyllables(item.entry.pinyin.toLowerCase())
    // Entries whose pinyin doesn't split into one syllable per character can't be used
    if (syllables.length !== length) continue
    readings.add(syllables[position]!)
  }
  return [...readings]
}

const HAN = /\p{Script=Han}/u

/** Words after which 得 is the modal "must" (我得走 wǒ děi zǒu) rather than the complement particle. */
const BEFORE_DEI = new Set([
  '我', '你', '您', '他', '她', '它', '我们', '你们', '他们', '她们', '咱们', '大家', '谁',
  '也', '都', '还', '就', '总', '非', '又', '可',
  '今天', '明天', '后天', '今晚', '明晚', '现在', '以后', '马上',
])

/** Numbers and demonstratives before the measure word 只 zhī (两只猫); elsewhere it is zhǐ "only". */
const BEFORE_ZHI = new Set([...'一二两三四五六七八九十百千几这那每哪半多0123456789'])

/** Degree words before the adjective 长 cháng "long" (很长); the verb zhǎng "to grow" doesn't take them. */
const BEFORE_CHANG = new Set([...'很不太真多好最更较么样挺'])

/**
 * The reading of a common polyphonic character standing on its own, from
 * the grammar of the words around it, or undefined when there is no clear
 * rule for it.
 */
function fromContext(character: string, { word, before, after }: Place): string | undefined {
  if (word !== character) return undefined
  const previous = Array.from(before).at(-1) ?? ''
  const next = Array.from(after)[0] ?? ''
  const between = HAN.test(previous) && HAN.test(next)

  switch (character) {
    // Adverbial particle between a description and a verb: 慢慢地走
    case '地':
      return between ? 'de' : undefined
    // Modal after a subject or adverb (我得走), complement particle after a verb or adjective (说得好)
    case '得':
      if (!between) return undefined
      return BEFORE_DEI.has(before) ? 'děi' : 'de'
    // "To give back" with what is returned (还钱) or at the end (有借有还); otherwise "still, also"
    case '还':
      if (next === '回') return undefined
      return !HAN.test(next) || '给钱书'.includes(next) ? 'huán' : 'hái'
    case '只':
      return BEFORE_ZHI.has(previous) ? 'zhī' : 'zhǐ'
    case '长':
      return BEFORE_CHANG.has(previous) ? 'cháng' : undefined
    // "Empty" (冰箱空了); "vacant, free" kòng mostly lives in words (有空), but 空着 can be either
    case '空':
      return next === '着' ? undefined : 'kōng'
    // On their own, the verb "to teach", "convenient / then" and "side"; the other readings live in words (教室, 便宜)
    case '教':
      return 'jiāo'
    case '便':
      return 'biàn'
    case '边':
      return 'biān'
    default:
      return undefined
  }
}
