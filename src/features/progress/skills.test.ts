import { describe, expect, it } from 'vitest'
import { createEmptyProgress, recordAnswer, recordWritingAnswer } from './progress.ts'
import { getSkillStreak, nextSkillStats, summarizeSkills } from './skills.ts'

const now = new Date(2026, 9, 4, 12)

describe('nextSkillStats', () => {
  it('counts answers and correct answers in a row, resetting the streak on a miss', () => {
    let stats = nextSkillStats(undefined, true)
    stats = nextSkillStats(stats, true)
    expect(stats).toEqual({ correct: 2, wrong: 0, streak: 2 })
    expect(nextSkillStats(stats, false)).toEqual({ correct: 2, wrong: 1, streak: 0 })
  })
})

describe('recordAnswer with a skill', () => {
  it('keeps one record per skill on the item and leaves the others alone', () => {
    let progress = recordAnswer(createEmptyProgress(), 'word:你好', true, now, { meaning: true })
    progress = recordAnswer(progress, 'word:你好', false, now, { tones: false })
    progress = recordAnswer(progress, 'word:你好', true, now)

    expect(progress.items['word:你好']?.skills).toEqual({
      meaning: { correct: 1, wrong: 0, streak: 1 },
      tones: { correct: 0, wrong: 1, streak: 0 },
    })
    expect(getSkillStreak(progress, 'word:你好', 'meaning')).toBe(1)
    expect(getSkillStreak(progress, 'word:你好', 'pinyin')).toBe(0)
  })
})

describe('recordAnswer with several skills', () => {
  it('a flashcard known only in pinyin is a miss but keeps each skill apart', () => {
    const progress = recordAnswer(createEmptyProgress(), 'word:你好', false, now, { pinyin: true, meaning: false })
    const record = progress.items['word:你好']!
    expect(record.masteryLevel).toBe(0)
    expect(record.skills).toEqual({ pinyin: { correct: 1, wrong: 0, streak: 1 }, meaning: { correct: 0, wrong: 1, streak: 0 } })
  })
})

describe('summarizeSkills', () => {
  it('adds up each skill across items; writing comes from the writing records', () => {
    let progress = createEmptyProgress()
    progress = recordAnswer(progress, 'word:你好', true, now, { pinyin: true })
    progress = recordAnswer(progress, 'word:你好', true, now, { pinyin: true })
    progress = recordAnswer(progress, 'word:谢谢', false, now, { pinyin: false })
    progress = recordWritingAnswer(progress, 'word:你好', true, now)
    progress = recordWritingAnswer(progress, 'word:你好', true, now)

    const bySkill = Object.fromEntries(summarizeSkills(progress).map((summary) => [summary.skill, summary]))
    expect(bySkill.pinyin).toMatchObject({ practiced: 2, solid: 1, answers: 3, correct: 2, accuracy: 2 / 3 })
    expect(bySkill.writing).toMatchObject({ practiced: 1, solid: 1, answers: 2, accuracy: 1 })
    expect(bySkill.tones).toMatchObject({ practiced: 0, solid: 0, answers: 0, accuracy: undefined })
  })
})
