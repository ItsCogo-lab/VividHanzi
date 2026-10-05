import { describe, expect, it } from 'vitest'
import { ningCharacter, ningmengWord } from '../../src/features/dictionary/testData.ts'
import { cedictFixture } from './fixtures/cedict.ts'
import { makeMeAHanziFixture } from './fixtures/makemeahanzi.ts'
import { cjkRadicalsFixture, unihanIrgSourcesFixture, unihanVariantsFixture } from './fixtures/unihan.ts'
import { buildBaseEntries, buildFullEntries, buildHsk5Words, crossCheckCharacter, enrichCharacter } from './fusion.ts'
import { createCedictIndex } from './sources/cedict.ts'
import { parseMakeMeAHanzi } from './sources/makemeahanzi.ts'
import { loadUnihan } from './sources/unihan.ts'

const cedict = createCedictIndex(cedictFixture)

describe('buildBaseEntries', () => {
  it('creates the word and its characters with CC-CEDICT data', () => {
    const { characters, words, problems } = buildBaseEntries([{ level: 1, words: [{ hanzi: '柠檬', pinyin: 'níng méng' }] }], cedict)

    expect(problems).toEqual(['Character 檬 [méng] (in 柠檬): no reading in CC-CEDICT'])
    expect(words).toEqual([ningmengWord])
    expect(characters).toEqual([
      { id: '柠', hanzi: '柠', pinyin: ['níng'], meanings: { en: ['used in 柠檬'] }, hskLevel: 1 },
    ])
  })

  it('leaves out words that are not in CC-CEDICT instead of making them up, and says so', () => {
    const { problems } = buildBaseEntries([{ level: 1, words: [{ hanzi: '好', pinyin: 'hào' }] }], cedict)
    expect(problems).toEqual([])
    const missing = buildBaseEntries([{ level: 3, words: [{ hanzi: '好', pinyin: 'hā' }] }], cedict)
    expect(missing.words).toEqual([])
    expect(missing.characters).toEqual([])
    expect(missing.leftOut).toEqual(['好 [hā] (HSK 3)'])
  })
  it('merges several levels: each character stays at the first level it appears in', () => {
    const { characters, words } = buildBaseEntries(
      [
        { level: 1, words: [{ hanzi: '好', pinyin: 'hǎo' }] },
        { level: 2, words: [{ hanzi: '柠檬', pinyin: 'níng méng' }, { hanzi: '好', pinyin: 'hào' }] },
      ],
      cedict,
    )
    expect(words.map((word) => [word.id, word.hskLevel])).toEqual([
      ['好[hǎo]', 1],
      ['柠檬', 2],
      ['好[hào]', 2],
    ])
    expect(characters.find((character) => character.hanzi === '好')).toMatchObject({
      pinyin: ['hǎo', 'hào'],
      hskLevel: 1,
    })
    expect(characters.find((character) => character.hanzi === '柠')?.hskLevel).toBe(2)
  })

  it('puts general meanings first if the character is also used in lowercase', () => {
    const fixture = createCedictIndex(
      JSON.stringify([
        { traditional: '京', simplified: '京', pinyin: 'Jing1', english: ['Jing ethnic minority'] },
        { traditional: '京', simplified: '京', pinyin: 'jing1', english: ['capital city of a country'] },
        { traditional: '北', simplified: '北', pinyin: 'bei3', english: ['north'] },
        { traditional: '北京', simplified: '北京', pinyin: 'Bei3 jing1', english: ['Beijing'] },
        { traditional: '京劇', simplified: '京剧', pinyin: 'Jing1 ju4', english: ['Beijing opera'] },
        { traditional: '劇', simplified: '剧', pinyin: 'ju4', english: ['drama'] },
      ]),
    )
    const onlyProper = buildBaseEntries([{ level: 4, words: [{ hanzi: '京剧', pinyin: 'Jīng jù' }] }], fixture)
    expect(onlyProper.characters[0]!.meanings.en).toEqual(['Jing ethnic minority', 'capital city of a country'])

    const mixed = buildBaseEntries(
      [
        { level: 1, words: [{ hanzi: '北京', pinyin: 'Běi jīng' }] },
        { level: 4, words: [{ hanzi: '京剧', pinyin: 'Jīng jù' }] },
      ],
      fixture,
    )
    expect(mixed.characters.find((character) => character.hanzi === '京')!.meanings.en).toEqual([
      'capital city of a country',
      'Jing ethnic minority',
    ])
  })

  it('stores only once the words the list repeats with the same pinyin', () => {
    const { words, duplicates } = buildBaseEntries(
      [{ level: 4, words: [{ hanzi: '好', pinyin: 'hǎo' }, { hanzi: '好', pinyin: 'hǎo' }] }],
      cedict,
    )
    expect(words.map((word) => word.id)).toEqual(['好'])
    expect(duplicates).toEqual(['好 [hǎo] (HSK 4)'])
  })
})

describe('enrichCharacter', () => {
  const { characters } = buildBaseEntries([{ level: 1, words: [{ hanzi: '柠檬', pinyin: 'níng méng' }] }], cedict)
  const ning = characters[0]!
  const unihan = loadUnihan([unihanIrgSourcesFixture, unihanVariantsFixture], cjkRadicalsFixture, new Set(['柠']))
  const makeMeAHanzi = parseMakeMeAHanzi(makeMeAHanziFixture, new Set(['柠']))

  it('combines CC-CEDICT, Unihan and Make Me a Hanzi into the entry for 柠', () => {
    const enriched = enrichCharacter(ning, {
      unihan: unihan.get('柠'),
      makeMeAHanzi: makeMeAHanzi.get('柠'),
      hanziWriterStrokeCount: 9,
    })
    // The UI tests use this same object (testData.ts)
    expect(enriched).toEqual(ningCharacter)
    expect(enriched).toMatchObject({
      pinyin: ['níng'],
      traditional: ['檸'],
      radical: '木',
      radicalNumber: 75,
      decomposition: '⿰木宁',
      etymology: { type: 'pictophonetic', semantic: '木', phonetic: '宁' },
    })
  })

  it('adds the Unihan fields to 柠, without its stroke count', () => {
    expect(enrichCharacter(ning, { unihan: unihan.get('柠') })).toEqual({
      ...ning,
      radical: '木',
      radicalNumber: 75,
      traditional: ['檸'],
    })
  })

  it('takes the stroke count from hanzi-writer-data even if Unihan says otherwise', () => {
    const sources = { unihan: { strokeCount: 12 }, hanziWriterStrokeCount: 11 }
    expect(enrichCharacter(ning, sources).strokeCount).toBe(11)
  })

  it('adds no empty fields if a source does not have the character', () => {
    const enriched = enrichCharacter(ning, {})
    expect(enriched).toEqual(ning)
    expect(Object.values(enriched)).not.toContain(undefined)
  })
})

describe('crossCheckCharacter', () => {
  const unihan = { strokeCount: 9, radical: '木', radicalNumber: 75 }

  it('does not warn when the sources agree', () => {
    expect(
      crossCheckCharacter('柠', { unihan, makeMeAHanzi: { radical: '木' }, hanziWriterStrokeCount: 9 }),
    ).toEqual([])
  })

  it('does not warn when the radical is written in another form of the same Kangxi radical', () => {
    const person = { strokeCount: 5, radical: '人', radicalNumber: 9 }
    expect(crossCheckCharacter('X', { unihan: person, makeMeAHanzi: { radical: '亻' }, makeMeAHanziRadicalNumber: 9 })).toEqual([])
  })

  it('warns about disagreements without correcting them', () => {
    const conflicts = crossCheckCharacter('X', { unihan, makeMeAHanzi: { radical: '口' }, hanziWriterStrokeCount: 8 })
    expect(conflicts).toEqual([
      "X: Unihan says 9 strokes and hanzi-writer-data has 8. Using hanzi-writer-data's.",
      "X: the radical is 木 in Unihan and 口 in Make Me a Hanzi. Using Unihan's.",
    ])
  })
})

describe('buildFullEntries', () => {
  // Real CC-CEDICT lines (2025-12-13 edition)
  const fullCedict = createCedictIndex(
    JSON.stringify([
      { traditional: 'T恤', simplified: 'T恤', pinyin: 'T xu4', english: ['T-shirt'] },
      { traditional: '々', simplified: '々', pinyin: 'xx5', english: ['iteration mark (used to represent a duplicated character)'] },
      { traditional: '宏碁', simplified: '宏碁', pinyin: 'Hong2 ji1', english: ['Acer, Taiwanese computer hardware company'] },
      { traditional: '果', simplified: '果', pinyin: 'guo3', english: ['fruit', 'result', 'resolute', 'indeed', 'if really'] },
      { traditional: '苹', simplified: '苹', pinyin: 'ping2', english: ['(artemisia)', 'duckweed'] },
      { traditional: '蘋', simplified: '苹', pinyin: 'ping2', english: ['used in 蘋果|苹果[ping2 guo3]'] },
      { traditional: '蘋果', simplified: '苹果', pinyin: 'Ping2 guo3', english: ['Apple (American tech company)'] },
      { traditional: '蘋果', simplified: '苹果', pinyin: 'ping2 guo3', english: ['apple', 'CL:個|个[ge4],顆|颗[ke1]'] },
      { traditional: '檸', simplified: '柠', pinyin: 'ning2', english: ['used in 檸檬|柠檬[ning2 meng2]'] },
    ]),
  )
  const hsk = buildBaseEntries([{ level: 1, words: [{ hanzi: '苹果', pinyin: 'píng guǒ' }] }], fullCedict)
  const full = buildFullEntries(fullCedict, hsk)

  it('does not repeat what is already in HSK and separates other readings with their pinyin in the id', () => {
    expect(full.words).toEqual([
      {
        id: '苹果[Píng guǒ]',
        hanzi: '苹果',
        pinyin: 'Píng guǒ',
        meanings: { en: ['Apple (American tech company)'] },
        traditional: '蘋果',
      },
    ])
  })

  it('adds the characters not in HSK, without a level', () => {
    expect(full.characters).toEqual([{ id: '柠', hanzi: '柠', pinyin: ['níng'], meanings: { en: ['used in 柠檬'] } }])
  })

  it('leaves out what it cannot teach, and says why', () => {
    expect(full.leftOut).toEqual(['々: CC-CEDICT does not know its reading', '宏碁 [Hóng jī]: no entry for 宏, 碁'])
    expect(full.words.map((word) => word.hanzi)).not.toContain('T恤')
  })
})

describe('buildHsk5Words', () => {
  const index = createCedictIndex(
    JSON.stringify([
      { traditional: '好', simplified: '好', pinyin: 'hao3', english: ['good'] },
      { traditional: '好', simplified: '好', pinyin: 'hao4', english: ['to be fond of'] },
      { traditional: '學', simplified: '学', pinyin: 'xue2', english: ['to learn'] },
      { traditional: '生', simplified: '生', pinyin: 'sheng1', english: ['to be born'] },
      { traditional: '學生', simplified: '学生', pinyin: 'xue2 sheng5', english: ['student'] },
    ]),
  )
  const base = buildBaseEntries([{ level: 1, words: [{ hanzi: '好', pinyin: 'hǎo' }] }], index)
  const full = buildFullEntries(index, base)
  const hsk5 = buildHsk5Words(
    [
      { hanzi: '学生', pinyin: 'xué sheng' },
      { hanzi: '好', pinyin: 'hào' },
      { hanzi: '好', pinyin: 'hǎo' },
      { hanzi: '好', pinyin: 'hā' },
    ],
    index,
    base,
    full,
  )

  it('takes CC-CEDICT meanings and points each word to the dictionary entry that holds it', () => {
    expect(hsk5.words).toEqual([
      { hanzi: '学生', pinyin: 'xué sheng', meanings: { en: ['student'] }, entry: { kind: 'word', id: '学生' } },
      { hanzi: '好', pinyin: 'hào', meanings: { en: ['to be fond of'] }, entry: { kind: 'character', id: '好' } },
    ])
  })

  it('skips words already in HSK 1-4 and leaves out the ones CC-CEDICT does not have', () => {
    expect(hsk5.duplicates).toEqual(['好 [hǎo] (HSK 5)'])
    expect(hsk5.leftOut).toEqual(['好 [hā] (HSK 5)'])
  })
})
