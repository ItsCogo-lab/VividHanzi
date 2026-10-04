import { describe, expect, it } from 'vitest'
import type { SentenceToken } from '../customSets/types.ts'
import { createDictionary } from './dictionary.ts'
import { segmentSentence, type WordIndex } from './segmentation.ts'
import { resolveReadings } from './sentenceReadings.ts'
import { listStudyItems } from './studyItem.ts'
import type { Character, Word } from './types.ts'

const character = (hanzi: string, pinyin: string[]): Character => ({ id: hanzi, hanzi, pinyin, meanings: { en: [] } })
const word = (hanzi: string, pinyin: string, id = hanzi): Word => ({ id, hanzi, pinyin, meanings: { en: [] } })

const dictionary = createDictionary(
  [
    character('我', ['wǒ']),
    character('还', ['hái', 'huán']),
    character('得', ['de', 'dé', 'děi']),
    character('只', ['zhī', 'zhǐ']),
    character('长', ['cháng', 'zhǎng']),
    character('干', ['gān', 'gàn']),
    character('地', ['de', 'dì']),
    character('空', ['kōng', 'kòng']),
  ],
  [
    word('还是', 'hái shi'),
    word('对不起', 'duì bu qǐ'),
    word('得了', 'dé le', '得了[dé le]'),
    word('得了', 'de liǎo', '得了[de liǎo]'),
    word('说', 'shuō'),
    word('好', 'hǎo'),
    word('走', 'zǒu'),
    word('两', 'liǎng'),
    word('猫', 'māo'),
    word('慢慢', 'màn màn'),
    word('地', 'dì'),
    word('很', 'hěn'),
    word('没', 'méi'),
  ],
)
const items = listStudyItems(dictionary)
const index: WordIndex = {
  find: (hanzi) => items.filter((item) => item.entry.hanzi === hanzi),
  longest: () => 3,
}

/** Tokens as the engine would give them: `uncertain` lists the characters it wasn't sure of. */
function engineTokens(chinese: string, engine: Record<string, string>, uncertain: string): SentenceToken[] {
  return Array.from(chinese, (text) => {
    if (!/\p{Script=Han}/u.test(text)) return { text }
    return uncertain.includes(text) ? { text, pinyin: engine[text], uncertain: true } : { text, pinyin: engine[text] }
  })
}

/** "我:wǒ" per character, "?" if still uncertain. */
function resolve(chinese: string, engine: Record<string, string>, uncertain: string): string[] {
  const tokens = engineTokens(chinese, engine, uncertain)
  return resolveReadings(tokens, segmentSentence(chinese, index), index)
    .filter((token) => token.pinyin !== undefined || token.uncertain)
    .map((token) => `${token.text}:${token.uncertain ? '?' : token.pinyin}`)
}

describe('resolveReadings', () => {
  it('takes the reading of the only dictionary word the character is in', () => {
    expect(resolve('还是', { 还: 'huán', 是: 'shì' }, '还是')).toEqual(['还:hái', '是:shi'])
  })

  it('confirms the engine among homographs, but never replaces it with one of them', () => {
    expect(resolve('得了', { 得: 'dé', 了: 'le' }, '得了')).toEqual(['得:dé', '了:le'])
    expect(resolve('得了', { 得: 'děi', 了: 'le' }, '得了')).toEqual(['得:?', '了:le'])
  })

  it('only confirms 不, whose tone the engine already adapts to the next syllable', () => {
    expect(resolve('对不起', { 对: 'duì', 不: 'bu', 起: 'qǐ' }, '不')).toEqual(['对:duì', '不:bu', '起:qǐ'])
  })

  it('reads common polyphonic characters on their own from the words around them', () => {
    expect(resolve('说得好', { 说: 'shuō', 得: 'dé', 好: 'hǎo' }, '得')).toContain('得:de')
    expect(resolve('我得走', { 我: 'wǒ', 得: 'dé', 走: 'zǒu' }, '得')).toContain('得:děi')
    expect(resolve('慢慢地走', { 慢: 'màn', 地: 'dì', 走: 'zǒu' }, '地')).toContain('地:de')
    expect(resolve('两只猫', { 两: 'liǎng', 只: 'zhī', 猫: 'māo' }, '只')).toContain('只:zhī')
    expect(resolve('我只走', { 我: 'wǒ', 只: 'zhī', 走: 'zǒu' }, '只')).toContain('只:zhǐ')
    expect(resolve('我还没', { 我: 'wǒ', 还: 'hái', 没: 'méi' }, '还')).toContain('还:hái')
    expect(resolve('我还。', { 我: 'wǒ', 还: 'hái' }, '还')).toContain('还:huán')
    expect(resolve('很长', { 很: 'hěn', 长: 'zhǎng' }, '长')).toContain('长:cháng')
    expect(resolve('空了', { 空: 'kòng', 了: 'le' }, '空')).toContain('空:kōng')
  })

  it('leaves uncertain what no rule decides', () => {
    expect(resolve('我长', { 我: 'wǒ', 长: 'cháng' }, '长')).toContain('长:?')
    expect(resolve('没干', { 没: 'méi', 干: 'gān' }, '干')).toContain('干:?')
  })
})
