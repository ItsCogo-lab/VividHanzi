/**
 * Function that returns a number between 0 (inclusive) and 1 (exclusive), like
 * Math.random. It is passed as a parameter so tests can use a fixed sequence
 * and always get the same result.
 */
export type RandomFn = () => number

/** Returns a shuffled copy of the array (Fisher-Yates algorithm). */
export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/** Picks `count` distinct elements at random (or all of them, if there are fewer). */
export function sample<T>(items: readonly T[], count: number, random: RandomFn = Math.random): T[] {
  return shuffle(items, random).slice(0, count)
}

/**
 * Seeded pseudorandom generator (mulberry32): the same seed always
 * produces the same sequence. Tests use it, and so does Today's Word.
 */
export function seededRandom(seed: number): RandomFn {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
