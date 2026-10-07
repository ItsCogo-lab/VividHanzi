import { describe, expect, it } from 'vitest'
import { parseHskList } from './hsk.ts'

describe('parseHskList', () => {
  it("reads hanzi and pinyin and ignores the list's translations", () => {
    const json = JSON.stringify([{ id: 1, hanzi: '爱', pinyin: 'ài', translations: ['to love'] }])
    expect(parseHskList(json)).toEqual([{ hanzi: '爱', pinyin: 'ài' }])
  })

  it('fixes pinyin that would pick the wrong CC-CEDICT word', () => {
    const json = JSON.stringify([{ id: 1, hanzi: '过去', pinyin: 'guò qu', translations: ['(in the) past'] }])
    expect(parseHskList(json)).toEqual([{ hanzi: '过去', pinyin: 'guò qù' }])
  })

  it('fails if an entry has no hanzi or pinyin', () => {
    expect(() => parseHskList(JSON.stringify([{ id: 1, hanzi: '爱' }]))).toThrow(/entry 0/)
  })
})
