import { describe, expect, it } from 'vitest'
import { hskDictionary } from '../../src/features/dictionary/hskDictionary.ts'
import { getStudyItem } from '../../src/features/dictionary/studyItem.ts'
import type { ExampleSet } from '../../src/features/dictionary/types.ts'
import { buildEntryPage, buildSitemap, fillTemplate } from './staticPages.ts'

const SITE = 'https://vividhanzi.com'

const TEMPLATE = `<html><head>
<meta
  name="description"
  content="Home description"
/>
<link rel="canonical" href="${SITE}/" />
<meta property="og:title" content="Home" />
<meta
  property="og:description"
  content="Home description"
/>
<meta property="og:url" content="${SITE}/" />
<title>Home</title>
</head><body><div id="root"></div></body></html>`

function item(id: Parameters<typeof getStudyItem>[1]) {
  const found = getStudyItem(hskDictionary, id)
  if (!found) throw new Error(`${id} is not in the dataset`)
  return found
}

describe('fillTemplate', () => {
  const page = { title: 'A "title"', description: 'Costs $1 & more', url: `${SITE}/x/`, content: '<main>Hi</main>' }

  it('replaces the title, description, address and content', () => {
    const html = fillTemplate(TEMPLATE, page)

    expect(html).toContain('<title>A &quot;title&quot;</title>')
    expect(html).toContain('content="Costs $1 &amp; more"')
    expect(html).toContain(`<link rel="canonical" href="${SITE}/x/" />`)
    expect(html).toContain(`<meta property="og:url" content="${SITE}/x/" />`)
    expect(html).toContain('<meta property="og:title" content="A &quot;title&quot;" />')
    expect(html).toContain('<div id="root"><main>Hi</main></div>')
    expect(html).not.toContain('Home')
  })

  it('fails when index.html is missing a tag', () => {
    expect(() => fillTemplate(TEMPLATE.replace('<title>Home</title>', ''), page)).toThrow(/title/)
  })
})

describe('buildEntryPage', () => {
  it('writes a word page with its characters and grammar notes', () => {
    const page = buildEntryPage(TEMPLATE, SITE, item('word:了'), hskDictionary, undefined)

    expect(page.file).toBe('vocabulary/了/index.html')
    expect(page.url).toBe(`${SITE}/vocabulary/${encodeURIComponent('了')}/`)
    expect(page.html).toContain('<title>了 le: (completed action marker) – HSK 1 Chinese word | VividHanzi</title>')
    expect(page.html).toContain(`href="${SITE}/characters/${encodeURIComponent('了')}/"`)
    expect(page.html).toContain('Grammar: Completed actions with 了')
  })

  it('links a character page to the words that use it', () => {
    const page = buildEntryPage(TEMPLATE, SITE, item('char:学'), hskDictionary, undefined)

    expect(page.file).toBe('characters/学/index.html')
    expect(page.html).toContain('meaning and stroke order')
    expect(page.html).toContain(`href="${SITE}/vocabulary/${encodeURIComponent('学生')}/"`)
  })

  it('encodes the id of words that share their hanzi', () => {
    const page = buildEntryPage(TEMPLATE, SITE, item('word:长[cháng]'), hskDictionary, undefined)

    expect(page.file).toBe('vocabulary/长[cháng]/index.html')
    expect(page.url).toBe(`${SITE}/vocabulary/${encodeURIComponent('长[cháng]')}/`)
  })

  it('credits the example sentences', () => {
    const examples: ExampleSet = {
      source: 'Tatoeba',
      license: 'CC BY 2.0 FR',
      exportDate: '2026-10-07',
      sentences: [
        { tatoebaId: 1, zh: '我爱你。', author: 'someone', en: 'I love you.', translationTatoebaId: 2, words: ['爱'] },
      ],
    }

    const page = buildEntryPage(TEMPLATE, SITE, item('word:爱'), hskDictionary, examples)

    expect(page.html).toContain('我爱你。')
    expect(page.html).toContain('Tatoeba #1</a> by someone (CC BY 2.0 FR)')
  })
})

describe('buildSitemap', () => {
  it('lists every address', () => {
    const sitemap = buildSitemap([`${SITE}/`, `${SITE}/characters/%E5%AD%A6/`])

    expect(sitemap).toContain(`<url><loc>${SITE}/</loc></url>`)
    expect(sitemap).toContain(`<url><loc>${SITE}/characters/%E5%AD%A6/</loc></url>`)
  })
})
