import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hskDictionary, hskStudyItems } from '../../src/features/dictionary/hskDictionary.ts'
import type { ExampleSet, HskLevel } from '../../src/features/dictionary/types.ts'
import { buildEntryPage, buildSitemap } from './staticPages.ts'

/*
 * Run after `vite build` (the Deploy workflow does it):
 *
 *   SITE_URL=https://vividhanzi.com node scripts/seo/prerender.ts
 *
 * Writes one page per HSK character and word into dist/ (see staticPages.ts),
 * plus sitemap.xml and robots.txt.
 */

const siteUrl = process.env.SITE_URL?.replace(/\/$/, '')
if (!siteUrl) throw new Error('Set SITE_URL to the public address of the site, e.g. https://vividhanzi.com')

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const dist = join(root, 'dist')
const template = readFileSync(join(dist, 'index.html'), 'utf8')

const LEVELS: HskLevel[] = [1, 2, 3, 4]
const examplesByLevel = new Map(
  LEVELS.map((level) => [
    level,
    JSON.parse(readFileSync(join(root, 'public/examples', `hsk${level}.json`), 'utf8')) as ExampleSet,
  ]),
)

const urls = [`${siteUrl}/`]
for (const item of hskStudyItems) {
  const level = item.entry.hskLevel
  const examples = level === undefined ? undefined : examplesByLevel.get(level)
  const page = buildEntryPage(template, siteUrl, item, hskDictionary, examples)
  const file = join(dist, page.file)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page.html)
  urls.push(page.url)
}

writeFileSync(join(dist, 'sitemap.xml'), buildSitemap(urls))
// robots.txt only counts at the root of a domain (it does with vividhanzi.com)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`)

console.log(`Wrote ${urls.length - 1} entry pages and a sitemap with ${urls.length} addresses.`)
