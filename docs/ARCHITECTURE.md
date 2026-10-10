# VividHanzi Architecture

This document covers the initial analysis (Phase 1), the proposed architecture and
the MVP technical plan. It is a living document: when a decision changes, it is
updated here.

## 1. Initial state of the repository

- A single commit (`Initial commit`) with the Node `.gitignore` that GitHub generates.
- No code, no `package.json`, no configuration, no issues or PRs.
- Conclusion: the project starts from scratch, with no prior conventions to respect.

## 2. Principles

1. **Simple first.** We only add an abstraction when it solves a real problem.
2. **Logic separate from the UI.** The rules (exercises, progress, spaced
   repetition) are pure TypeScript functions, testable without React.
3. **Data outside the components.** Datasets live in `src/data/` and are
   queried through functions.
4. **Works offline.** Nothing basic depends on an external API.
5. **Ready to grow, without building yet what is not needed.**

## 3. Stack and dependencies

| Piece | Choice | Why |
| --- | --- | --- |
| UI | React 19 | Explicitly requested. |
| Language | TypeScript in strict mode | Requested. Also `noUncheckedIndexedAccess`: looking up a character by id can fail and the compiler forces us to account for it. |
| Bundler / dev server | Vite | Requested. Instant startup, minimal configuration. |
| Styles | Tailwind CSS v4 (`@tailwindcss/vite`) | Requested. v4 is configured from CSS (`@theme`), with no `tailwind.config.js` or PostCSS. |
| Lint | oxlint | It is the linter the official Vite template ships with today. A single dependency, very fast. |
| Tests | Vitest + Testing Library + jsdom | Vitest reuses the Vite configuration; Testing Library tests components the way a person uses them. |

Dependencies planned for later phases (they will be added when needed, not before):

| Phase | Dependency | Reason |
| --- | --- | --- |
| 3 | `react-router` | Real routes (`/characters/好`), the browser back button and shareable links. Writing it by hand would be reinventing something standard. |
| Data integration | `hanzi-writer` (MIT) | Stroke order animation on the character detail page. Loaded with `import()` only when a detail page is opened. Later it will serve for writing practice. |
| Data integration | `hanzi-writer-data` (Arphic PL, development only) | Stroke data that the build copies to `public/strokes/`. |
| Custom sets | `pinyin-pro` 3.29.4 (MIT), pinned version | Pinyin for the user's sentences and for example sentences. Deterministic, with a word dictionary for polyphonic characters. Loaded with `import()` only when saving a sentence or showing example sentences. |
| Accounts | `@supabase/supabase-js` (MIT) | Optional login (Google and email link) and a cloud copy of the user's data, without our own server. Loaded with `import()` only if a project is configured. |

Deliberately ruled out: Redux/Zustand (React Context + hooks is enough), i18next
(a typed dictionary of our own is enough for 3 languages), component libraries
(we want our own identity), a backend of our own (Supabase acts as the backend
for accounts), Docker.

## 4. Folder structure

Organized by feature. Only folders that already have content exist;
the rest are created in their phase.

```
src/
  app/              App bootstrap: App, routes, layout and navigation (Phase 3)
  pages/            One page per section; they compose features, with no logic of their own
    DashboardPage, DictionaryPage, EntryDetailPage, PracticePage,
    ProfilePage, ProgressPage, SettingsPage; study/ (tabs and sets)
  features/
    dictionary/     Domain types (Character, Word), search, tones and the dictionary panel
      runtime/      Service, cache (IndexedDB) and adapters for the external sources
    grammar/        Grammar notes for function words (data in data/grammar.ts)
    studySets/      StudySet model (HSK, topics, custom) and its derived progress
    myStudies/      Sets the user follows and when they last studied them (localStorage)
    practice/       Exercise types, session generation, exercise components
    progress/       Progress tracking, statistics, streak, persistence
    srs/            Spaced repetition (simple, replaceable algorithm)
    settings/       User settings (session, theme, tone colors and numbers)
    install/        Installing the app on the home screen (banner and Settings section)
    account/        Optional account with Supabase (login and Profile card)
    sync/           Syncing the user's data with the cloud (merge, plan)
    audio/          (Future) pronunciation service + reusable button
    writing/        (Future) canvas, strokes, evaluation
  components/ui/    Generic visual components: Button, Card, ProgressBar...
  data/             Generated datasets (hsk1/ to hsk4/); topics and grammar curated by hand (topics.ts, grammar.ts)
  i18n/             Interface texts (en active, es ready, ca later)
  lib/              Domain-free utilities: storage, dates, randomness
  test/             Shared test configuration
```

Rule of thumb: `pages` → `features` → `lib`/`data`. A feature does not import from
`pages`, and `lib` does not import from anything else in the project.

## 5. App sections

Four sections in the main navigation; Progress and Settings hang off the profile.

| Section | Route | Content |
| --- | --- | --- |
| Home | `/` | Overall progress, streak, pending reviews, Today's Word (one HSK 3-5 word per calendar day, the same for everyone: a fixed shuffled order indexed by date, so none repeats until all have been shown; `features/todaysWord`), sets being studied. |
| Study | `/study`, `/study/hsk`, `/study/topics`, `/study/custom` | My Studies, HSK, Topics and My sets tabs with set cards. `/study/custom/new` creates a set. |
| Set | `/study/sets/:setId` | Learn and Study actions with their counts, progress (mastered, learning, not started) and vocabulary. |
| Session | `/study/practice?set=:setId&mode=learn` or `&mode=study` | Learn (new vocabulary) or Study (review of what has been learned) for a set; without `set`, a mixed session of all vocabulary; `?focus=difficult`, only the difficult items. Dictionary button. |
| Dictionary | `/dictionary`, `/vocabulary/:id`, `/characters/:hanzi` | Global search and detail pages. `q` and `kind` go in the URL. |
| Profile | `/profile` | Local summary: mastered, reviews, streak, sets and recent items. |
| Progress / Settings | `/progress`, `/settings` | Detailed statistics; session, theme, tones, deleting progress, credits. |

The old routes (`/practice`, `/vocabulary`, `/characters`) redirect to the new ones.
Navigation: sidebar on desktop, bottom bar on mobile.

### Study sets

A `StudySet` (`features/studySets/types.ts`) is an id, a type (`hsk`, `topic`,
`custom`), a name, an optional description, level and icon, and a list of
`StudyItemId`. A set does not store progress: its progress is computed on the fly with
`summarizeItemIds` from the per-item progress, so an item that is in
several sets counts in all of them without duplicating data. Mastered = SRS level ≥ 4.

- HSK sets: the level's words, from `hskN/words.ts`. There are no hand-written
  lists. Characters are not cards of their own: they are learned through the
  words that contain them (发 in 发烧 and 头发), and every HSK character is in
  at least one HSK word (a test checks it). The general Practice session uses
  words only too.
- Character statistics ("characters learned" on Home, Progress and Profile)
  come from `summarizeCharacters`: a character is as far along as the furthest
  word that contains it, or its own card (custom sets can still add single
  characters, and older progress may have character cards).
- Topic sets: `src/data/topics.ts`, curated by hand (criteria in
  DATA_SOURCES.md, "Topic sets"). Adding a topic is adding an object.
- `validateStudySets` checks for duplicate ids, empty sets and items that do not
  exist; a test runs it over the app's sets.
- Custom sets (`custom`): created by the user (see "Custom sets" below).

My Studies (`features/myStudies`) stores only which sets the user follows and the
last time they studied each one (`hanzivocab.studies`). Removing a set does not delete
the progress of its items.

### Learn and Study

Each set has two kinds of session, and neither turns into the other on its own:

- **Learn** presents new items from the set with their full detail page (the same
  one as in the dictionary) and the user confirms which ones they have learned.
- **Study** is review: only already-learned items come in, those due for
  review first. If none are due, the interface says so and offers "Review
  learned vocabulary anyway" (`scope=all`), which still uses only what has been learned.

Definitions, on top of the progress that already existed (no new fields):

| State | Condition | Where |
| --- | --- | --- |
| New (not learned) | The item has no record in the SRS | `getItemStatus` → `new` |
| Learned | It has a record: it was confirmed in Learn or has been answered at least once | `isLearned` |
| Due for review | Learned and its `nextReviewAt` has arrived | `isDue` |
| Mastered | SRS level ≥ 4 | `MASTERED_LEVEL` |

Confirming in Learn calls `introduceItem`: it creates the record at level 0 with
the first review today (the SRS level 0 interval). It is not an answer, so
it does not count toward activity or the streak. "I already know it" calls
`markItemKnown`: the record enters at the maximum level (mastered) with the first
review after 30 days (`scheduleKnownItem`). It still shows up in Study, but very
rarely; if it is answered wrong, it goes back to level 0 like any other.
"Don't learn" calls `setItemExcluded`: the item gets no SRS record, only an
entry in `ProgressData.excluded`, and Learn stops offering it. Its dictionary
page says so and has "Learn it after all" to undo it. Undoing keeps the entry
with `excluded: false` and its date, so a sync keeps the latest choice.

In Profile the user can set their HSK level (`settings.hskLevel`).
Saving it calls `applyHskLevel`: anything with no record up to that level
enters as mastered, with the first reviews spread between 30 and 59 days
so they do not all fall on the same day; anything two or more levels below
(`BASIC_LEVEL_GAP`) is marked `basic`: mastered and never due (`isDue`
returns `false`), even if it was already being studied. A basic item only shows up in a
voluntary review, last; if it is answered wrong, it loses the mark. What the
level creates carries the `fromLevel` mark until it is answered: when lowering the level, those
records are deleted and the item becomes new again. What had already been
studied is kept; if it was basic, it loses the mark and goes back to being reviewed as
mastered. The filters live in
`studySets/sessionItems.ts` (`getLearnableItems`, `getReviewItems`,
`getSetSessionCounts`); no page filters on its own.

The URL fixes the session context: `/study/practice?set=hsk-1&mode=learn`
or `&mode=study`. The current item and the answers live in the state of the
session component, which stays mounted while the dictionary is open.

### Custom sets

`features/customSets` stores the user's sets in localStorage
(`hanzivocab.customSets`, versioned). A `CustomSet` is plain JSON: name,
description, dictionary item ids and the user's notes. `useStudySets()`
turns them into `StudySet`s of type `custom` and merges them with the app's own,
so cards, progress, Learn, Study and My Studies work the same.
`CustomSetsProvider` is the only place that knows where they are stored: to use
a server later it is enough to change it.

- **Vocabulary**: found with the same search as the dictionary, and the id is
  stored. Hanzi, pinyin, meanings and strokes are never copied or edited.
  Any entry of the full dictionary can be added, not just HSK
  1-4 (see "Full dictionary").
- **Custom meaning**: `meanings[itemId]` inside the set. The official detail page
  does not change; the same item in another set has its own notes. Removing the
  item from the set deletes its notes in that set.
- **Custom sentences**: `sentences` inside the set, each with an `id`, the
  `itemId` it accompanies, the Chinese the user wrote and the generated `tokens`
  (pinyin and tone per character, punctuation separate). The pinyin is
  stored: showing a sentence does not need the engine.
- **Automatic pinyin** (`pinyinEngine.ts`): `pinyin-pro` with its word
  dictionary and the tone changes of 一/不. A character with several readings
  is only considered certain if the engine reads it inside a word or if it matches
  the dataset reading at that point (the longest dataset word that
  starts there, with no homographs). Otherwise it is marked as doubtful, without color, and
  the user chooses among the possible readings; they never type pinyin by hand.
  Where the dataset reads the same syllable in neutral tone (朋友 péng you), the
  dataset's is used. The dictionary's example sentences use the same engine
  (`AnnotatedSentence`), but without choosing: doubtful ones stay marked.
- **Colors**: the same as in the rest of the app (`TONE_TEXT_CLASSES`). Punctuation
  and doubtful characters have no color; the pinyin is always visible.
- The dictionary detail page opened from a custom set (`?set=custom-...`)
  adds a "My notes in …" card; in Learn, the notes go under the detail page.

### Full dictionary

HSK 1-4 is in the bundle (`src/data`), because sets, exercises
and statistics use it. The rest of CC-CEDICT (about 108,000 words and 9,900
characters) is in the data repository `ItsCogo-lab/HanziDict`
(served by jsDelivr, see "Runtime sources"), split into 32
files by first character (`fullDictionary.ts`), and is requested only when
needed:

- **`dictionaryStore.ts`**: the interface's dictionary. It starts with HSK and
  adds each chunk that arrives; it never requests one twice. It follows the
  `useSyncExternalStore` contract, so the interface re-renders on its own.
- **`DictionaryProvider`** shares it with the whole app. By default it requests
  chunks with `loadDictionaryChunk` (the dictionary service, with cache). Tests
  pass it a test `loadChunk` (`src/test/dictionaryChunks.ts`), with no network.
- **`useLoadItems(itemIds)` / `<LoadEntries>`**: to open a detail page, a custom
  set or a custom set session, it loads the chunks for those items and
  their characters. With HSK items it is ready immediately.
- **`useSearchableItems(active)`**: when the first search is typed, all
  32 chunks are loaded (about 4.7 MB gzipped, once per data version: they are
  stored in IndexedDB); while they arrive, HSK is searched and the user is notified. Without
  a search nothing is downloaded.
- **Result order**: exact matches before partial ones, and
  within each group HSK before the rest.
- **`useDictionarySearch(query)`**: what both search boxes use. It searches
  when typing stops (200 ms; each keystroke cancels the previous wait),
  requires one hanzi or two letters (a single letter matches tens of thousands of
  entries) and remembers the last 30 searches per dictionary version.
  While typing, the previous results stay visible.

### Runtime sources

The full dictionary (data repository on jsDelivr), stroke
order (jsDelivr) and example sentences (Tatoeba API) are requested at
runtime; why these sources and not others is in `DATA_SOURCES.md`. The
layers, from top to bottom:

```
StrokeOrder, ExampleSentences, search boxes   (components: never call an API)
  └ useRuntimeData / dictionaryStore        (cancel or reuse requests)
     └ dictionaryService.ts                 (decides where each piece of data comes from)
        ├ resourceService.ts                (stale-while-revalidate cache)
        │  └ dictionaryCache.ts             (IndexedDB; in memory if unavailable)
        └ dictionarySource.ts, strokeSource.ts, tatoebaSource.ts   (adapters)
           └ http.ts                        (classified errors, timeout, per-minute limit)
```

- **Adapters**: one per source. They build the URL (the version is pinned),
  validate the response and hand it to the app's model (`StrokeData`,
  `ExampleSentence`). Nothing of the API's format leaves there: if the API changes,
  only its adapter changes.
- **Errors**: `http.ts` turns any failure into a `SourceError` with its
  type (`network`, `http`, `rate-limit`, `invalid`, `aborted`). Each source
  has its own per-minute request limit in the browser and, after a
  429, waits as long as the source asks.
- **Cache**: IndexedDB (database `hanzivocab-dictionary`), not localStorage, because
  it can grow to several MB. Each entry stores the key, the data, when it was
  downloaded and from which source and version. If IndexedDB fails, it is like having no
  cache.
- **Order when requesting data**: fresh cache → stale cache (shown and
  refreshed in the background) → the API → the local HSK 1-4 copy → the detail page
  says it is not available offline. Made-up data is never shown.
- **Tests**: `renderWithProviders` uses an in-memory cache and an offline
  `fetch`; `src/test/setup.ts` replaces the global `fetch` so that no
  test goes out to the internet. The Tatoeba test responses are copies of a real
  query (`src/test/tatoebaResponses.ts`).

### Dictionary inside the session

`DictionaryPanel` opens on top of the session (side panel on desktop,
bottom sheet on mobile) without changing route: the exercise stays mounted underneath
with its state, and on close (button, Escape) focus returns to the Dictionary button.
Detail pages receive an `EntryOpener`: on the page they link to another route; in the
panel they open the detail page inside the panel, with history to go back. Looking up the
question's item is only offered after answering, so as not to give away the
answer.

### Mobile and installation

The app is designed mobile-first (360 px wide). The bottom navigation
bar is `--mobile-nav-height` tall (`index.css`): 3.5rem plus the iPhone system
strip (`env(safe-area-inset-bottom)`, thanks to
`viewport-fit=cover`); the content and Learn's fixed buttons use it so as not
to be covered. On mobile everything is more compact: the root drops to 15 px (everything
is in rem, so text and spacing shrink together) and margins, gaps and
paddings use small values that grow from `sm:`. Form fields
are a fixed 16 px so Safari does not zoom when typing.

It can be installed as an app (`public/manifest.webmanifest`). `start_url` and
`scope` are relative (`./`), so they work the same at `/` and at `/VividHanzi/`.
The logo (`public/logo.svg` and `public/favicon.svg`, and on a cream
background in `public/icons/`) is a hand of four study cards in the tone
colors, with 学 ("to study") from hanzi-writer-data on the red front card.
It is a drawing, not a font, so it looks the same everywhere.

The localStorage keys (`hanzivocab.*`) and the IndexedDB database
(`hanzivocab-dictionary`) keep the app's old name on purpose:
changing them would lose the progress already saved. There is no service worker: browsers no longer require one to
install, and this way each deployment arrives without caches delaying it (the
dictionary is already stored in IndexedDB).

`features/install`: Chrome/Edge/Samsung fire `beforeinstallprompt`, which is
listened for from `main.tsx` before mounting React and stored for the Install
button. Safari on iPhone has no such dialog: the steps
"Share → Add to Home Screen" are explained. The banner (`InstallBanner`) appears
once, not during sessions, and does not come back after being closed; Settings → App still
offers installing.

### Tone colors

`getCharacterTones` (`features/dictionary/tones.ts`) derives the tone of each
character from the entry's pinyin with tone marks. For words, syllable by syllable (so
a polyphonic character takes the word's reading); for single characters, only if
all their readings have the same tone. If something does not add up, the character has
no color: nothing is guessed. Colors are in `index.css` (`--color-tone-1..5`), all
with contrast ≥ 4.5:1. Color is never the only cue: the pinyin with marks
is next to it, and is hidden in exercises that ask for the pronunciation until
answered. Settings: turn colors on and add tone numbers.

### Dark theme

Components only use color tokens (`bg-paper`, `text-ink`,
`text-tone-3`...), never loose colors. The dark theme redefines those same
tokens in `html[data-theme='dark']` (`index.css`), so there are no `dark:`
classes. In dark mode the accent and the tones get lighter and keep contrast
≥ 4.5:1; on an accent fill the text is `on-accent` (white in light,
dark in dark).

Settings → Appearance: System (default), Light or Dark, saved with the rest
of the settings. A small script in `index.html` sets `data-theme` before painting,
so the wrong theme is not visible on load; then `SettingsProvider` keeps it up
(`features/settings/theme.ts`), listens for system changes and
paints `theme-color` (the browser bar) with the background. Hanzi Writer draws with
fixed colors, so the stroke order is recreated when the theme changes.

## 6. Main entities

The model is in `src/features/dictionary/types.ts`. Summary:

```ts
type HskLevel = 1 | 2 | 3 | 4
type Translations = { en: string[]; es?: string[]; ca?: string[] } // en comes from CC-CEDICT

interface Character {
  id: string              // the hanzi itself, e.g. "好"
  hanzi: string
  pinyin: string[]        // may have several readings (了: le, liǎo)
  meanings: Translations
  hskLevel: HskLevel
  strokeCount?: number    // hanzi-writer-data
  radical?: string        // Unihan: 木, or its simplified form 讠
  radicalNumber?: number  // Unihan: 1-214 (木 → 75)
  frequencyRank?: number  // no source yet
  traditional?: string[]  // Unihan: 柠 → ["檸"]
  decomposition?: string  // Make Me a Hanzi: "⿰木宁"
  etymology?: Etymology   // Make Me a Hanzi: type, semantic, phonetic
}

interface Word {
  id: string              // e.g. "你好"
  hanzi: string
  pinyin: string          // "nǐ hǎo"
  meanings: Translations
  hskLevel: HskLevel
  traditional?: string    // CC-CEDICT: "檸檬"
  frequencyRank?: number
}

// Tatoeba example sentence, in public/examples/hsk1.json
interface ExampleSentence {
  tatoebaId: number
  zh: string
  author: string
  en: string
  translationTatoebaId: number
  translationAuthor?: string
  words: string[]
}

// A character or a word; exercises and progress work with this
type StudyItem = { kind: 'character'; entry: Character } | { kind: 'word'; entry: Word }
type StudyItemId = `char:${string}` | `word:${string}`   // "char:好", "word:好"

// Progress of a studied item (src/features/progress/types.ts)
interface ItemProgress {
  itemId: StudyItemId
  timesSeen: number
  timesCorrect: number
  timesWrong: number
  masteryLevel: number    // 0-5
  lastReviewedAt: string  // ISO 8601
  nextReviewAt: string
}

// All progress: items that are not in `items` are new
interface ProgressData {
  items: Partial<Record<StudyItemId, ItemProgress>>
  activity: Record<string, { answers: number; correct: number }> // per day "2026-09-28"
  excluded: Partial<Record<StudyItemId, { excluded: boolean; changedAt: string }>> // "Don't learn"
}
```

Optional fields are optional precisely so as not to make up data: if
the source that owns a field does not have it, it stays empty and the detail page does not show
that section. Which source takes precedence for each field and how the dataset is generated
(adapters per source, merging and validation in `scripts/dataset/`) is in
`docs/DATA_SOURCES.md`.

**Large data, outside the bundle.** Strokes (`public/strokes/`) and
example sentences (`public/examples/`) are requested with `fetch` when a detail page is opened.
The Hanzi Writer library is also loaded at that moment.

**Derived data, not stored.** The characters that make up a word and the
words related to a character are not stored in the dataset: they are computed
from `hanzi` (`getCharactersOfWord`, `getWordsWithCharacter`). If they were
stored, they could get out of sync when the data is edited.

**Queries.** `src/features/dictionary/dictionary.ts` builds a
`Dictionary` (two `Map`s indexed by id) and offers pure functions to search
and list. `validation.ts` checks the consistency of the data (unique ids,
pinyin and meanings present, characters of each word existing); the
dataset tests will use it so that an error in the data makes CI fail.

### Extensible exercises

It lives in `src/features/practice/`. Each exercise type has:

1. Its interface in `types.ts`, within the `Exercise` union (discriminated by `type`).
2. Its definition in `exerciseDefinitions.ts`:

   ```ts
   interface ExerciseDefinition<E extends Exercise> {
     type: E['type']
     canBuild(item, pool): boolean   // is there enough data for this exercise?
     build(item, pool, random): E    // generates question and options
   }
   ```

3. Its component, chosen in `components/ExerciseView.tsx` with a `switch` that
   TypeScript forces to be exhaustive.

Adding a new exercise (e.g. writing) consists of those three steps, without
touching the others. `random` is injected so that tests are deterministic.

**Current types.** `flashcard` (the user says whether they knew it) and three
multiple-choice ones with four options, in `choiceExercises.ts`:

| Type | Shown | Chosen |
| --- | --- | --- |
| `meaning-choice` | hanzi | meaning |
| `pinyin-choice` | hanzi | pinyin |
| `hanzi-choice` | meaning | hanzi |

Distractor rules (covered by tests):

- They are of the same type as the answer (character or word) and, if possible, with
  the same number of characters, so that it cannot be guessed by shape.
- They cannot also be a valid answer: those that share
  a meaning (synonyms), a pinyin reading or the same hanzi are discarded, and
  they cannot coincide with each other either.
- Meanings that quote the hanzi itself ("used in 漂亮") are hidden; if
  an item is left with none (子, 漂, 么), its meaning is not asked,
  only its pinyin.
- For characters with several readings the first one is shown, so that the
  correct option is not distinguishable by being a list.

**Tones.** `tone-choice` (`toneExercises.ts`) shows the hanzi and its pinyin
without marks ("ni hao"); the four options differ only in tones. Each wrong
option changes the tone of one syllable (the neutral tone only after the
first syllable). Characters with several readings are left out, since another
reading could be a "wrong" option that is also right. The options are plain
strings, so it has its own `ToneExercise` type and `ToneQuestion` component;
the option buttons and feedback are shared with `ChoiceQuestion`
(`ChoiceParts.tsx`, `choiceState.ts`).

**Matching.** `match-pinyin` and `match-meaning` (`matchExercises.ts`,
`MatchQuestion`) show four hanzi and their pinyin or meanings shuffled, to pair
up. They are built around the session's item plus the three distractors a
pinyin or meaning question would use (so every pair has one answer), and only
that item is graded: correct if it was never in a wrong pair. Since all four
words are shown, the three extra ones come from learned items when there are
enough (`createSessionExercises`), and from the whole vocabulary otherwise.

**Flashcard grades.** After revealing, the user says what they knew: neither,
only the pinyin, only the meaning, or both. Only "both" is correct for spaced
repetition, but the result carries each skill apart (`ExerciseResult.skills`),
so the weaker one comes up more in later sessions.

**Which types.** `settings.exerciseTypes` picks the types Study sessions may
use (`getDefinitions`), at least one. With writing alone, the session writes
the items of its pool that can be written (`selectWritingItems`). `?type=<type>` on the
practice page runs a session of that type only, whatever the settings, over
everything with progress (learned in a set or known from the HSK level, never
new words); Home lists one button per type.

**Skills.** Every exercise type trains one skill (`EXERCISE_SKILLS` in
`progress/skills.ts`): meaning (flashcard, meaning and hanzi choice), pinyin,
tones and writing. Spaced repetition stays one recognition level per item
(plus writing); on top of that each item keeps `skills` with correct, wrong
and correct answers in a row per skill. The Progress page sums them per skill
("solid" = right at least twice in a row), and `pickDefinition` picks an
item's exercise type with weight 1 / (1 + streak of its skill), so weaker
skills come up more often.

**Session.** `session.ts` creates the exercises (items by priority and a
buildable type for each, see `pickDefinition`) and manages advancement with a pure reducer
(`sessionReducer`), which `PracticeSession` uses with `useReducer`. Each answer
produces an `ExerciseResult { itemId, exerciseType, correct }`, which is what the
progress system will consume in Phase 8.

A missed exercise is added again at the end of the session until it is
answered correctly (choice questions move their options one place). Retries are
saved to progress like any other answer, but the session score only counts
first attempts (`getFirstAttemptResults`).

**Writing.** `WritingExercise` shows the meaning and pinyin and the user
writes the hanzi one character at a time in a 田字格 box (`WritingPad`, Hanzi
Writer's `quiz()` over the same stroke data as the entry page). It is correct
only without help (`gradeWriting` in `practice/writing.ts`): no "Hint", no
"Show me", and no stroke missed 3 times (when Hanzi Writer shows it by
itself). An item can be written once it can be read (recognition level 1 or
more, hanzi only, at most 4). Writing has its own spaced repetition in
`ProgressData.writing`, so a miss while writing doesn't reset reading.
`createSessionExercises` asks an item in writing when it comes up in a
session and its writing is due (`isWritingDue`); otherwise, a recognition
exercise. So writing reviews ride on the sessions and never add to the
"due" counts. It can be turned off in Settings (`writingExercises`). If the
strokes can't be loaded, the exercise is skipped (`skip` action) without
counting.

Characters never written before are taught first, inside the same
exercise: the user traces the character over its outline, with the next
stroke flashed to show the order (`WritingPad` mode `trace`), then writes it without the
outline, with a missed stroke shown at once (`guided`), and only then writes
the item from memory (`memory`, the one graded). `getCharactersToTeach`
picks them: a character is taught once it is in `ProgressData.writingTaught`
(synced, the earliest date wins) or belongs to an item already written right,
so writing learned before this step doesn't start over.

**Keyboard.** `useSessionShortcuts` (`practice/shortcuts.ts`) gives each
exercise its keys: Space shows a flashcard's answer and 1/2 answer it; 1-4
pick a choice option and Enter continues; in Learn, 1/2/3 are skip, already
known and learned. They are off while the dictionary panel is open
(`ShortcutsEnabledContext`), and the key hints (`Kbd`) only show with a fine
pointer.

### Spaced repetition

`src/features/srs/srs.ts` exposes two functions:

```ts
scheduleNextReview(masteryLevel: number, wasCorrect: boolean, now: Date): { masteryLevel, nextReviewAt }
isReviewDue(nextReviewAt: string, now: Date): boolean
```

For the MVP: a Leitner-style box system. Correct → goes up a level; wrong →
back to 0. Intervals per level: 0, 1, 3, 7, 14, 30 days, counted in local
calendar days (the "tomorrow" review is available from 00:00).
The rest of the app only knows these functions, so switching to SM-2 or FSRS
later does not affect anything else.

**Progress** (`src/features/progress/`):

- `progress.ts`: `recordAnswer` updates the item's counters, asks
  the SRS for its next review and adds the answer to the day's activity.
  State of each item: new (never seen), learning or mastered
  (level 4 or more: next review in 14 days or more).
- `streak.ts`: current and longest streak, by local days. If you have not yet
  studied today, yesterday's streak still counts.
- `ProgressProvider` + `useProgress()`: progress lives in a React
  Context and is saved on every change. Each answer is saved immediately, so
  leaving in the middle of a session loses nothing.

**What goes into a session** (`selectSessionItems`): first the pending
reviews (the most overdue first), then new items (the most frequent first, see
`frequencyRank`) and, if more are still needed, the studied ones whose review
is closest. Then they are shuffled.

**Difficult items** (`isDifficult` in `stats.ts`, "leeches" in Anki): missed
at least 3 times and right less than 60% of the time. Progress lists them and
offers a session with only them.

### Persistence

`localStorage` behind a small module (`loadProgress` / `saveProgress`
in `progress/storage.ts`, on top of `lib/storage.ts`). The stored object carries a
`version` field so data can be migrated when the format changes. If what is
stored is corrupt or localStorage is unavailable (private mode), the
app works the same, without saving. With an account, what is stored is also copied to
Supabase (see "Accounts and sync"). What is downloaded from external sources does not go here but in IndexedDB (see
"Runtime sources"); it is not user data and can be
deleted without losing anything.

### Accounts and sync

The account is optional: without signing in everything stays in localStorage as
always. When signed in (Google or email link, in Profile), the user's data is
synced across devices.

- **Where**: Supabase, in the `user_data` table (`supabase/schema.sql`): one
  row per user with the same JSON that is in localStorage (progress, My
  Studies, custom sets and settings) and an `updated_at`. The table's
  policies only let each user read and write their own row, so the project's URL and
  public key can go in the browser (`.env.production` and
  `.env.development`). Without a key, there are no accounts and the Profile card is not
  shown. In tests there is never a project.
- **How** (`features/account/AccountProvider.tsx` and `features/sync/`): the data
  Providers save through an observed storage
  (`observeStorage`), so each real change is marked as pending and
  uploaded a few seconds later, batched. On sign-in, on returning to the app and on
  regaining connection it syncs (`syncUserData`), and `planSync` decides
  what to do by comparing the cloud's `updated_at` with the last one seen here:
  upload, download, merge or nothing. If what is stored changes, the Providers are
  remounted to load it.
- **Merge** (`merge.ts`): for each character or word, the one reviewed
  latest is kept; for each day, the record with more answers; sets are unioned.
  It only happens when both sides have changed or the first time a
  device uses the account. Known limitation: a set removed on one
  device comes back if another device had it and both had changed
  at the same time.
- **Signing out** uploads what is pending and leaves the data in the browser. The
  next account to sign in on that browser will merge its data with it.
- The localStorage keys (`hanzivocab.*`, and `hanzivocab.sync` for the
  sync state) keep the app's old name.

### Audio (future, outside the MVP)

Planned idea: a `speak(text)` interface implemented with the browser's Web Speech API
(`speechSynthesis`, `zh-CN` voice): free and serverless. Limitation: it depends on
the voices installed on the system. Since the whole app uses the interface, it
can later be swapped for recorded audio without touching the components.

### Internationalization

- Interface texts: `src/i18n/en.ts` is the source and the active language;
  `es.ts` (and later `ca.ts`) must have the same keys (TypeScript checks
  this). Function `t('key')`.
- Content: `meanings` is an object per language with English required
  (it comes from CC-CEDICT), so adding Spanish or Catalan does not change the model.

## 7. Identified problems

1. **HSK version.** There are two standards: HSK 2.0 (level 1 = 150 words)
   and the new 2021 standard, "HSK 3.0" (level 1 = 500 words and 300
   characters, and the levels do not match the old ones).
   **Decided: HSK 2.0 for the MVP**, because it is smaller and is the one most
   materials use. The `hskLevel` field can be accompanied by a
   standard field if we later include both.
2. **Language and source of meanings.** The reliable open sources
   (CC-CEDICT, CC BY-SA 4.0 license) give meanings in **English** and there is
   no equivalent open Chinese-Spanish dictionary.
   **Decided: for now the interface and the meanings are in English**,
   using CC-CEDICT. Spanish is kept ready (`i18n/es.ts` and
   `meanings.es`). Dataset details and license in `docs/DATA_SOURCES.md`.
3. **Character and word at once.** 好 is a character and also an HSK 1
   word. That is why progress uses prefixed ids (`char:好`, `word:好`) and the
   two are studied separately.
4. **Several pinyin readings.** Some characters have more than one
   pronunciation; in the pinyin exercise one is shown and the
   distractors cannot match any of them. **Solved in phase 7.**
5. **Distractors.** Incorrect options must not be synonyms of the
   correct one or repeat. **Solved in phase 7** (see "Current types").
6. **Dates and streak.** The streak is computed by local day, not UTC; otherwise
   studying at midnight would give odd results.
7. **Chinese fonts.** System fonts are used (PingFang SC, Noto Sans SC,
   Microsoft YaHei) so as not to download several MB or depend on the internet.

## 8. MVP technical plan

| Phase | Deliverable | Tests |
| --- | --- | --- |
| 1 | This document | — |
| 2 | Vite + React + strict TS + Tailwind + oxlint + Vitest project, runnable | Smoke test of the root component |
| 3 | Layout, navigation (react-router), empty pages, base UI components, i18n | Navigation between sections |
| 4 | Domain types and query functions | Data functions |
| 5 | HSK 1 dataset with documented sources | Dataset validation (unique ids, valid references) |
| 6 | Flashcards | Flashcard component |
| 7 | Recognition exercises (meaning, pinyin, reverse) | Option and distractor generation |
| 8 | Progress + SRS + persistence | Progress calculation, scheduling, streak |
| 9 | Dashboard | — |
| 10 | Basic statistics | Statistics calculation |
| 11 | Complete tests for critical parts | — |
| 12 | Review, refactor, accessibility | — |

**Status: MVP complete (phases 1-12).** In addition to the plan, the Vocabulary and
Characters lists and detail pages and the Settings page were built, which were in the
sections table. Final review: no axe-core (accessibility) errors on
any page, keyboard navigable and tested at 390 px and 1280 px.

**Pending for after the MVP:** audio (Web Speech API), writing
practice, Spanish meanings, frequency, HSK levels 2-4.

**Data integration (after the MVP):** character detail pages with data from
CC-CEDICT, Unihan, Make Me a Hanzi, hanzi-writer-data and Tatoeba, generated with
the pipeline described in `docs/DATA_SOURCES.md`.
