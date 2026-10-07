# VividHanzi

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/E1B223H5ZR)

A web app for learning and practicing Chinese characters (hanzi) and vocabulary:
recognition, pinyin, meaning, spaced repetition and, later, writing
and pronunciation.

Status: **MVP complete** (phases 1 to 12). For now the interface and the
meanings are in English.

## What you can do

- **Practice** sessions of 5, 10 or 20 exercises with the 328 characters and
  words of HSK 1 (HSK 2.0): flashcards and multiple choice (hanzi → meaning,
  hanzi → pinyin, meaning → hanzi).
- **Spaced repetition**: each answer is saved and decides when each item comes
  back; sessions start with the pending reviews.
- **Home** with what is due today, your streak and your HSK 1 progress.
- **Statistics**: answers, accuracy, streaks, last 7 days and most missed items.
- **Vocabulary and Characters**: lists with search (hanzi, pinyin with or
  without tones, meaning) and a detail page for each entry with your progress.
- **Settings**: session size, deleting your progress and dataset credits.

Progress is saved in the browser (localStorage). Optionally you can sign in
(Google or email link) to sync it across devices with Supabase. The
architecture and the plan are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Vitest + Testing Library · oxlint

## Requirements

Node.js 20.19 or later (22 recommended).

## How to run it

```bash
npm install
npm run dev        # development server at http://localhost:5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-checks and builds the production version into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run lint` | Linter (oxlint) |
| `npm test` | Runs the tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run check` | Types + lint + tests (the same thing CI runs) |
| `npm run data:fetch` | Downloads the dataset sources (HSK list, CC-CEDICT, Unihan, Make Me a Hanzi, Tatoeba) |
| `npm run data:build` | Regenerates the dataset in `src/data/`, `public/strokes/` and `public/examples/` (see `docs/DATA_SOURCES.md`) |
| `npm run data:validate` | Validates the generated dataset without downloading anything |

## Structure

```
docs/            Architecture, decisions and data sources
scripts/dataset/ Script that generates the dataset from the sources
public/          Static files (favicon)
src/
  app/           App, routes (AppRoutes), menu sections (navigation.ts)
    layout/      Common structure: main navigation and content area
  pages/         One page per app section
  features/
    dictionary/  Character and word types, queries, search and data validation
    practice/    Study sessions: logic (session.ts), exercise types and components
    srs/         Spaced repetition (Leitner boxes)
    progress/    Progress, streaks, statistics and localStorage persistence
    settings/    User settings
  data/          Generated dataset (HSK 1: 150 words, 178 characters)
  lib/           Domain-free utilities (pinyin, randomness, dates, storage)
  components/    Shared components
    ui/          Generic visual pieces: Button, Card, DataTable, HanziText, PageHeader, ProgressBar, StatCard...
  i18n/          Interface texts (en.ts active, es.ts ready) and the t() function
  test/          Shared test configuration
  index.css      Tailwind and design tokens (colors, fonts, focus)
  main.tsx       Entry point
```

The complete planned structure is described in
`docs/ARCHITECTURE.md`; each folder is created in the phase that needs it.

## Data

All linguistic data comes from open sources and is generated with a
script; the app does not call any external API:

- Meanings, readings and traditional forms of words: [CC-CEDICT](https://cc-cedict.org/wiki/) (CC BY-SA 4.0).
- HSK 2.0 word list: [clem109/hsk-vocabulary](https://github.com/clem109/hsk-vocabulary) (MIT).
- Radicals and traditional forms of characters: [Unihan](https://www.unicode.org/reports/tr38/) (Unicode License v3).
- Components and etymology: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) (LGPL 3.0+).
- Stroke order and stroke count: [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (Arphic Public License).
- Example sentences: [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR).

Each generated file keeps the license of its source. Which source takes
precedence for each field and how the dataset is regenerated are in
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
