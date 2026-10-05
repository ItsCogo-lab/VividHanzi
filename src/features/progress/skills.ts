import type { ExerciseType } from '../practice/types.ts'
import type { ItemProgress, ProgressData } from './types.ts'

/**
 * What an exercise trains. Spaced repetition still has one recognition
 * level per item (plus writing apart), but each skill keeps its own record so
 * the user can see where they are weaker and sessions can practice that more.
 */
export type Skill = 'meaning' | 'pinyin' | 'tones' | 'writing'

export const SKILLS: readonly Skill[] = ['meaning', 'pinyin', 'tones', 'writing']

/** Skills trained by recognition exercises; writing has its own record (ProgressData.writing). */
export type RecognitionSkill = Exclude<Skill, 'writing'>

export const EXERCISE_SKILLS: Record<ExerciseType, Skill> = {
  flashcard: 'meaning',
  'meaning-choice': 'meaning',
  'hanzi-choice': 'meaning',
  'pinyin-choice': 'pinyin',
  'tone-choice': 'tones',
  'match-pinyin': 'pinyin',
  'match-meaning': 'meaning',
  writing: 'writing',
}

/** How an answer went in each skill it tested: one skill for most exercises, two for a flashcard. */
export type SkillResults = Partial<Record<RecognitionSkill, boolean>>

/** One item's record for one skill. */
export interface SkillStats {
  correct: number
  wrong: number
  /** Correct answers in a row since the last miss. */
  streak: number
}

/**
 * Correct answers in a row from which a skill counts as solid for an item.
 * For writing this is its mastery level, which also goes up one per correct
 * answer and back to 0 on a miss.
 */
export const SOLID_STREAK = 2

export function nextSkillStats(previous: SkillStats | undefined, correct: boolean): SkillStats {
  return {
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (previous?.wrong ?? 0) + (correct ? 0 : 1),
    streak: correct ? (previous?.streak ?? 0) + 1 : 0,
  }
}

/** Correct answers in a row of an item in a skill (0 if never practiced). */
export function getSkillStreak(progress: ProgressData, itemId: ItemProgress['itemId'], skill: Skill): number {
  if (skill === 'writing') return progress.writing[itemId]?.masteryLevel ?? 0
  return progress.items[itemId]?.skills?.[skill]?.streak ?? 0
}

export interface SkillSummary {
  skill: Skill
  /** Items answered at least once in this skill. */
  practiced: number
  /** Practiced items with SOLID_STREAK or more correct answers in a row. */
  solid: number
  answers: number
  correct: number
  /** Share of correct answers (0-1), or `undefined` without answers. */
  accuracy: number | undefined
}

/** How each skill is going, across all items. */
export function summarizeSkills(progress: ProgressData): SkillSummary[] {
  return SKILLS.map((skill) => {
    const records =
      skill === 'writing'
        ? Object.values(progress.writing).flatMap((item) =>
            item ? [{ correct: item.timesCorrect, wrong: item.timesWrong, streak: item.masteryLevel }] : [],
          )
        : Object.values(progress.items).flatMap((item) => item?.skills?.[skill] ?? [])

    let answers = 0
    let correct = 0
    for (const record of records) {
      answers += record.correct + record.wrong
      correct += record.correct
    }
    return {
      skill,
      practiced: records.length,
      solid: records.filter((record) => record.streak >= SOLID_STREAK).length,
      answers,
      correct,
      accuracy: answers > 0 ? correct / answers : undefined,
    }
  })
}
