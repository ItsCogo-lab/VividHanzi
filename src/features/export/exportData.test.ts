import { describe, expect, it } from 'vitest'
import type { CustomSet } from '../customSets/types.ts'
import type { StudyItemId } from '../dictionary/studyItem.ts'
import { applyHskLevel, createEmptyProgress, recordAnswer, recordWritingAnswer, setItemExcluded } from '../progress/progress.ts'
import { DEFAULT_SETTINGS } from '../settings/settings.ts'
import { buildDataExport, buildStudySummary, getWeakSkills, shortenMeaning, type ItemLabel } from './exportData.ts'

const now = new Date(2026, 9, 11, 10, 0)

const LABELS: Partial<Record<StudyItemId, ItemLabel>> = {
  'word:你好': { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello' },
  'word:谢谢': { hanzi: '谢谢', pinyin: 'xiè xie', meaning: 'thanks' },
  'word:再见': { hanzi: '再见', pinyin: 'zài jiàn', meaning: 'goodbye' },
  'char:好': { hanzi: '好', pinyin: 'hǎo', meaning: 'good' },
}
const describeItem = (itemId: StudyItemId) => LABELS[itemId]

function exampleProgress() {
  let progress = createEmptyProgress()
  progress = recordAnswer(progress, 'word:你好', true, now, { meaning: true, pinyin: true })
  progress = recordAnswer(progress, 'word:你好', true, now, { meaning: true, pinyin: true })
  for (let i = 0; i < 3; i++) progress = recordAnswer(progress, 'word:谢谢', false, now, { tones: false })
  progress = recordWritingAnswer(progress, 'char:好', true, now)
  progress = setItemExcluded(progress, 'word:再见', true, now)
  return progress
}

const exampleSet: CustomSet = {
  id: 'custom-1',
  name: 'Greetings | basics',
  description: 'Words for saying hi',
  itemIds: ['word:你好', 'word:谢谢'],
  meanings: {},
  sentences: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

describe('buildStudySummary', () => {
  const summary = buildStudySummary(exampleProgress(), DEFAULT_SETTINGS, [exampleSet], describeItem, now)

  it('gives an overview of answers and items', () => {
    expect(summary).toContain('# My Chinese study data (VividHanzi)')
    expect(summary).toContain('- Items studied: 2 (2 learning, 0 mastered)')
    expect(summary).toContain('- Answers: 6 total, 50% correct')
    expect(summary).toContain('- My HSK level: not set')
  })

  it('lists studied items weakest first, with their weak skills', () => {
    const table = summary.split('## Items I am learning')[1]!
    expect(table.indexOf('谢谢')).toBeLessThan(table.indexOf('你好'))
    expect(summary).toContain('| 谢谢 | xiè xie | thanks | word | 0 | 0 | 3 | 2026-10-11 | tones |')
    expect(summary).toContain('| 你好 | nǐ hǎo | hello | word | 2 | 2 | 0 | 2026-10-14 |  |')
  })

  it('lists difficult items, writing, excluded words and custom sets', () => {
    expect(summary.split('## Difficult items')[1]).toContain('| 谢谢 | xiè xie | thanks | 0 | 3 |')
    expect(summary.split('## Writing')[1]).toContain('| 好 | 1 | 1 | 0 |')
    expect(summary).toContain('## Words I chose not to learn\n\n再见')
    expect(summary).toContain('### Greetings | basics (2 items)\n\nWords for saying hi\n\n你好, 谢谢')
  })

  it('only counts items marked by HSK level and never answered', () => {
    const progress = applyHskLevel(exampleProgress(), [{ itemId: 'word:我', hskLevel: 1 }], 1, now)
    const text = buildStudySummary(progress, { ...DEFAULT_SETTINGS, hskLevel: 1 }, [], describeItem, now)
    expect(text).toContain('- Marked as known from my HSK level and never practiced: 1')
    expect(text.split('## Items I am learning')[1]).not.toContain('我')
  })

  it('falls back to the hanzi from the id for entries it cannot describe', () => {
    const progress = recordAnswer(createEmptyProgress(), 'word:苹果', true, now)
    expect(buildStudySummary(progress, DEFAULT_SETTINGS, [], () => undefined, now)).toContain('| 苹果 |  |  | word |')
  })

  it('keeps table rows intact when a cell has a |', () => {
    const progress = recordAnswer(createEmptyProgress(), 'word:你好', true, now)
    const text = buildStudySummary(progress, DEFAULT_SETTINGS, [], () => ({ hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hi | hello' }), now)
    expect(text).toContain('| hi / hello |')
  })
})

describe('getWeakSkills', () => {
  it('flags skills with more misses or missed last time', () => {
    const item = {
      ...exampleProgress().items['word:你好']!,
      skills: {
        meaning: { correct: 5, wrong: 1, streak: 3 },
        pinyin: { correct: 5, wrong: 1, streak: 0 },
        tones: { correct: 1, wrong: 2, streak: 1 },
      },
    }
    expect(getWeakSkills(item)).toEqual(['pinyin', 'tones'])
  })
})

describe('shortenMeaning', () => {
  it('joins the first three meanings and cuts long ones', () => {
    expect(shortenMeaning(['a', 'b', 'c', 'd'])).toBe('a; b; c')
    const long = shortenMeaning(['x'.repeat(100)])
    expect(long).toHaveLength(60)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('buildDataExport', () => {
  it('holds all saved data, ready for JSON', () => {
    const progress = exampleProgress()
    const data = buildDataExport(progress, DEFAULT_SETTINGS, [exampleSet], now)
    expect(JSON.parse(JSON.stringify(data))).toEqual({
      app: 'VividHanzi',
      version: 1,
      exportedAt: now.toISOString(),
      progress,
      settings: DEFAULT_SETTINGS,
      customSets: [exampleSet],
    })
  })
})
