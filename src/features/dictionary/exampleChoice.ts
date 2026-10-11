/**
 * Rules for choosing example sentences, shared by the dataset build (local
 * HSK sentences) and the runtime (Tatoeba API).
 *
 * Shortest sentences are the easiest to read, but the very shortest are
 * often the word on its own ("完成了！", "完成了。"), which shows nothing
 * about how it is used. So sentences that add some context come first, and
 * sentences that only differ in punctuation count once.
 */

const HAN = /\p{Script=Han}/gu;

/** Chinese characters a sentence must add to the word to count as showing it in use. */
export const MIN_CONTEXT_CHARACTERS = 4;

function hanCount(text: string): number {
  return text.match(HAN)?.length ?? 0;
}

/** Whether a sentence has enough around the word to show how it is used. */
export function givesContext(sentence: string, word: string): boolean {
  return hanCount(sentence) - hanCount(word) >= MIN_CONTEXT_CHARACTERS;
}

/** The sentence without punctuation or spaces: "完成了！" and "完成了。" are the same sentence. */
function sentenceKey(sentence: string): string {
  return sentence.replace(/[\p{P}\p{S}\s]/gu, "");
}

/**
 * Orders candidates for a word: those that give context first, keeping the
 * incoming order otherwise, and drops sentences that repeat an earlier one
 * except for punctuation.
 */
export function rankExamples<T>(
  candidates: readonly T[],
  word: string,
  textOf: (candidate: T) => string,
): T[] {
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    const key = sentenceKey(textOf(candidate));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    ...unique.filter((candidate) => givesContext(textOf(candidate), word)),
    ...unique.filter((candidate) => !givesContext(textOf(candidate), word)),
  ];
}
