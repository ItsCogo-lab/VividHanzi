#!/usr/bin/env bash
# Downloads the dataset sources into scripts/dataset/.cache (not versioned).
# Versions are pinned so the result is reproducible.
set -euo pipefail

CACHE_DIR="$(dirname "$0")/.cache"
mkdir -p "$CACHE_DIR"
cd "$CACHE_DIR"

# HSK 2.0 lists, levels 1 to 5, with the exam's pinyin. MIT license.
# Pinned to a commit so the result is reproducible. Levels 1-4 are study
# sets; level 5 is only used by Today's Word (see build.ts).
HSK_COMMIT=f3dc9d12ae00d04fa3676b0bd4c43cd58de2c264
for level in 1 2 3 4 5; do
  curl -sSfL -o "hsk-level-${level}.json" \
    "https://raw.githubusercontent.com/clem109/hsk-vocabulary/${HSK_COMMIT}/hsk-vocab-json/hsk-level-${level}.json"
done

# CC-CEDICT in JSON format (2025-12-13 edition). CC BY-SA 4.0 license.
npm pack cedict-json@1.3.20251213 --silent > /dev/null
tar -xzf cedict-json-1.3.20251213.tgz package/cedict.json
mv package/cedict.json cedict.json
rm -rf package cedict-json-1.3.20251213.tgz

# Make Me a Hanzi, dictionary.txt pinned to a commit. LGPL 3.0 or later license.
MAKEMEAHANZI_COMMIT=bddc96d41bef78427ed0e034e9f7e31d71fd1b92
curl -sSfL -o makemeahanzi-dictionary.txt \
  "https://raw.githubusercontent.com/skishore/makemeahanzi/${MAKEMEAHANZI_COMMIT}/dictionary.txt"

# Unihan and the Unicode 18.0 radicals list. Unicode License v3.
# unicode.org is not reachable from Claude's cloud environment: this step
# runs locally or in GitHub Actions (.github/workflows/dataset.yml).
UNICODE_VERSION=18.0.0
mkdir -p unihan
curl -sSfL -o Unihan.zip "https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/Unihan.zip"
unzip -o -q Unihan.zip Unihan_IRGSources.txt Unihan_Variants.txt -d unihan
rm Unihan.zip
curl -sSfL -o unihan/CJKRadicals.txt "https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/CJKRadicals.txt"

# Tatoeba: Chinese and English sentences and their links. CC BY 2.0 FR license.
# Tatoeba publishes a new export every week and does not keep the old ones,
# so the download date is recorded next to the files.
# tatoeba.org is not reachable from Claude's cloud environment either.
TATOEBA_EXPORTS=https://downloads.tatoeba.org/exports/per_language
mkdir -p tatoeba
for file in cmn/cmn_sentences_detailed cmn/cmn-eng_links eng/eng_sentences_detailed; do
  curl -sSfL "${TATOEBA_EXPORTS}/${file}.tsv.bz2" | bunzip2 > "tatoeba/$(basename "$file").tsv"
done
date -u +%Y-%m-%d > tatoeba/export-date.txt

# wordfreq: word frequencies from subtitles, Wikipedia, news and more.
# Code Apache 2.0, data CC BY-SA 4.0. It is a Python package, so it is
# installed in its own virtual environment and its Chinese list exported as TSV.
WORDFREQ_VERSION=3.1.1
python3 -m venv wordfreq-venv
wordfreq-venv/bin/pip install --quiet --disable-pip-version-check "wordfreq==${WORDFREQ_VERSION}"
wordfreq-venv/bin/python ../export-wordfreq.py > wordfreq-zh.tsv
rm -rf wordfreq-venv

echo "Sources downloaded to $CACHE_DIR"
