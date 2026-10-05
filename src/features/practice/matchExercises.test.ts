import { describe, expect, it } from 'vitest'
import { hskStudyItems } from '../dictionary/hskDictionary.ts'
import { getStudyItemId } from '../dictionary/studyItem.ts'
import { seededRandom } from '../../test/random.ts'
import { getMeaningLabel, getPinyinLabel } from './choiceExercises.ts'
import { matchMeaningDefinition, matchPinyinDefinition } from './matchExercises.ts'

const item = hskStudyItems.find((candidate) => candidate.entry.hanzi === '谢谢')!

describe.each([
  ['match-pinyin', matchPinyinDefinition, getPinyinLabel],
  ['match-meaning', matchMeaningDefinition, getMeaningLabel],
] as const)('%s', (_type, definition, label) => {
  it('pairs the item with three others, the same four on both sides', () => {
    const exercise = definition.build(item, hskStudyItems, seededRandom(3))
    const ids = (items: typeof exercise.items) => items.map(getStudyItemId).toSorted()

    expect(exercise.items).toHaveLength(4)
    expect(exercise.items).toContain(item)
    expect(ids(exercise.answers)).toEqual(ids(exercise.items))
  })

  it('never has two items with the same answer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const exercise = definition.build(item, hskStudyItems, seededRandom(seed))
      expect(new Set(exercise.items.map(label)).size).toBe(4)
    }
  })
})
