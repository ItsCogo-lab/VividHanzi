import type { StudyItem } from '../dictionary/studyItem.ts'
import { numberedSyllableToToneMarks, removeToneMarks } from '../../lib/pinyin.ts'
import { sample, shuffle } from '../../lib/random.ts'
import { getSyllableTone, splitSyllables, type Tone } from '../../lib/tones.ts'
import { CHOICE_OPTION_COUNT, getReadings } from './choiceExercises.ts'
import type { ExerciseDefinition } from './exerciseDefinitions.ts'
import type { ToneExercise } from './types.ts'

/**
 * The reading asked about, lowercased (a capital in Běi jīng would only
 * mark the right option). `undefined` for characters with several readings:
 * 了 is le and liǎo, so "liǎo" would be a wrong option that is also right.
 */
export function getToneReading(item: StudyItem): string | undefined {
  const readings = getReadings(item)
  return readings.length === 1 ? readings[0]!.toLowerCase() : undefined
}

/** The reading without tone marks, as the question shows it: "nǐ hǎo" → "ni hao". */
export function getTonelessReading(item: StudyItem): string {
  return removeToneMarks(getToneReading(item) ?? '')
}

/** "hǎo" with tone 4 → "hào"; tone 5 (neutral) → "hao". */
function withTone(syllable: string, tone: Tone): string {
  return numberedSyllableToToneMarks(`${removeToneMarks(syllable)}${tone}`)
}

/**
 * Wrong spellings of a reading: each one changes the tone of one syllable,
 * which is the mistake learners actually make. The neutral tone only goes on
 * later syllables (xiè xie), never on the first one, where it doesn't occur.
 * Pieces that aren't syllables with a known tone (the "r" of 一会儿) stay as
 * they are.
 */
export function getToneDistractors(reading: string): string[] {
  const syllables = splitSyllables(reading)
  const distractors = new Set<string>()
  syllables.forEach((syllable, index) => {
    const tone = getSyllableTone(syllable)
    if (tone === undefined) return
    const alternatives: Tone[] = index === 0 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]
    for (const other of alternatives) {
      if (other !== tone) distractors.add(syllables.with(index, withTone(syllable, other)).join(' '))
    }
  })
  distractors.delete(reading)
  return [...distractors]
}

export const toneChoiceDefinition: ExerciseDefinition<ToneExercise> = {
  type: 'tone-choice',
  canBuild: (item) => {
    const reading = getToneReading(item)
    return reading !== undefined && getToneDistractors(reading).length >= CHOICE_OPTION_COUNT - 1
  },
  build: (item, _pool, random) => {
    const answer = getToneReading(item)!
    const distractors = sample(getToneDistractors(answer), CHOICE_OPTION_COUNT - 1, random)
    return { type: 'tone-choice', item, answer, options: shuffle([answer, ...distractors], random) }
  },
}
