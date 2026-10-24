import { describe, expect, it } from 'vitest'
import { createDictionaryStore } from '../dictionary/dictionaryStore.ts'
import { hskDictionary } from '../dictionary/hskDictionary.ts'
import { getWordHskLevel } from './wordEntry.ts'
import { displayPinyin, findSentenceWith, getWordTones, groupReadings, groupWords, isReadingsOwner, parseReadings, readingText } from './reading.ts'
import { TEST_READING_JSON } from './testReading.ts'

describe('parseReadings', () => {
  it('reads one reading with compact words', () => {
    const [reading] = parseReadings(TEST_READING_JSON)
    expect(reading?.unit).toBe('2')
    expect(reading?.title.words[1]).toEqual({ text: '喜欢', pinyin: 'xǐ huan', meaning: 'to like' })
    expect(reading?.title.words[2]).toEqual({ text: '“' })
    expect(reading?.level).toBe(4)
    expect(reading?.paragraphs[1]?.speaker?.translation).toBe('Teacher')
    expect(readingText(reading!)).toBe('我喜欢“快”我很忙。快点儿！老师价格怎么样？你忙吗？价格')
  })

  it('reads a saved reading back, with words as objects', () => {
    const [reading] = parseReadings(TEST_READING_JSON)
    expect(parseReadings(JSON.stringify(reading))).toEqual([reading])
  })

  it('finds the sentence of the text that uses a word', () => {
    const [reading] = parseReadings(TEST_READING_JSON)
    expect(findSentenceWith(reading!, '价格')?.translation).toBe('How is the price?')
    expect(findSentenceWith(reading!, '葡萄')).toBeUndefined()
  })

  it('reads a list and turns a numeric unit into text', () => {
    const one = JSON.parse(TEST_READING_JSON)
    const readings = parseReadings(JSON.stringify([one, { ...one, unit: 3 }]))
    expect(readings.map((reading) => reading.unit)).toEqual(['2', '3'])
  })

  it('says where a word has the wrong number of syllables', () => {
    const bad = JSON.parse(TEST_READING_JSON)
    bad.paragraphs[0][0].words[2] = ['忙', 'máng lù', 'busy']
    expect(() => parseReadings(JSON.stringify(bad))).toThrow(/paragraph 1, sentence 1: "忙" has 1 hanzi/)
  })

  it('rejects words without a meaning and broken JSON', () => {
    const bad = JSON.parse(TEST_READING_JSON)
    bad.title.words[0] = ['我', 'wǒ']
    expect(() => parseReadings(JSON.stringify(bad))).toThrow(/"我" must be/)
    expect(() => parseReadings('{')).toThrow('This is not valid JSON.')
  })
})

describe('word tones and pinyin', () => {
  it('colors each hanzi by its syllable, without one for an erhua or punctuation', () => {
    expect(getWordTones({ text: '快点儿', pinyin: 'kuài diǎn r' })).toEqual([4, 3, undefined])
    expect(getWordTones({ text: '喜欢', pinyin: 'xǐ huan' })).toEqual([3, 5])
    expect(getWordTones({ text: '。' })).toEqual([undefined])
  })

  it('joins the erhua r to its syllable, and only it', () => {
    expect(displayPinyin('kuài diǎn r')).toBe('kuài diǎnr')
    expect(displayPinyin('lǎo rén')).toBe('lǎo rén')
  })

  it('keeps punctuation with its word', () => {
    const [reading] = parseReadings(TEST_READING_JSON)
    const groups = groupWords(reading!.title.words).map((group) => group.map(({ word }) => word.text).join(''))
    expect(groups).toEqual(['我', '喜欢', '“快”'])
  })
})

describe('groupReadings', () => {
  it('orders books, units numerically and readings by position', () => {
    const summary = (id: string, book: string, unit: string, position?: number) => ({
      id,
      book,
      unit,
      ...(position !== undefined && { position }),
      title: id,
      titleTranslation: '',
    })
    const shelves = groupReadings([
      summary('c', 'B', '10'),
      summary('b', 'B', '2', 2),
      summary('a', 'B', '2', 1),
      summary('d', 'A', '1'),
    ])
    expect(shelves.map((shelf) => shelf.book)).toEqual(['A', 'B'])
    expect(shelves[1]?.units.map((unit) => [unit.unit, unit.readings.map((reading) => reading.id)])).toEqual([
      ['2', ['a', 'b']],
      ['10', ['c']],
    ])
  })
})

describe('isReadingsOwner', () => {
  it('only accepts the owner account', async () => {
    expect(await isReadingsOwner('arnaucomerma@proton.me')).toBe(true)
    expect(await isReadingsOwner(' ArnauComerma@Proton.me ')).toBe(true)
    expect(await isReadingsOwner('someone@example.com')).toBe(false)
    expect(await isReadingsOwner(null)).toBe(false)
  })
})

describe('getWordHskLevel', () => {
  it('finds the HSK word even with the tone change of 一 or 不', () => {
    const index = createDictionaryStore(hskDictionary, async () => ({ characters: [], words: [] })).wordIndex
    expect(getWordHskLevel(index, { text: '很', pinyin: 'hěn' })).toBe(1)
    expect(getWordHskLevel(index, { text: '一', pinyin: 'yì' })).toBe(1)
    expect(getWordHskLevel(index, { text: '不', pinyin: 'bú' })).toBe(1)
    expect(getWordHskLevel(index, { text: '王静', pinyin: 'Wáng Jìng' })).toBeUndefined()
  })
})
