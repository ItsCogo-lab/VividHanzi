/**
 * Builds the VividHanzi dataset from open sources.
 *
 *   sources (.cache) → adapters (sources/) → fusion (fusion.ts) → validation → src/data
 *
 * Usage:
 *   npm run data:fetch   # downloads the sources (pinned versions)
 *   npm run data:build   # generates the data files
 *
 * The script makes nothing up: if something doesn't add up, it stops and says what.
 * Sources and licenses in docs/DATA_SOURCES.md.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { grammarPoints } from '../../src/data/grammar.ts'
import type { Character, ExampleSet, HskLevel, Word } from '../../src/features/dictionary/types.ts'
import { validateDictionaryData, validateExampleSet } from '../../src/features/dictionary/validation.ts'
import { strokeFileName } from '../../src/features/dictionary/strokes.ts'
import { CHUNK_COUNT, chunkFileName, getChunkIndex } from '../../src/features/dictionary/fullDictionary.ts'
import { buildBaseEntries, buildFullEntries, buildHsk5Words, crossCheckCharacter, enrichCharacter, type CharacterSources } from './fusion.ts'
import { DATA_RELEASE_DIR } from './dataRelease.ts'
import { createCedictIndex } from './sources/cedict.ts'
import { readStrokeData, type StrokeData } from './sources/hanziWriter.ts'
import { parseHskList } from './sources/hsk.ts'
import { parseMakeMeAHanzi } from './sources/makemeahanzi.ts'
import { parseLinkLine, parseSentenceLine, selectExamples, type TatoebaSentence } from './sources/tatoeba.ts'
import { loadUnihan, type UnihanCharacter } from './sources/unihan.ts'
import { parseWordfreq, withFrequencyRank } from './sources/wordfreq.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const cacheDir = join(scriptDir, '.cache')
const rootDir = join(scriptDir, '../..')
const dataDir = join(rootDir, 'src/data')
const strokesDir = join(rootDir, 'public/strokes')
const examplesDir = join(rootDir, 'public/examples')
const fullDictionaryDir = join(DATA_RELEASE_DIR, 'dictionary')
const conflictsReport = join(rootDir, 'docs/DATA_CONFLICTS.md')
const hanziWriterDataDir = join(rootDir, 'node_modules/hanzi-writer-data')

/*
 * `--without=unihan,tatoeba` builds the dataset without those sources. It is only
 * for testing the script where they cannot be downloaded (Claude's cloud
 * environment): the result must not be committed to the repository.
 */
const skippedSources = new Set(
  process.argv
    .find((arg) => arg.startsWith('--without='))
    ?.slice('--without='.length)
    .split(',') ?? [],
)
for (const source of skippedSources) {
  console.warn(`WARNING: building the dataset WITHOUT ${source}. Do not commit this result to the repository.`)
}

/** Reads a file downloaded by data:fetch, or stops explaining what is missing. */
function readSource(file: string): string {
  return readFileSync(sourcePath(file), 'utf8')
}

function sourcePath(file: string): string {
  const path = join(cacheDir, file)
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run "npm run data:fetch" (see docs/DATA_SOURCES.md).`)
    process.exit(1)
  }
  return path
}

/** Reads a large file line by line (Tatoeba's English sentences take up hundreds of MB). */
async function* readLines(file: string): AsyncGenerator<string> {
  yield* createInterface({ input: createReadStream(sourcePath(file), 'utf8'), crlfDelay: Infinity })
}

// --- Base sources: HSK list + CC-CEDICT ------------------------------------

/** HSK 2.0 levels that are generated, each in its own src/data/hsk<n>/ folder. */
const LEVELS: readonly HskLevel[] = [1, 2, 3, 4]

const hskLists = LEVELS.map((level) => ({ level, words: parseHskList(readSource(`hsk-level-${level}.json`)) }))
const cedict = createCedictIndex(readSource('cedict.json'))
const base = buildBaseEntries(hskLists, cedict)
const { problems, duplicates, leftOut } = base

// --- wordfreq: frequency rank (HSK 1-4 only) ------------------------------

const frequency = parseWordfreq(readSource('wordfreq-zh.tsv'))
const words = base.words.map((word) => withFrequencyRank(word, frequency.words))
const hanziSet = new Set(base.characters.map((character) => character.hanzi))

// The rest of CC-CEDICT, for the full dictionary (data repository, see dataRelease.ts)
const full = buildFullEntries(cedict, base)
const allHanzi = new Set([...hanziSet, ...full.characters.map((character) => character.hanzi)])

// HSK 5: only for Today's Word, pointing to entries that already exist (see buildHsk5Words)
const hsk5 = buildHsk5Words(parseHskList(readSource('hsk-level-5.json')), cedict, base, full)

// --- Make Me a Hanzi: decomposition and etymology ------------------------

const makeMeAHanzi = parseMakeMeAHanzi(readSource('makemeahanzi-dictionary.txt'), allHanzi)

// --- Unihan: radical, traditional ----------------------------------------
// Also read for Make Me a Hanzi's radicals, so radicals written in
// another form can be compared (亻 and 人 are radical 9).
const makeMeAHanziRadicals = new Set([...makeMeAHanzi.values()].map((entry) => entry.radical))
const unihan = skippedSources.has('unihan')
  ? new Map<string, UnihanCharacter>()
  : loadUnihan(
      [readSource('unihan/Unihan_IRGSources.txt'), readSource('unihan/Unihan_Variants.txt')],
      readSource('unihan/CJKRadicals.txt'),
      new Set([...allHanzi, ...makeMeAHanziRadicals]),
    )

// --- hanzi-writer-data: strokes (npm package pinned in package.json) -------

/*
 * HSK 1-4 strokes are copied to public/strokes/. For the rest only the stroke
 * count is used: copying the package's ~9,500 files would take about 40 MB.
 */
const strokeData = new Map<string, StrokeData>()
for (const hanzi of hanziSet) {
  const data = readStrokeData(hanziWriterDataDir, hanzi)
  if (data) strokeData.set(hanzi, data)
  else problems.push(`Character ${hanzi}: no stroke data in hanzi-writer-data`)
}
const fullStrokeCounts = new Map<string, number>()
for (const { hanzi } of full.characters) {
  const data = readStrokeData(hanziWriterDataDir, hanzi)
  if (data) fullStrokeCounts.set(hanzi, data.strokeCount)
}

// --- Fusion and cross-checks ----------------------------------------------

/** Adds the other sources' fields to a character and records disagreements in `conflicts`. */
function enrich(character: Character, strokeCount: number | undefined, conflicts: string[]): Character {
  const sources: CharacterSources = {
    unihan: unihan.get(character.hanzi),
    makeMeAHanzi: makeMeAHanzi.get(character.hanzi),
    hanziWriterStrokeCount: strokeCount,
  }
  const makeMeAHanziRadical = sources.makeMeAHanzi?.radical
  if (makeMeAHanziRadical !== undefined) {
    sources.makeMeAHanziRadicalNumber = unihan.get(makeMeAHanziRadical)?.radicalNumber
  }
  conflicts.push(...crossCheckCharacter(character.hanzi, sources))
  return enrichCharacter(character, sources)
}

const conflicts: string[] = []
const characters = base.characters.map((character) =>
  withFrequencyRank(enrich(character, strokeData.get(character.hanzi)?.strokeCount, conflicts), frequency.characters),
)
const fullConflicts: string[] = []
const fullCharacters = full.characters.map((character) =>
  enrich(character, fullStrokeCounts.get(character.hanzi), fullConflicts),
)

// --- Tatoeba: example sentences -------------------------------------------

/*
 * One sentence file per level. A level's sentences only use characters from
 * that level or earlier ones, so someone studying HSK 1 can read them
 * in full.
 */
const examplesByLevel = new Map<HskLevel, ExampleSet>()
if (!skippedSources.has('tatoeba')) {
  const chinese = new Map<number, TatoebaSentence>()
  for await (const line of readLines('tatoeba/cmn_sentences_detailed.tsv')) {
    const sentence = parseSentenceLine(line)
    if (sentence) chinese.set(sentence.id, sentence)
  }
  const translations = new Map<number, number[]>()
  for await (const line of readLines('tatoeba/cmn-eng_links.tsv')) {
    const link = parseLinkLine(line)
    if (!link || !chinese.has(link[0])) continue
    translations.set(link[0], [...(translations.get(link[0]) ?? []), link[1]])
  }
  // Of the English sentences, only those linked to a Chinese one are kept
  const wantedEnglish = new Set([...translations.values()].flat())
  const english = new Map<number, TatoebaSentence>()
  for await (const line of readLines('tatoeba/eng_sentences_detailed.tsv')) {
    const sentence = parseSentenceLine(line)
    if (sentence && wantedEnglish.has(sentence.id)) english.set(sentence.id, sentence)
  }
  const exportDate = readSource('tatoeba/export-date.txt').trim()
  // Sentences quoted by the grammar notes, each kept in the first level that can read it
  const grammarSentences = new Set(grammarPoints.flatMap((point) => point.examples.map((example) => example.tatoebaId)))
  for (const level of LEVELS) {
    const sentences = selectExamples({
      words: [...new Set(words.filter((word) => word.hskLevel === level).map((word) => word.hanzi))],
      knownCharacters: new Set(
        base.characters.filter((character) => character.hskLevel !== undefined && character.hskLevel <= level).map((character) => character.hanzi),
      ),
      chinese,
      english,
      translations,
      keep: grammarSentences,
    })
    for (const sentence of sentences) grammarSentences.delete(sentence.tatoebaId)
    examplesByLevel.set(level, { source: 'Tatoeba', license: 'CC BY 2.0 FR', exportDate, sentences })
  }
  for (const id of grammarSentences) problems.push(`Grammar notes: Tatoeba sentence ${id} is not usable in any level`)
}

// --- Validation and writing ----------------------------------------------

// HSK and the full dictionary together: ids unique across both and every word's characters present
problems.push(...validateDictionaryData([...characters, ...fullCharacters], [...words, ...full.words]))
for (const examples of examplesByLevel.values()) problems.push(...validateExampleSet(examples, words))
if (problems.length > 0) {
  console.error(`The dataset was not generated. Problems:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

const header = `// Generated by scripts/dataset/build.ts. Do not edit by hand: change the script and regenerate.
// Meanings and readings: CC-CEDICT (https://cc-cedict.org), license CC BY-SA 4.0.
// Character radicals and traditional forms: Unicode 18.0 Unihan (Unicode License v3).
// Decomposition and etymology: Make Me a Hanzi (LGPL 3.0 or later).
// Stroke counts: hanzi-writer-data (Arphic Public License).
// Frequency ranks: wordfreq (https://github.com/rspeer/wordfreq), data CC BY-SA 4.0.
// HSK 2.0 word list: clem109/hsk-vocabulary (MIT). Details in docs/DATA_SOURCES.md.
`

function writeDataFile(level: HskLevel, typeName: 'Character' | 'Word', entries: readonly (Character | Word)[]) {
  const fileName = typeName === 'Character' ? 'characters.ts' : 'words.ts'
  const exportName = `hsk${level}${typeName === 'Character' ? 'Characters' : 'Words'}`
  const lines = entries
    .filter((entry) => entry.hskLevel === level)
    .map((entry) => `  ${JSON.stringify(entry)},`)
    .join('\n')
  const content = `${header}import type { ${typeName} } from '../../features/dictionary/types.ts'

export const ${exportName}: ${typeName}[] = [
${lines}
]
`
  const levelDir = join(dataDir, `hsk${level}`)
  mkdirSync(levelDir, { recursive: true })
  writeFileSync(join(levelDir, fileName), content)
}

for (const level of LEVELS) {
  writeDataFile(level, 'Character', characters)
  writeDataFile(level, 'Word', words)
}

const hsk5Lines = hsk5.words.map((word) => `  ${JSON.stringify(word)},`).join('\n')
writeFileSync(
  join(dataDir, 'hsk5/words.ts'),
  `${header}import type { Hsk5Word } from '../../features/dictionary/types.ts'

// HSK 5 is not a study set: these words are only used by Today's Word.
export const hsk5Words: Hsk5Word[] = [
${hsk5Lines}
]
`,
)

// Strokes: copied as is, one per character, to load them when the entry card opens.
// The folder is deleted first so no files remain for characters that are gone.
rmSync(strokesDir, { recursive: true, force: true })
mkdirSync(strokesDir, { recursive: true })
for (const [hanzi, data] of strokeData) writeFileSync(join(strokesDir, strokeFileName(hanzi)), data.json)

// Full dictionary: CHUNK_COUNT files, each entry in the one for its first character
// (getChunkIndex). One entry per line so changes read well in git.
const chunks = Array.from({ length: CHUNK_COUNT }, () => ({ characters: [] as Character[], words: [] as Word[] }))
for (const character of fullCharacters) chunks[getChunkIndex(character.hanzi)]!.characters.push(character)
for (const word of full.words) chunks[getChunkIndex(word.hanzi)]!.words.push(word)
const toLines = (entries: readonly object[]) => entries.map((entry) => JSON.stringify(entry)).join(',\n')
rmSync(fullDictionaryDir, { recursive: true, force: true })
mkdirSync(fullDictionaryDir, { recursive: true })
chunks.forEach((chunk, index) => {
  writeFileSync(
    join(fullDictionaryDir, chunkFileName(index)),
    `{"characters":[\n${toLines(chunk.characters)}\n],\n"words":[\n${toLines(chunk.words)}\n]}\n`,
  )
})

// Examples: one JSON per level, which the entry card requests when it opens.
if (examplesByLevel.size > 0) mkdirSync(examplesDir, { recursive: true })
for (const [level, examples] of examplesByLevel) {
  writeFileSync(join(examplesDir, `hsk${level}.json`), `${JSON.stringify(examples, null, 1)}\n`)
}

writeFileSync(
  conflictsReport,
  `# Disagreements between sources

Generated by \`npm run data:build\`. Do not edit by hand.

Each line is a data point on which two sources disagree. The dataset uses the
field's owning source (see docs/DATA_SOURCES.md), and it is recorded here
for review.

${conflicts.length === 0 ? 'None.' : conflicts.map((conflict) => `- ${conflict}`).join('\n')}

## HSK list words not in the dataset

There is no CC-CEDICT entry with that hanzi and that pinyin, so there is
nowhere to take its meaning from. They are left out rather than made up.

${leftOut.length === 0 ? 'None.' : leftOut.map((word) => `- ${word}`).join('\n')}

## HSK 5 words left out of Today's Word

No CC-CEDICT entry with that hanzi and pinyin, or no dictionary entry to open.

${hsk5.leftOut.length === 0 ? 'None.' : hsk5.leftOut.map((word) => `- ${word}`).join('\n')}

## Full dictionary: disagreements between sources

Same as above, for the characters of the full dictionary (outside HSK 1-4).

${fullConflicts.length === 0 ? 'None.' : fullConflicts.map((conflict) => `- ${conflict}`).join('\n')}

## Full dictionary: CC-CEDICT entries left out

${full.leftOut.length === 0 ? 'None.' : full.leftOut.map((entry) => `- ${entry}`).join('\n')}

## Repeated entries in the HSK list

The list repeats these words with the same pinyin (with another sense). They
are stored only once.

${duplicates.length === 0 ? 'None.' : duplicates.map((word) => `- ${word}`).join('\n')}
`,
)

for (const level of LEVELS) {
  const count = (entries: readonly { hskLevel?: HskLevel }[]) => entries.filter((entry) => entry.hskLevel === level).length
  console.log(`HSK ${level}: ${count(words)} words and ${count(characters)} new characters.`)
}
console.log(`HSK 5 (Today's Word only): ${hsk5.words.length} words, ${hsk5.duplicates.length} already in HSK 1-4, ${hsk5.leftOut.length} left out.`)
console.log(`Dataset generated: ${words.length} words and ${characters.length} characters.`)
const unranked = [...words, ...characters].filter((entry) => entry.frequencyRank === undefined)
console.log(`Entries without a wordfreq rank: ${unranked.length}${unranked.length > 0 ? ` (${unranked.map((entry) => entry.hanzi).join(', ')})` : ''}.`)
if (leftOut.length > 0) console.warn(`Words with no CC-CEDICT entry, left out of the dataset: ${leftOut.join(', ')}.`)
if (duplicates.length > 0) {
  console.log(`Repeated entries in the HSK list, stored once: ${duplicates.join(', ')}.`)
}
console.log(
  `Full dictionary (data-release/dictionary, ${CHUNK_COUNT} files, to publish with data:release): ${full.words.length} more words and ${fullCharacters.length} more characters.`,
)
console.log(`Strokes copied to public/strokes: ${strokeData.size}.`)
for (const [level, examples] of examplesByLevel) {
  console.log(`Tatoeba example sentences for HSK ${level} (${examples.exportDate}): ${examples.sentences.length}.`)
}
if (conflicts.length > 0) {
  console.warn(`${conflicts.length} disagreements between sources (see docs/DATA_CONFLICTS.md):\n- ${conflicts.join('\n- ')}`)
}
