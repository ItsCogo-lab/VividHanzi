import { describe, expect, it } from 'vitest'
import { cmnEngLinksFixture, cmnSentencesFixture, engSentencesFixture } from '../fixtures/tatoeba.ts'
import {
  isUsableSentence,
  parseLinkLine,
  parseSentenceLine,
  selectExamples,
  type TatoebaSentence,
} from './tatoeba.ts'

function sentences(text: string): Map<number, TatoebaSentence> {
  const parsed = text.split('\n').map(parseSentenceLine)
  return new Map(parsed.filter((sentence) => sentence !== undefined).map((sentence) => [sentence.id, sentence]))
}

function links(text: string): Map<number, number[]> {
  const result = new Map<number, number[]>()
  for (const [from, to] of text.split('\n').map(parseLinkLine).filter((link) => link !== undefined)) {
    result.set(from, [...(result.get(from) ?? []), to])
  }
  return result
}

const chinese = sentences(cmnSentencesFixture)
const english = sentences(engSentencesFixture)
const translations = links(cmnEngLinksFixture)

describe('Tatoeba adapter', () => {
  it('reads sentence and link lines', () => {
    expect(chinese.get(8934441)).toEqual({ id: 8934441, text: '柠檬很酸。', author: 'iiujik' })
    expect(english.get(29487)).toEqual({ id: 29487, text: 'Lemon is sour.' })
    expect(parseLinkLine('8934441\t29487')).toEqual([8934441, 29487])
    expect(parseSentenceLine('x\tcmn\t\t\\N')).toBeUndefined()
  })

  it('only accepts short sentences with known characters and no Latin letters', () => {
    const known = new Set(Array.from('柠檬很酸'))
    expect(isUsableSentence('柠檬很酸。', known)).toBe(true)
    expect(isUsableSentence('柠檬很酸，很好。', known)).toBe(false)
    expect(isUsableSentence('Tom很酸。', known)).toBe(false)
  })

  it('chooses the Tatoeba sentence for 柠檬 with its translation and attribution', () => {
    const examples = selectExamples({
      words: ['柠檬'],
      knownCharacters: new Set(Array.from('柠檬很酸')),
      chinese,
      english,
      translations,
    })
    expect(examples).toEqual([
      {
        tatoebaId: 8934441,
        zh: '柠檬很酸。',
        author: 'iiujik',
        en: 'Lemon is sour.',
        translationTatoebaId: 29487,
        words: ['柠檬'],
      },
    ])
  })

  it('gathers in one sentence all the words it was chosen for', () => {
    const examples = selectExamples({
      words: ['谢谢', '你'],
      knownCharacters: new Set(Array.from('谢你')),
      chinese,
      english,
      translations,
    })
    expect(examples.map(({ tatoebaId, en, words }) => ({ tatoebaId, en, words }))).toEqual([
      { tatoebaId: 374825, en: 'Thank you!', words: ['谢谢', '你'] },
    ])
  })

  it('keeps sentences quoted by grammar notes even if no word picks them', () => {
    const examples = selectExamples({
      words: ['谢谢'],
      knownCharacters: new Set(Array.from('谢你柠檬很酸')),
      chinese,
      english,
      translations,
      keep: new Set([8934441, 999999999]),
    })
    expect(examples.map(({ tatoebaId, words, grammarOnly }) => ({ tatoebaId, words, grammarOnly }))).toEqual([
      { tatoebaId: 374825, words: ['谢谢'], grammarOnly: undefined },
      { tatoebaId: 8934441, words: [], grammarOnly: true },
    ])
  })

  it('does not use orphaned Chinese sentences', () => {
    const examples = selectExamples({
      words: ['你们'],
      knownCharacters: new Set(Array.from('你们好吗')),
      chinese,
      english,
      translations,
    })
    expect(examples).toEqual([])
  })
})
