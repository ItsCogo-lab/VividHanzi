import { formatPinyin, getCharactersOfWord, getMeanings, getTraditionalForms, getWordsWithCharacter, type Dictionary } from '../../src/features/dictionary/dictionary.ts'
import { getExamplesFor, tatoebaSentenceUrl } from '../../src/features/dictionary/examples.ts'
import type { StudyItem } from '../../src/features/dictionary/studyItem.ts'
import type { ExampleSet } from '../../src/features/dictionary/types.ts'
import { describeEntry } from '../../src/features/dictionary/entryDescription.ts'
import { getGrammarPoints } from '../../src/features/grammar/grammar.ts'

/*
 * Static HTML pages for search engines, one per HSK character and word.
 *
 * GitHub Pages only knows the files in dist/: any other address (/vocabulary/学)
 * is answered with 404.html, and Google does not index 404 responses. Writing
 * dist/vocabulary/学/index.html makes that address a real page (HTTP 200) with
 * its own title and description. The page is the built index.html with the
 * entry's content inside #root: search engines read it straight away, and for
 * visitors React replaces it with the app as soon as it loads.
 */

/** Words listed on a character page at most. */
const MAX_RELATED_WORDS = 20

export interface StaticPage {
  /** File to write, relative to dist/: "vocabulary/学/index.html". */
  file: string
  /** Public address, with the trailing slash GitHub Pages redirects to. */
  url: string
  html: string
}

/** Public address of an entry page. Same paths as the app (getEntryPathById). */
export function entryPageUrl(siteUrl: string, kind: StudyItem['kind'], id: string): string {
  return `${siteUrl}/${sectionOf(kind)}/${encodeURIComponent(id)}/`
}

export function buildEntryPage(
  template: string,
  siteUrl: string,
  item: StudyItem,
  dictionary: Dictionary,
  examples: ExampleSet | undefined,
): StaticPage {
  const url = entryPageUrl(siteUrl, item.kind, item.entry.id)
  const { title, description } = describeEntry(item)
  const content = renderEntryContent(siteUrl, item, dictionary, examples)
  return {
    file: `${sectionOf(item.kind)}/${item.entry.id}/index.html`,
    url,
    html: fillTemplate(template, { title, description, url, content }),
  }
}

/** The entry's content as plain HTML, the same facts the app's entry page shows. */
export function renderEntryContent(
  siteUrl: string,
  item: StudyItem,
  dictionary: Dictionary,
  examples: ExampleSet | undefined,
): string {
  const { entry } = item
  const facts: string[] = []
  if (entry.hskLevel !== undefined) facts.push(`HSK ${entry.hskLevel} ${item.kind}`)
  if (item.kind === 'character') {
    if (item.entry.strokeCount !== undefined) facts.push(`${item.entry.strokeCount} strokes`)
    if (item.entry.radical !== undefined) facts.push(`radical ${zh(item.entry.radical)}`)
  }
  const traditional = getTraditionalForms(entry)
  if (traditional.length > 0) facts.push(`traditional ${zh(traditional.join(', '))}`)

  const sections = [
    `<p><a href="${siteUrl}/">VividHanzi</a> · <a href="${siteUrl}/dictionary">Dictionary</a></p>`,
    `<h1>${zh(entry.hanzi)} <small>${escapeHtml(formatPinyin(entry))}</small></h1>`,
    facts.length > 0 ? `<p>${facts.join(' · ')}</p>` : '',
    `<h2>Meanings</h2>${list(getMeanings(entry.meanings).map(escapeHtml))}`,
  ]

  if (item.kind === 'word') {
    const characters = getCharactersOfWord(dictionary, item.entry)
    if (characters.length > 0) {
      sections.push(
        `<h2>Characters</h2>${list(
          characters.map(
            (character) =>
              `<a href="${entryPageUrl(siteUrl, 'character', character.id)}">${zh(character.hanzi)}</a> ${escapeHtml(formatPinyin(character))}: ${escapeHtml(getMeanings(character.meanings)[0] ?? '')}`,
          ),
        )}`,
      )
    }
  } else {
    const words = getWordsWithCharacter(dictionary, item.entry.id).slice(0, MAX_RELATED_WORDS)
    if (words.length > 0) {
      sections.push(
        `<h2>Words with ${zh(entry.hanzi)}</h2>${list(
          words.map(
            (word) =>
              `<a href="${entryPageUrl(siteUrl, 'word', word.id)}">${zh(word.hanzi)}</a> ${escapeHtml(word.pinyin)}: ${escapeHtml(getMeanings(word.meanings)[0] ?? '')}`,
          ),
        )}`,
      )
    }
  }

  for (const point of getGrammarPoints(item)) {
    sections.push(
      `<h2>Grammar: ${escapeHtml(point.title)}</h2><p>${escapeHtml(point.pattern)}</p><p>${escapeHtml(point.explanation)}</p>`,
    )
  }

  const sentences = examples === undefined ? [] : getExamplesFor(examples, item)
  if (sentences.length > 0) {
    sections.push(
      `<h2>Example sentences</h2>${sentences
        .map(
          (sentence) =>
            `<p>${zh(sentence.zh)}<br>${escapeHtml(sentence.en)}<br><small><a href="${tatoebaSentenceUrl(sentence.tatoebaId)}">Tatoeba #${sentence.tatoebaId}</a> by ${escapeHtml(sentence.author)} (CC BY 2.0 FR)</small></p>`,
        )
        .join('')}`,
    )
  }

  sections.push('<p><small>Meanings and readings from CC-CEDICT (CC BY-SA 4.0).</small></p>')
  return `<main style="max-width:42rem;margin:0 auto;padding:1.5rem;line-height:1.6">${sections.join('')}</main>`
}

/**
 * Puts a page's title, description, address and content into the built
 * index.html. Throws if the template is missing a tag, so a change to
 * index.html can't silently produce pages without them.
 */
export function fillTemplate(
  template: string,
  page: { title: string; description: string; url: string; content: string },
): string {
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  // Each pattern captures the text before and after the value it replaces
  const replacements: [RegExp, string][] = [
    [/(<title>)[^<]*(<\/title>)/, title],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/, description],
    [/(<link rel="canonical" href=")[^"]*(")/, page.url],
    [/(<meta property="og:title" content=")[^"]*(")/, title],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/, description],
    [/(<meta property="og:url" content=")[^"]*(")/, page.url],
    [/(<div id="root">)(<\/div>)/, page.content],
  ]
  let html = template
  for (const [pattern, value] of replacements) {
    if (!pattern.test(html)) throw new Error(`index.html has no match for ${pattern}`)
    // A function, so a "$" in the value is never read as a replacement pattern
    html = html.replace(pattern, (_match, before: string, after: string) => before + value + after)
  }
  return html
}

export function buildSitemap(urls: readonly string[]): string {
  const entries = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sectionOf(kind: StudyItem['kind']): string {
  return kind === 'character' ? 'characters' : 'vocabulary'
}

function zh(text: string): string {
  return `<span lang="zh-Hans">${escapeHtml(text)}</span>`
}

function list(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`
}
