import { describe, expect, it } from 'vitest'
import { cedictFixture } from '../fixtures/cedict.ts'
import { cleanMeaning, createCedictIndex, findEntries, readingOf, traditionalOf, usableMeanings } from './cedict.ts'

const index = createCedictIndex(cedictFixture)

describe('CC-CEDICT adapter', () => {
  it('groups by simplified form and converts the pinyin to tone marks', () => {
    expect(index.get('柠檬')).toEqual([{ traditional: '檸檬', simplified: '柠檬', pinyin: 'níng méng', english: ['lemon'] }])
  })

  it('looks up by hanzi and pinyin without mixing in proper nouns', () => {
    const entries = findEntries(index, '柠檬', 'níng méng')
    expect(usableMeanings(entries)).toEqual(['lemon'])
    expect(traditionalOf(entries)).toBe('檸檬')
  })

  it('respects the preferred traditional form (里 → 裡)', () => {
    expect(findEntries(index, '里', 'lǐ').map((entry) => entry.traditional)).toEqual(['裡'])
  })

  it('ignores entries that are only notes when choosing the traditional form', () => {
    const entries = index.get('里')!.filter((entry) => entry.pinyin === 'lǐ')
    expect(entries.map((entry) => entry.traditional)).toEqual(['裏', '裡'])
    expect(traditionalOf(entries)).toBe('裡')
  })

  it('does not choose a traditional form if CC-CEDICT gives two (回 and 迴)', () => {
    expect(traditionalOf(findEntries(index, '回', 'huí'))).toBeUndefined()
  })

  it('keeps the notes if a reading only has notes (柠: "used in 柠檬")', () => {
    expect(usableMeanings(findEntries(index, '柠', 'níng'))).toEqual(['used in 柠檬'])
  })

  it('puts first the traditional form most used in words (只 zhī: 隻 before 秖)', () => {
    const zhi = createCedictIndex(
      JSON.stringify([
        { traditional: '只', simplified: '只', pinyin: 'zhi3', english: ['only; merely; just'] },
        { traditional: '秖', simplified: '只', pinyin: 'zhi1', english: ['grain that has begun to ripen'] },
        { traditional: '隻', simplified: '只', pinyin: 'zhi1', english: ['classifier for birds and certain animals'] },
        { traditional: '一隻', simplified: '一只', pinyin: 'yi1 zhi1', english: ['one (animal)'] },
      ]),
    )
    expect(usableMeanings(findEntries(zhi, '只', 'zhī'))).toEqual([
      'classifier for birds and certain animals',
      'grain that has begun to ripen',
    ])
    // Readings keep their order
    expect(zhi.get('只')!.map((entry) => entry.pinyin)).toEqual(['zhǐ', 'zhī', 'zhī'])
  })

  it('moves the main meaning first when CC-CEDICT starts with a usage note (老 lǎo)', () => {
    const lao = createCedictIndex(
      JSON.stringify([
        { traditional: '老', simplified: '老', pinyin: 'lao3', english: ['prefix used before the surname of a person', 'old (of people)', 'experienced'] },
      ]),
    )
    expect(usableMeanings(findEntries(lao, '老', 'lǎo'))).toEqual(['old (of people)', 'prefix used before the surname of a person', 'experienced'])
  })

  it('cleans up the internal notation', () => {
    expect(cleanMeaning('used in 檸檬|柠檬[ning2 meng2]')).toBe('used in 柠檬')
  })

  it('finds the reading of a character within a word', () => {
    expect(readingOf(index, '好', 'hǎo')).toBe('hǎo')
    expect(readingOf(index, '柠', 'níng')).toBe('níng')
    expect(readingOf(index, '柠', 'nìng')).toBeUndefined()
  })

  it("accepts CC-CEDICT's neutral tone where the HSK list has the tone (关系 guān xì)", () => {
    expect(usableMeanings(findEntries(index, '关系', 'guān xì'))).toEqual(['relation', 'relationship'])
    expect(findEntries(index, '关系', 'guǎn xì')).toEqual([])
  })

  it('uses the readings CC-CEDICT marks with "also pr." (钥 yào)', () => {
    expect(readingOf(index, '钥', 'yào')).toBe('yào')
    expect(usableMeanings(findEntries(index, '钥', 'yào'))).toEqual(['key'])
    expect(readingOf(index, '钥', 'yǎo')).toBeUndefined()
  })
})
