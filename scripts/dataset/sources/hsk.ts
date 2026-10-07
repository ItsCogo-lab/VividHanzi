/**
 * Adapter for the HSK 2.0 list from clem109/hsk-vocabulary (MIT).
 *
 * Responsibility: which words are in each level and their exam pinyin.
 * This list's translations are not used: the meanings come from CC-CEDICT.
 */

/**
 * Pinyin corrections, by hanzi. The list's pinyin picks the CC-CEDICT entry,
 * so a wrong neutral tone can select another word. Each fix is the CC-CEDICT
 * reading whose meanings are the ones the list itself gives for that word.
 * Found by comparing every neutral-tone word of HSK 1-5 with its toned
 * CC-CEDICT entries: only 过去 picked the wrong one.
 */
const PINYIN_FIXES: Record<string, { from: string; to: string }> = {
  // The list writes "guò qu" (CC-CEDICT: "(verb suffix)"), but its translations are
  // "(in the) past, former, to pass by": CC-CEDICT's guò qù entry
  过去: { from: 'guò qu', to: 'guò qù' },
}

export interface HskWord {
  hanzi: string
  /** Exam pinyin with tone marks, syllables separated by spaces: "nǐ hǎo". */
  pinyin: string
}

/** Reads a level's JSON (`hsk-level-1.json`). */
export function parseHskList(json: string): HskWord[] {
  const entries: unknown = JSON.parse(json)
  if (!Array.isArray(entries)) throw new Error('The HSK list must be a JSON array')
  return entries.map((entry: { hanzi?: unknown; pinyin?: unknown }, index) => {
    if (typeof entry.hanzi !== 'string' || typeof entry.pinyin !== 'string') {
      throw new Error(`HSK list: entry ${index} does not have hanzi and pinyin`)
    }
    const fix = PINYIN_FIXES[entry.hanzi]
    const pinyin = fix?.from === entry.pinyin ? fix.to : entry.pinyin
    return { hanzi: entry.hanzi, pinyin }
  })
}
