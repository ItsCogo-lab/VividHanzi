import { describe, expect, it } from 'vitest'
import type { StudyItem } from '../dictionary/studyItem.ts'
import { seededRandom } from '../../test/random.ts'
import { getToneDistractors, getToneReading, getTonelessReading, toneChoiceDefinition } from './toneExercises.ts'

function character(hanzi: string, pinyin: string[]): StudyItem {
  return { kind: 'character', entry: { id: hanzi, hanzi, pinyin, meanings: { en: ['x'] }, hskLevel: 1 } }
}

function word(hanzi: string, pinyin: string): StudyItem {
  return { kind: 'word', entry: { id: hanzi, hanzi, pinyin, meanings: { en: ['x'] }, hskLevel: 1 } }
}

describe('getToneReading', () => {
  it('lowercases the reading so a capital does not mark the answer', () => {
    expect(getToneReading(word('北京', 'Běi jīng'))).toBe('běi jīng')
    expect(getTonelessReading(word('北京', 'Běi jīng'))).toBe('bei jing')
  })

  it('skips characters with several readings', () => {
    expect(getToneReading(character('了', ['le', 'liǎo']))).toBeUndefined()
    expect(toneChoiceDefinition.canBuild(character('了', ['le', 'liǎo']), [])).toBe(false)
  })

  it('keeps the ü', () => {
    expect(getTonelessReading(character('绿', ['lǜ']))).toBe('lü')
  })
})

describe('getToneDistractors', () => {
  it('gives the other three tones of a single syllable, without the neutral tone', () => {
    expect(getToneDistractors('hǎo').toSorted()).toEqual(['hāo', 'háo', 'hào'].toSorted())
  })

  it('changes one syllable at a time and allows the neutral tone after the first', () => {
    const distractors = getToneDistractors('xiè xie')
    expect(distractors).toContain('xiē xie')
    expect(distractors).toContain('xiè xiē')
    expect(distractors).not.toContain('xiè xie')
    expect(distractors.every((option) => option.split(' ').filter((syllable, index) => syllable !== ['xiè', 'xie'][index]).length === 1)).toBe(true)
    // 3 alternatives for the first syllable + 4 for the second
    expect(distractors).toHaveLength(7)
  })

  it('leaves pieces without a tone as they are', () => {
    expect(getToneDistractors('yī huì r').every((option) => option.endsWith(' r'))).toBe(true)
  })
})

describe('toneChoiceDefinition', () => {
  it('builds four different options with the answer among them', () => {
    const exercise = toneChoiceDefinition.build(word('你好', 'nǐ hǎo'), [], seededRandom(1))
    expect(exercise.answer).toBe('nǐ hǎo')
    expect(exercise.options).toHaveLength(4)
    expect(new Set(exercise.options).size).toBe(4)
    expect(exercise.options).toContain('nǐ hǎo')
    expect(exercise.options.every((option) => option.normalize('NFD').replace(/[̀-ͯ]/g, '') === 'ni hao')).toBe(true)
  })

  it('works for a neutral-tone character', () => {
    const exercise = toneChoiceDefinition.build(character('吗', ['ma']), [], seededRandom(2))
    expect(exercise.options).toContain('ma')
    expect(exercise.options).toHaveLength(4)
  })
})
