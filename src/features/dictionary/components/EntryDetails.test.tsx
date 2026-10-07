import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getEntryPath } from '../entryPaths.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { createDictionary } from '../dictionary.ts'
import { ningCharacter, ningmengWord, testCharacters, testExampleSet, testWords } from '../testData.ts'
import { createChunkLoader } from '../../../test/dictionaryChunks.ts'
import { createFakeFetch, jsonResponse } from '../../../test/fakeFetch.ts'
import { ningResponse } from '../../../test/tatoebaResponses.ts'
import { paragraphWithText } from '../../../test/text.ts'
import { EntryDetails } from './EntryDetails.tsx'

const dictionary = createDictionary([...testCharacters, ningCharacter], [...testWords, ningmengWord])

const JSDELIVR_NING = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent('柠')}.json`
const strokes = {
  strokes: ['M 0 0 L 10 10'],
  medians: [
    [
      [0, 0],
      [10, 10],
    ],
  ],
}

function renderCharacter(entry = ningCharacter, fetchFn?: typeof fetch) {
  return renderWithProviders(
    <EntryDetails item={{ kind: 'character', entry }} dictionary={dictionary} opener={{ getHref: getEntryPath }} />,
    { fetchFn },
  )
}

/** Value of a "label → value" row on the entry page. */
function fact(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

describe('EntryDetails for a character', () => {
  it('shows the integrated data for 柠', () => {
    renderCharacter()

    expect(screen.getByText('níng')).toBeInTheDocument()
    expect(screen.getByText('used in 柠檬')).toBeInTheDocument()
    expect(fact('Traditional')).toHaveTextContent('檸')
    expect(fact('Radical')).toHaveTextContent('木')
    expect(fact('Radical')).toHaveTextContent('Kangxi radical 75')
    expect(fact('Strokes')).toHaveTextContent('9')
    expect(fact('Components')).toHaveTextContent('木+宁')
    expect(fact('HSK level')).toHaveTextContent('HSK 1')
  })

  it('shows the pictophonetic etymology', () => {
    renderCharacter()

    const etymology = screen.getByRole('heading', { name: 'Etymology' }).parentElement!
    expect(within(etymology).getByText('Pictophonetic')).toBeInTheDocument()
    expect(fact('Meaning from')).toHaveTextContent('木tree')
    expect(fact('Sound from')).toHaveTextContent('宁')
  })

  it('lists related words with traditional, pinyin, meaning and level', () => {
    renderCharacter()

    const link = screen.getByRole('link', { name: /柠檬/ })
    expect(link).toHaveTextContent('柠檬檸檬níng ménglemonHSK 1')
    expect(link).toHaveAttribute('href', '/vocabulary/%E6%9F%A0%E6%AA%AC')
  })

  it('links the components that are in the dictionary', () => {
    const withComponent = { ...ningCharacter, decomposition: '⿰好你' }
    renderCharacter(withComponent)

    expect(within(fact('Components')).getByRole('link', { name: /好/ })).toHaveAttribute(
      'href',
      '/characters/%E5%A5%BD',
    )
  })

  it('hides sections without data', () => {
    renderCharacter(testCharacters[1]!)

    for (const label of ['Traditional', 'Radical', 'Strokes', 'Components']) {
      expect(screen.queryByText(label, { selector: 'dt' })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { name: 'Etymology' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Stroke order' })).not.toBeInTheDocument()
  })

  it('loads strokes from jsDelivr, also outside HSK', async () => {
    const fake = createFakeFetch([[JSDELIVR_NING, jsonResponse(strokes)]])
    const { hskLevel: _level, ...outsideHsk } = ningCharacter
    renderCharacter(outsideHsk, fake.fetch)

    expect(await screen.findByRole('heading', { name: 'Stroke order' })).toBeInTheDocument()
    expect(fake.requested).toContain(JSDELIVR_NING)
    expect(fake.requested).not.toContain('/strokes/67e0.json')
  })

  it('without a connection to jsDelivr uses the local HSK copy', async () => {
    const fake = createFakeFetch([['/strokes/67e0.json', jsonResponse(strokes)]])
    renderCharacter(ningCharacter, fake.fetch)

    expect(await screen.findByRole('heading', { name: 'Stroke order' })).toBeInTheDocument()
    expect(fake.requested).toEqual(expect.arrayContaining([JSDELIVR_NING, '/strokes/67e0.json']))
  })

  it('without a connection or local copy says strokes are unavailable', async () => {
    const { hskLevel: _level, ...outsideHsk } = ningCharacter
    renderCharacter(outsideHsk)

    expect(await screen.findByText('Stroke order unavailable offline.')).toBeInTheDocument()
    expect(await screen.findByText('Example sentences unavailable offline.')).toBeInTheDocument()
  })

  it('does not show stroke order or sentences if the sources lack them', async () => {
    const fake = createFakeFetch([[/./, new Response('', { status: 404 })]])
    renderCharacter(ningCharacter, fake.fetch)

    await vi.waitFor(() => expect(fake.requested).toHaveLength(4))
    expect(screen.queryByRole('heading', { name: 'Stroke order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Example sentences' })).not.toBeInTheDocument()
  })

  it('shows Tatoeba sentences at runtime with their attribution', async () => {
    const fake = createFakeFetch([['https://api.tatoeba.org/v1/sentences?', jsonResponse(ningResponse)]])
    renderCharacter(ningCharacter, fake.fetch)

    expect(await screen.findByRole('heading', { name: 'Example sentences' })).toBeInTheDocument()
    await expectSentenceWithPinyin('柠檬是黄色的。', 'níng méng shì huáng sè de。')
    expect(screen.getByText('The lemon is yellow.')).toBeInTheDocument()
    // 柠檬很酸。 is the shortest, but the three longer ones show 柠 in more context
    expect(screen.queryByText('Lemon is sour.')).not.toBeInTheDocument()
    // Sentences in traditional don't contain 柠 as is
    expect(screen.queryByText('檸檬是酸的。')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('Tatoeba #'))).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Tatoeba #8934444 by iiujik' })).toHaveAttribute(
      'href',
      'https://tatoeba.org/en/sentences/show/8934444',
    )
    expect(screen.getByText(/licensed CC BY 2.0 FR/)).toBeInTheDocument()
    expect(fake.requested).not.toContain('/examples/hsk1.json')
  })

  it('shows the direct translation with the lowest id', async () => {
    const sourOnly = { ...ningResponse, data: ningResponse.data.slice(0, 1) }
    const fake = createFakeFetch([['https://api.tatoeba.org/v1/sentences?', jsonResponse(sourOnly)]])
    renderCharacter(ningCharacter, fake.fetch)

    await expectSentenceWithPinyin('柠檬很酸。', 'níng méng hěn suān。')
    expect(screen.getByText('Lemon is sour.')).toBeInTheDocument()
  })

  it('splits example sentences into dictionary words that open their entry', async () => {
    const sourOnly = { ...ningResponse, data: ningResponse.data.slice(0, 1) }
    const fake = createFakeFetch([['https://api.tatoeba.org/v1/sentences?', jsonResponse(sourOnly)]])
    renderCharacter(ningCharacter, fake.fetch)

    // The app's dictionary is HSK 1-4 plus the (empty, in tests) full dictionary: 柠檬 isn't in it
    const word = await screen.findByRole('link', { name: '很' })
    expect(word).toHaveAttribute('href', '/vocabulary/%E5%BE%88')
    // Only the pinyin is underlined, word by word, colored by tone; it's a second, hidden link
    const pinyin = screen.getByText('hěn').closest('a')!
    expect(pinyin).toHaveAttribute('href', '/vocabulary/%E5%BE%88')
    expect(pinyin).toHaveClass('underline')
    expect(pinyin).toHaveAttribute('aria-hidden', 'true')
    expect(word).not.toHaveClass('underline')
    expect(screen.getByText('hěn')).toHaveClass('text-tone-3')
    expect(screen.queryByRole('link', { name: '柠檬' })).not.toBeInTheDocument()
  })

  it('links words from the full dictionary once their chunk loads', async () => {
    const fake = createFakeFetch([['https://api.tatoeba.org/v1/sentences?', jsonResponse(ningResponse)]])
    renderWithProviders(
      <EntryDetails
        item={{ kind: 'character', entry: ningCharacter }}
        dictionary={dictionary}
        opener={{ getHref: getEntryPath }}
      />,
      { fetchFn: fake.fetch, loadChunk: createChunkLoader([], [ningmengWord]) },
    )

    const [word] = await screen.findAllByRole('link', { name: '柠檬' })
    expect(word).toHaveAttribute('href', getEntryPath({ kind: 'word', entry: ningmengWord }))
  })

  it('without a connection to Tatoeba uses the local HSK sentences', async () => {
    const fake = createFakeFetch([['/examples/hsk1.json', jsonResponse(testExampleSet)]])
    renderCharacter(ningCharacter, fake.fetch)

    expect(await screen.findByRole('heading', { name: 'Example sentences' })).toBeInTheDocument()
    await expectSentenceWithPinyin('柠檬很酸。', 'níng méng hěn suān。')
    expect(screen.getByRole('link', { name: 'Tatoeba #8934441 by iiujik' })).toBeInTheDocument()
  })

  it("shows a particle's grammar notes with its example and the Grammar Wiki link", () => {
    renderCharacter(testCharacters.find((character) => character.hanzi === '了')!)

    const grammar = screen.getByRole('heading', { name: 'Grammar' }).parentElement!
    expect(within(grammar).getByRole('heading', { name: 'Completed actions with 了' })).toBeInTheDocument()
    expect(within(grammar).getByRole('heading', { name: 'Change of state with 了' })).toBeInTheDocument()
    expect(within(grammar).getByRole('link', { name: 'Tatoeba #817296 by fucongcong' })).toBeInTheDocument()
    expect(within(grammar).getByRole('link', { name: 'Expressing completion with "le"' })).toHaveAttribute(
      'href',
      'https://resources.allsetlearning.com/chinese/grammar/ASGAGDCQ',
    )
  })

  it('does not show grammar notes if it is not a particle', () => {
    renderCharacter()
    expect(screen.queryByRole('heading', { name: 'Grammar' })).not.toBeInTheDocument()
  })
})

/** The example sentence, with the engine's pinyin underneath (both split into spans per character, syllable or word). */
async function expectSentenceWithPinyin(chinese: string, pinyin: string) {
  const pinyinLine = (await screen.findAllByText(paragraphWithText(pinyin)))[0]!
  expect(pinyinLine.previousElementSibling).toHaveTextContent(chinese)
}

describe('EntryDetails for a word', () => {
  it('shows the traditional form', () => {
    renderWithProviders(
      <EntryDetails
        item={{ kind: 'word', entry: ningmengWord }}
        dictionary={dictionary}
        opener={{ getHref: getEntryPath }}
      />,
    )
    expect(screen.getByText('Traditional').parentElement).toHaveTextContent('Traditional 檸檬')
  })
})
