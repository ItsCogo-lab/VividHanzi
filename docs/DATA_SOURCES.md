# Data sources

All of VividHanzi's linguistic data comes from open sources. Nothing is
written by hand or generated with AI. There are two ways it reaches the app:

- **Generated with a script** (`npm run data:build`): HSK 1-4 and the local
  copies of HSK stroke data and sentences are committed to this repository; the
  full dictionary is published in a separate data repository
  (`ItsCogo-lab/HanziDict`) and the app reads it at runtime. If something
  needs fixing, change the script and regenerate.
- **Requested at runtime** from the source, with a browser cache:
  the full dictionary (data repository on jsDelivr), stroke order
  (jsDelivr) and example sentences (Tatoeba API). See
  [Runtime sources](#runtime-sources).

## How it is generated

```
sources → adapters → fusion → validation → generated files → app
```

| Step | Where | What it does |
| --- | --- | --- |
| Download | `scripts/dataset/fetch-sources.sh` | Downloads each source, at a pinned version, into `scripts/dataset/.cache` (not versioned). |
| Adapters | `scripts/dataset/sources/*.ts` | One per source. They read the original format and return only the fields that source owns. They know nothing about the other sources. |
| Fusion | `scripts/dataset/fusion.ts` | Combines the adapters field by field according to `FIELD_SOURCES` and compares sources that cover the same thing. |
| Validation | `src/features/dictionary/validation.ts` | Checks the result. If anything fails, nothing is written. |
| Output | `src/data/`, `public/strokes/`, `public/examples/`; the full dictionary in `data-release/` (not committed) | See "Generated files" and "Data repository". |

```bash
npm run data:fetch      # download the sources
npm run data:build      # generate the files
npm run data:validate   # validate the generated files without downloading anything
npm run check           # types, lint and tests (including the dataset)
```

### Where to run it

`unicode.org` and `tatoeba.org` are not reachable from the cloud environment
where Claude works, so a full `data:fetch` only works:

- **Locally**: `npm ci && npm run data:fetch && npm run data:build && npm run data:validate`.
  Needs `curl`, `unzip`, `bunzip2` and Python 3 (for wordfreq).
- **In GitHub Actions**: the `Dataset` workflow (`.github/workflows/dataset.yml`)
  runs when changes to `scripts/dataset/` are pushed to any branch other than
  `main`, and pushes the regenerated dataset to that branch. On `main` it is
  launched manually and only checks that the dataset is up to date.

To try the script without those sources there is
`node scripts/dataset/build.ts --without=unihan,tatoeba`. That output is
incomplete and must not be committed.

### Determinism

With the same files in `.cache`, the build always produces the same files: it
uses no current date, no randomness and no AI model. The sources are pinned to
a version (Unicode 18.0.0, a specific Make Me a Hanzi commit, exact npm package
versions). The exception is Tatoeba, which publishes a new export every week
and does not keep the previous ones: the download date is stored in
`exportDate` inside `public/examples/hsk<n>.json`.

## Which source owns each field

Each field has a single owner source. If that source does not have the data, the
field stays empty and the detail card does not show that section: no other
source fills it in.

| Entity | Field | Source |
| --- | --- | --- |
| Character | `hskLevel` | HSK list |
| Character | `pinyin` | CC-CEDICT (the reading it has in HSK words) |
| Character | `meanings.en` | CC-CEDICT |
| Character | `strokeCount` | hanzi-writer-data (stroke count of the animation) |
| Character | `radical`, `radicalNumber` | Unihan `kRSUnicode` + `CJKRadicals.txt` |
| Character | `traditional` | Unihan `kTraditionalVariant` |
| Character | `decomposition`, `etymology` | Make Me a Hanzi |
| Character | stroke order (`public/strokes/`) | hanzi-writer-data |
| Character | `frequencyRank` | wordfreq (sum over the words it is in) |
| Word | `hskLevel`, `pinyin` | HSK list |
| Word | `meanings.en`, `traditional` | CC-CEDICT |
| Word | `frequencyRank` | wordfreq |
| Sentences | `public/examples/` | Tatoeba |

The full dictionary (outside HSK 1-4) follows the same rules, except that it
has no HSK level, no `frequencyRank` and the pinyin of its words comes from CC-CEDICT. See
"Full dictionary".

These are not stored because they are computed: a character's related words
(`getWordsWithCharacter`), the characters of a word and the components of a
character (from `decomposition`).

### Cross-source checks

The build compares:

- Unihan's stroke count with hanzi-writer-data's;
- Unihan's radical with Make Me a Hanzi's.

If they disagree, the field's owner source is used (hanzi-writer-data for
strokes, Unihan for the radical) and the disagreement is recorded in
[`DATA_CONFLICTS.md`](DATA_CONFLICTS.md) for review. It is never resolved
silently.

## Sources

### CC-CEDICT

- **URL:** https://cc-cedict.org/wiki/ (via the npm package [`cedict-json`](https://www.npmjs.com/package/cedict-json))
- **Version:** 2025-12-13 edition (`cedict-json@1.3.20251213`)
- **License:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), © MDBG and CC-CEDICT contributors
- **Attribution:** cite CC-CEDICT wherever the data is shown (Settings → About the data). Derived data is shared under the same license.
- **Fields:** English meanings of characters and words, the reading of each character, the traditional form of each word.
- **Adapter:** `sources/cedict.ts`

Adapter rules:

1. **Words:** entries with the same hanzi and the same pinyin are looked up
   (including capital letters, which mark proper nouns: 苹果 *píng guǒ* is
   "apple", not the company).
2. **Characters:** their pinyin is the reading they have in words.
   For a neutral tone, the neutral entry is used if it exists (吗 *ma*);
   otherwise the toned reading (东西 *dōng xi* → 西 *xī*).
3. **Meanings:** notes that are not translations ("variant
   of", "surname", "CL:"...) and internal notation (`兩|两[liang3]` → `两`)
   are removed. At most 6, in CC-CEDICT order. If a reading has only notes
   (柠 *níng*: "used in 柠檬"), they are kept.
4. **Traditional form of words:** the form of the entries with translations.
   If there are two different ones (回 and 迴 for *huí*), neither is chosen.
5. **Manual decisions:** `PREFERRED_TRADITIONAL`, with the reason (里 "inside"
   rather than the unit of length).

### Unicode Unihan

- **URL:** https://www.unicode.org/reports/tr38/ (files `Unihan.zip` and `CJKRadicals.txt` from https://www.unicode.org/Public/18.0.0/ucd/)
- **Version:** Unicode 18.0.0
- **License:** [Unicode License v3](https://www.unicode.org/license.txt)
- **Attribution:** include the Unicode copyright notice in the documentation (this file) and cite the source in Settings.
- **Fields:** `radical` and `radicalNumber` (first value of `kRSUnicode`; `149'` is the simplified form of radical 149, 讠), `traditional` (`kTraditionalVariant`). Its stroke count (first value of `kTotalStrokes`) is only used to check hanzi-writer-data's: for some characters it counts one stroke more (菜 12, the animation draws 11).
- **Adapter:** `sources/unihan.ts`
- **Download:** not reachable from Claude's cloud environment (see "Where to run it").

### Make Me a Hanzi

- **URL:** https://github.com/skishore/makemeahanzi (`dictionary.txt`)
- **Version:** commit `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`
- **License:** `dictionary.txt` under [LGPL 3.0 or later](https://www.gnu.org/licenses/lgpl-3.0.html) (derived from Unihan and cjklib)
- **Attribution:** cite the project; data derived from this file stays under LGPL.
- **Fields:** `decomposition` (IDS sequence, e.g. `⿰木宁`; if it starts with `？` it is unknown and not used), `etymology` (type, hint, semantic and phonetic component). Its `radical` is only used to check Unihan's.
- **Adapter:** `sources/makemeahanzi.ts`

It is the same source the etymology in the Tofu Learn app came from.

### Hanzi Writer and hanzi-writer-data

- **URL:** https://github.com/chanind/hanzi-writer y https://github.com/chanind/hanzi-writer-data
- **Version:** `hanzi-writer@3.7.3` (app dependency) and `hanzi-writer-data@2.0.1` (dev dependency, build only)
- **License:** the library, MIT. The stroke data, [Arphic Public License](https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT) (it comes from Make Me a Hanzi, which extracted it from Arphic Technology typefaces).
- **Attribution:** cite hanzi-writer-data and Arphic Technology; it can be redistributed and modified under the same license.
- **Fields:** strokes of each character, copied unchanged to `public/strokes/<code point>.json` (柠 → `67e0.json`). It also provides `strokeCount`, the number of strokes, so that it always matches the animation.
- **Adapter:** `sources/hanziWriter.ts`

### Tatoeba

- **URL:** https://tatoeba.org (exports from https://downloads.tatoeba.org/exports/per_language/: `cmn_sentences_detailed.tsv`, `eng_sentences_detailed.tsv`, `cmn-eng_links.tsv`)
- **Version:** the weekly export from the day `data:fetch` is run; its date is stored in `exportDate`.
- **License:** [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/). Some sentences are also available as CC0, but all have at least CC BY.
- **Attribution:** each sentence is shown with its Tatoeba number, its author and a link to its page, where the translation is also found.
- **Fields:** Chinese sentence, English translation, ids and authors of both, words it was chosen for.
- **Adapter:** `sources/tatoeba.ts`
- **Download:** not reachable from Claude's cloud environment (see "Where to run it").

Selection criteria (deterministic): Chinese sentences with an author, at most 16
characters, without Latin letters or digits and whose Chinese characters are
all of the same HSK level or a lower one (someone studying HSK 1 can
read a whole HSK 1 sentence). Per word, the 3 shortest (for equal length, the
one with the lowest id), with the English translation with the lowest id. Sentences are copied
as they are. Their pinyin is generated in the browser (see "Pinyin of the
example sentences").

### HSK 2.0 list

- **URL:** https://github.com/clem109/hsk-vocabulary (`hsk-vocab-json/hsk-level-1.json` a `hsk-level-4.json`)
- **Version:** commit `f3dc9d12ae00d04fa3676b0bd4c43cd58de2c264`
- **License:** MIT, © 2018 Clement Venard
- **Attribution:** cite the repository.
- **Fields:** the HSK 1 to 4 words and their exam pinyin. Its translations are not used.
- **Adapter:** `sources/hsk.ts`

Rules when merging the levels (`buildBaseEntries` in `fusion.ts`):

1. **Level of a character:** that of the first word it appears in
   (他 is HSK 1 even though it also appears in HSK 3 words).
2. **Homographs:** if the list has the same word with two
   pronunciations (长 *cháng* "long" and 长 *zhǎng* "to grow"; 得, 还, 只),
   they are two distinct words and their id carries the pinyin: `长[cháng]`,
   `长[zhǎng]`. All other words use the hanzi as id.
3. **Repetitions:** if the list repeats a word with the same pinyin
   (等, 对 and 过 in HSK 4, with two senses each), it is stored once.
4. **Neutral tone:** the HSK list marks the tone on some syllables that
   CC-CEDICT annotates as neutral tone (关系 *guān xì* / *guān xi*). They are treated as
   the same word and the HSK list's pinyin is shown.
5. **"also pr.":** if CC-CEDICT says a character is also pronounced
   another way (钥 *yuè*: "also pr. [yao4]"), that reading is valid for the
   words that use it (钥匙 *yào shi*).
6. **No CC-CEDICT entry:** the word is left out (there is nowhere to get
   its meaning from) and appears in `DATA_CONFLICTS.md`. Today it is only
   打篮球 (HSK 2), which CC-CEDICT does not have as an entry.

That is why the levels do not have exactly the official number of words
(150/150/300/600): HSK 1 has 150, HSK 2 149, HSK 3 299 (the clem109
list has 299) and HSK 4 598 (the list has 601, with 3 repetitions).

### wordfreq

- **URL:** https://github.com/rspeer/wordfreq (Python package on PyPI)
- **Version:** `wordfreq==3.1.1`
- **License:** code Apache 2.0; data CC BY-SA 4.0 (it combines subtitles,
  Wikipedia, news, books and web text; see its README for the full list)
- **Attribution:** Robyn Speer, wordfreq, cited in the generated files and here.
- **Fields:** `frequencyRank` of HSK 1-4 words and characters (1 = the most
  common). Words not in the list have no rank.
- **Adapter:** `sources/wordfreq.ts`; `export-wordfreq.py` exports the
  Chinese list as TSV (`fetch-sources.sh` installs the package in a temporary
  virtual environment).

How the ranks are computed:

1. **Words:** position in wordfreq's Chinese list (simplified), counting only
   entries made of hanzi (English words and numbers in the list don't take
   up positions).
2. **Characters:** by the sum of the frequencies of every word in the list
   that contains them. Counting the character only as a standalone word would
   undercount the ones that rarely appear alone: 们 is almost always in 我们,
   你们 or 他们.

The app uses it to put the most common vocabulary first: new items in a
mixed session and the Learn order of HSK levels (topic and custom sets keep
their own order). Character cards show the rank.

## HSK 5 (Today's Word)

HSK 5 is not a study set. The build reads the HSK 5 list from the same
source as HSK 1-4 and writes `src/data/hsk5/words.ts` (`buildHsk5Words` in
`fusion.ts`), which only Today's Word on Home uses:

- **Pinyin** from the HSK list, **meanings** from CC-CEDICT, found with the
  same `findEntries` as HSK 1-4.
- **No new dictionary entries:** each word points to the entry that already
  holds those CC-CEDICT entries (an HSK 1-4 word, a full-dictionary word, or
  its character for single-character words), so tapping it opens the usual
  entry page.
- Words already in HSK 1-4 with the same pinyin are skipped; words with no
  CC-CEDICT entry or nothing to open are left out and listed in
  `DATA_CONFLICTS.md`.

## Full dictionary

Besides HSK 1-4, the build generates all of CC-CEDICT in `data-release/dictionary/`
(`buildFullEntries` in `fusion.ts`), which is published in the data repository. It is used to search for any word and
to add it to a custom set. Rules:

1. **What is included:** entries written entirely with Chinese characters and with
   a known reading. Entries with letters, digits or
   symbols ("T恤", "110", "%") and those CC-CEDICT annotates with unknown
   pinyin (`xx5`, like 々) are left out.
2. **No HSK repeats:** entries already used by an HSK 1-4 word do not
   appear again, nor do HSK 1-4 characters.
3. **Characters:** a single-character entry. It carries all its
   readings; proper-noun ones ("surname Xxx") only count if it has no
   others. The other fields (radical, strokes, decomposition, etymology,
   traditional) come from their owner source, as in HSK.
4. **Words:** one per distinct hanzi and pinyin, with CC-CEDICT's pinyin
   (capital letters mark proper nouns: 苹果 *Píng guǒ* is
   "Apple", separate from HSK 1's 苹果 *píng guǒ*). If there is another word with the
   same hanzi, the id carries the pinyin: `苹果[Píng guǒ]`.
5. **Words that cannot be taught:** if a character of the word has no
   entry of its own (碁 in 宏碁), the word is left out. Everything
   left out appears in `DATA_CONFLICTS.md`.
6. **No HSK level.** Sentences and the stroke animation are not in these
   files: the detail card requests them at runtime from Tatoeba and jsDelivr,
   like the HSK ones. Only the stroke count from hanzi-writer-data is used here.

It is split into 32 files (`CHUNK_COUNT` in
`src/features/dictionary/fullDictionary.ts`): each entry goes in the file matching
the code point of its first character modulo 32. This way the app knows which file to request
from the hanzi alone, without a separate index. It takes about 18 MB (about 4.7 MB
gzipped; the largest file, about 200 KB gzipped).

### Data repository

There is no public API for CC-CEDICT, Unihan or Make Me a Hanzi that can
be used from the browser (see the table below), so the full dictionary
is published in a separate public repository,
[ItsCogo-lab/HanziDict](https://github.com/ItsCogo-lab/HanziDict),
and the app reads it through jsDelivr. This way it can be updated without touching the app, and the
app's repository does not carry 18 MB of data.

- **Structure:** `v1/manifest.json` (format, current version, generation
  date and version of each source) and `v1/<version>/dictionary/0.json` to
  `31.json`. A version folder is never modified; the two previous ones
  are kept.
- **Endpoints:** `https://cdn.jsdelivr.net/gh/ItsCogo-lab/HanziDict@main/v1/manifest.json`
  and `…@main/v1/<version>/dictionary/<n>.json`.
- **License and attribution:** those of the sources (CC BY-SA 4.0 for
  CC-CEDICT; Unicode License v3; LGPL 3.0+; Arphic), written in its README.
- **Limits:** jsDelivr does not publish per-user limits for small
  files; the app makes at most 120 requests per minute to this source
  (a full search is 33: the manifest and 32 chunks) and respects 429s.
- **CORS:** `access-control-allow-origin: *` (checked from GitHub Actions).
- **Authentication:** none; the repository is public and there are no keys.
- **Cache:** the manifest, 1 day (and jsDelivr keeps it up to 12 hours); each
  chunk is stored in IndexedDB with its version and only requested again when
  the manifest reports another version.
- **On failure:** with no manifest and no network, the stored chunks are used (even
  if from an earlier version). If nothing is stored, search continues
  in HSK 1-4 and says so ("Couldn't load the full dictionary…"), and a custom set
  with non-HSK words warns that it cannot load them. HSK, Learn and
  Study do not depend on this.
- **Adapter:** `src/features/dictionary/runtime/dictionarySource.ts`.

Publishing a new version (no PR or app build):

1. Manually launch the **Publish data** workflow with the new version (greater than
   the current one, e.g. `1.1.0`). It downloads the sources, generates and validates the
   dictionary, writes the version folder and the manifest to
   HanziDict, commits to its `main` and notifies jsDelivr. It needs the
   secret `DATA_REPO_TOKEN` (a fine-grained token with "Contents: Read and
   write" only on HanziDict).
2. Or by hand: `npm run data:fetch && npm run data:build && npm run data:validate`
   and `npm run data:release -- 1.1.0 <HanziDict checkout>`, then
   commit and push in that repository.

If the data format changes incompatibly, `DATA_FORMAT` is bumped
in `dictionarySource.ts` and the data goes in `v2/`: app versions that
are already published keep reading `v1/`.

## Runtime sources

Before moving anything to runtime, we investigated which APIs really exist
for each source (report of 2026-09-29, checked from GitHub
Actions because Claude's environment cannot reach those domains):

| Source | Real API? | What is done |
| --- | --- | --- |
| hanzi-writer-data (strokes) | Yes: jsDelivr, the CDN Hanzi Writer loads them from by default | At runtime |
| Tatoeba (sentences) | Yes: API v1, public and keyless | At runtime |
| CC-CEDICT (meanings, pinyin) | No: it is a file. MDBG forbids automated access; ccdb.hemiola.com is HTTP-only | Generated by us and read at runtime from the [data repository](#data-repository); HSK 1-4, in the app |
| Unihan (radical, strokes) | No: Unicode only publishes files | Same as CC-CEDICT |
| Make Me a Hanzi (decomposition, etymology) | No: a 2.5 MB file on GitHub, which is not a CDN | Same as CC-CEDICT |
| HSK list | No | Local, as the design requires |

### Strokes: hanzi-writer-data on jsDelivr

- **Why:** it is the source that already owned strokes and jsDelivr is where
  Hanzi Writer loads them from by default. With it, the animation works on the
  ~9,500 characters hanzi-writer-data has, not just the HSK 1-4 ones.
- **Endpoint:** `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/<character>.json`,
  with the version pinned in the URL.
- **License and attribution:** Arphic Public License (like the local copy).
- **Limits:** jsDelivr does not publish a per-user limit. The app makes at
  most 60 requests per minute to this source and, on a 429, waits for
  whatever `Retry-After` says (or a minute).
- **CORS:** `access-control-allow-origin: *` (checked).
- **Authentication:** none.
- **Cache:** 365 days. Files of a given version do not change
  (`cache-control: immutable`); the cache key carries the version, so
  changing version means changing `STROKE_DATA_VERSION`.
- **On failure:** in HSK 1-4, the local copy in `public/strokes/`. Outside HSK,
  the card says "Stroke order unavailable offline.". A 404 (character without
  strokes) hides the section.
- **Fields:** `strokes`, `medians`, `radStrokes`. The card's stroke count
  still comes from the local dataset.
- **Adapter:** `src/features/dictionary/runtime/strokeSource.ts`

### Sentences: Tatoeba API v1

- **Why:** it is the official API of the source that was already used; the old
  `api_v0` is deprecated. It gives new and corrected sentences without regenerating anything.
- **Endpoint:** `https://api.tatoeba.org/v1/sentences?lang=cmn&q="<term>"&sort=words&showtrans:lang=eng&trans:lang=eng&limit=50`.
  `sort=words` returns the shortest sentences first; 50 is the maximum per page.
- **License and attribution:** CC BY 2.0 FR. Only sentences and translations
  with that license, with an author and not flagged as doubtful are used; each sentence is
  shown with its number, its author and a link to its page.
- **Limits:** Tatoeba does not publish limits, but its terms of use
  forbid overloading the service. The app makes at most 20 requests per
  minute, one per opened card (never when searching), and respects 429s.
- **CORS:** `access-control-allow-origin: *` (checked).
- **Authentication:** none.
- **Cache:** 7 days; after that the stored data is shown and it is requested
  again in the background.
- **On failure:** in HSK 1-4, the local sentences in `public/examples/`. Outside
  HSK, "Example sentences unavailable offline.".
- **Selection:** the same rules as the script (at most 16 characters,
  no Latin letters or digits, with a direct English translation), plus: the sentence
  must contain the term as is (Tatoeba also returns sentences in
  traditional). 3 are shown, first those that only use HSK 1-4 characters
  or the term's own. As the translation, the direct one with the lowest id: indirect
  ones (a translation of a translation) may not match the sentence
  (好大！ came out as "God, this place is huge!").
- **Adapter:** `src/features/dictionary/runtime/tatoebaSource.ts`

### Pinyin of the example sentences

Tatoeba's API v1 does not return transcriptions (checked from GitHub
Actions on 2026-09-29: neither in `/v1/sentences/{id}` nor in search). The
`transcriptions.tar.bz2` export does have numeric pinyin for about
89,000 Chinese sentences, but most are automatically generated (with no
user reviewing them), just as an engine would do.

That is why the pinyin of the example sentences, whether from Tatoeba at runtime
or from HSK 1-4, comes from the same engine as custom sentences
(`customSets/pinyinEngine.ts`: pinyin-pro checked against the HSK dataset). What
the engine cannot be sure of is marked with "?" and without color. Limits:

- Neutral tones are only corrected with the HSK 1-4 dataset (朋友 péng you);
  outside HSK the engine may give a full tone.
- A character with several readings outside a known word comes out doubtful
  (谁 shéi / shuí).

### What stays local

HSK 1-4 (levels, HSK and topic sets), progress, settings, custom sets
with their meanings and sentences (never sent anywhere), the
pinyin of custom sentences (pinyin-pro, in the browser) and tone
colors. Learn and Study depend only on this: if an external source fails, you
can keep studying as usual.

## Topic sets

`src/data/topics.ts` and `src/data/grammar.ts` are the only files in `src/data` written by hand. It defines
17 topics (Food & drink, Family, Travel, School & university, Time & dates,
Numbers, Weather, Daily life, Emotions, Body & health, Shopping & money,
Transportation, Nature, Technology, Work, Animals, Colors). Criteria:

- Only words that are already in the HSK 1-4 dataset. The file adds no
  vocabulary, pinyin or meanings. A test checks that every id exists.
- A word goes in a topic if any of the meanings the app shows
  (CC-CEDICT) belongs to the topic. If that sense does not appear, it is not included
  (点 is not in Time).
- A word can be in several topics; its progress is single.
- The app states this in the Topics tab: they are a curated selection, not an
  official list.

## Grammar notes

`src/data/grammar.ts`, written by hand. The card for the most common function
words of HSK 1-4 shows a Grammar section with their uses (30 points):

- Particles: 的 (possession and modifiers), 了 (completed action and change of
  state), 吗, 呢 ("and you?"), 吧 (suggestions and softening), 过, 着, 得, 地
  and 啊.
- Prepositions and verbs with a pattern of their own: 被, 把, 比, 在 (actions
  in progress, with 正在, and location), 会 (learned skills).
- Paired words: 越来越, 虽然...但是, 因为...所以, 如果...就, 一边...一边,
  除了...以外, 不但...而且, 跟...一样, 还是 vs 或者, 太...了, 连...都.

Criteria:

- **Reference:** [Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar/)
  by AllSet Learning, which decides which uses are included and their names. Its content is
  **CC BY-NC-SA 3.0** (non-commercial and share-alike), incompatible with a
  paid app. That is why the explanations are **original**, neither its
  text nor its sentences are copied, and each point only **links** to its page.
- **Examples:** Tatoeba sentences (CC BY 2.0 FR) that are already in
  `public/examples/`, copied as they are with their id and author. A test checks
  that they exist there unchanged and that they contain the word. A use without sentences
  in Tatoeba is not included (the progressive-action 呢, the 是...的 emphasis).
- **Where they appear:** on the character's card always; on a word, only if
  its toneless pinyin is that of the use (得 "de" yes, 得 "děi" no). A pair
  also shows on its second word through `alsoShownOn` (但是 shows
  虽然...但是). A test checks that every point shows on an HSK 1-4 word.

## Generated files

| File | Contents | How it is loaded |
| --- | --- | --- |
| `src/data/hsk1/` to `hsk4/`: `characters.ts`, `words.ts` | Characters and words of each level | In the bundle, in a separate file from the app code |
| `public/strokes/*.json` | Strokes of the HSK 1-4 characters | Only if jsDelivr does not respond |
| `public/examples/hsk1.json` to `hsk4.json` | Example sentences for the words of each level | Only if Tatoeba does not respond or has no sentences |
| `data-release/dictionary/0.json` to `31.json` (not committed) | Full dictionary, outside HSK 1-4 | Published to HanziDict; the app requests one file when opening a card or a set with those entries, and all of them when searching |
| `docs/DATA_CONFLICTS.md` | Disagreements between sources | For review |
| `src/data/topics.ts` (not generated) | Hand-curated topics | In the bundle, with the dataset |

## Data license

The app's code is not affected by these licenses. The generated files
keep that of their source:

- `src/data/`: derived from CC-CEDICT (CC BY-SA 4.0), with fields from Unihan
  (Unicode License v3), Make Me a Hanzi (LGPL 3.0+) and wordfreq (CC BY-SA 4.0).
- `public/strokes/`: Arphic Public License.
- `public/examples/`: CC BY 2.0 FR.
- HanziDict (full dictionary): same as `src/data/`.

Unicode notice: Copyright © Unicode, Inc. The Unihan data is
distributed under the terms of the Unicode License v3
(https://www.unicode.org/license.txt).

## To do

- **Frequency in the full dictionary:** only HSK 1-4 has `frequencyRank` for
  now; adding it to HanziDict means publishing a new data release.
- **Spanish meanings:** later, in `meanings.es`.
- **Quality of some meanings:** CC-CEDICT does not always put the HSK 1
  sense first (点 starts with "to touch briefly" before "o'clock"; 咸
  starts with "all; everyone" before "salted").