import { describe, expect, it } from 'vitest'
import { createWordList, givesContext, rankExamples, standsAlone } from './exampleChoice.ts'

describe('givesContext', () => {
  it('needs a few characters besides the word', () => {
    expect(givesContext('完成了！', '完成')).toBe(false)
    expect(givesContext('我们完成了!', '完成')).toBe(false)
    expect(givesContext('我已经完成作业了。', '完成')).toBe(true)
  })
})

const words = createWordList(['我', '不', '接', '接受', '直接', '回家', '电话', '他', '来', '朋友', '受'])

describe('standsAlone', () => {
  it('finds the word only where longest match splits it out', () => {
    expect(standsAlone('接电话。', '接', words)).toBe(true)
    expect(standsAlone('直接回家。', '接', words)).toBe(false)
    expect(standsAlone('我不接受。', '接', words)).toBe(false)
    expect(standsAlone('我不接受。', '接受', words)).toBe(true)
  })

  it('treats the word itself as a word even if the list lacks it', () => {
    expect(standsAlone('他来接朋友。', '来接', words)).toBe(true)
  })
})

describe('rankExamples', () => {
  const rank = (sentences: string[]) => rankExamples(sentences, '完成', (sentence) => sentence)

  it('puts sentences with context first and keeps the order otherwise', () => {
    expect(rank(['完成了。', '我们完成了!', '我已经完成作业了。', '这个工作很难完成。'])).toEqual([
      '我已经完成作业了。',
      '这个工作很难完成。',
      '完成了。',
      '我们完成了!',
    ])
  })

  it('drops sentences that only differ in punctuation', () => {
    expect(rank(['完成了。', '完成了！', '完成了!'])).toEqual(['完成了。'])
  })

  it('puts sentences where the word stands on its own before those where it is part of another word', () => {
    const ranked = rankExamples(['接电话。', '直接回家。', '我不接受。', '他来接朋友。'], '接', (s) => s, words)
    expect(ranked).toEqual(['他来接朋友。', '接电话。', '直接回家。', '我不接受。'])
  })
})
