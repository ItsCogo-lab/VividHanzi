import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { HanziText } from '../../../components/ui/HanziText.tsx'
import { t } from '../../../i18n/index.ts'
import { getSyllableTone, splitSyllables } from '../../../lib/tones.ts'
import { getCharacter, getMeanings } from '../../dictionary/dictionary.ts'
import { useDictionary, useDictionaryStore, useLoadText } from '../../dictionary/dictionaryContext.ts'
import { getEntryPath } from '../../dictionary/entryPaths.ts'
import { TONE_BORDER_CLASSES, TONE_TEXT_CLASSES } from '../../dictionary/toneClasses.ts'
import type { Hsk5Word } from '../../dictionary/types.ts'
import { useSettings } from '../../settings/settingsContext.ts'
import { displayPinyin, getWordTones, groupWords, listSentences, readingText, sentenceText } from '../reading.ts'
import type { Reading, ReadingSentence, ReadingWord } from '../types.ts'
import { findWordEntry, getWordHskLevel } from '../wordEntry.ts'
import { LearnWordButton } from './LearnWordButton.tsx'

/** A word in the text: the key of its sentence (listSentences) and its index there. */
type Selection = { key: string; word: number }

const HAN = /\p{Script=Han}/u

/**
 * A reading, Du Chinese style: every word underlined in its tones' colors.
 * Tapping a word shows its pinyin above it and, in the panel that stays on
 * top, the sentence's translation and the word's meaning, HSK level and
 * characters, with a button to add it to the words to learn.
 */
export function ReadingView({ reading }: { reading: Reading }) {
  const [selected, setSelected] = useState<Selection>()
  const [showTranslation, setShowTranslation] = useState(true)
  const [allPinyin, setAllPinyin] = useState(false)
  const [hsk5Words, setHsk5Words] = useState<readonly Hsk5Word[]>([])
  // Loads the full-dictionary entries of the text's characters (meanings, HSK words)
  useLoadText(readingText(reading))
  // The HSK 5 list is a separate chunk: only for the HSK level of the words
  useEffect(() => {
    let active = true
    void import('../../../data/hsk5/words.ts').then((module) => active && setHsk5Words(module.hsk5Words))
    return () => {
      active = false
    }
  }, [])

  const selectedSentence = selected && listSentences(reading).find(({ key }) => key === selected.key)?.sentence
  const selectedWord = selected && selectedSentence?.words[selected.word]

  const renderSentence = (sentence: ReadingSentence, key: string) => {
    const isSelected = selected?.key === key
    return (
      <span key={key} className={`box-decoration-clone rounded-md ${isSelected ? 'bg-paper ring-4 ring-paper' : ''}`}>
        {groupWords(sentence.words).map((group) => (
          <span key={group[0]!.index} className="whitespace-nowrap">
            {group.map(({ word, index }) => {
              if (!word.pinyin) return <span key={index}>{word.text}</span>
              const active = isSelected && selected.word === index
              return (
                <WordButton
                  key={index}
                  word={word}
                  active={active}
                  showPinyin={allPinyin || active}
                  onSelect={() => setSelected({ key, word: index })}
                />
              )
            })}
          </span>
        ))}
      </span>
    )
  }

  return (
    <div>
      <div className="sticky top-0 z-[5] -mx-4 border-b border-line bg-surface px-4 py-3 shadow-sm sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-medium tracking-wide text-ink-muted uppercase">{t('readings.sentenceMeaning')}</h2>
          <button
            type="button"
            className="text-sm font-medium text-accent-strong hover:underline"
            onClick={() => setShowTranslation((shown) => !shown)}
          >
            {showTranslation ? t('readings.hide') : t('readings.show')}
          </button>
        </div>
        <p className="mt-1 min-h-6 sm:text-lg">
          {selectedSentence ? (
            showTranslation ? (
              selectedSentence.translation
            ) : (
              '…'
            )
          ) : (
            <span className="text-ink-muted">{t('readings.tapWord')}</span>
          )}
        </p>
        {selectedWord && selectedSentence && (
          <>
            <h2 className="mt-3 border-t border-line pt-3 text-xs font-medium tracking-wide text-ink-muted uppercase">
              {t('readings.wordMeaning')}
            </h2>
            <WordDetails word={selectedWord} sentence={selectedSentence} level={reading.level} hsk5Words={hsk5Words} />
          </>
        )}
      </div>

      <label className="mt-4 flex w-fit items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" checked={allPinyin} onChange={(event) => setAllPinyin(event.target.checked)} />
        {t('readings.showAllPinyin')}
      </label>

      <article lang="zh-Hans" className="font-hanzi mt-2 text-xl leading-[2.9] sm:text-2xl">
        <h1 className="mb-2 font-semibold">{renderSentence(reading.title, 'title')}</h1>
        {reading.paragraphs.map((paragraph, p) =>
          paragraph.speaker ? (
            <div key={p} className="mb-1 flex gap-2">
              <span className="shrink-0 font-semibold">
                {renderSentence(paragraph.speaker, `p${p}-speaker`)}：
              </span>
              <p>{paragraph.sentences.map((sentence, s) => renderSentence(sentence, `p${p}-${s}`))}</p>
            </div>
          ) : (
            <p key={p} className="mb-2 indent-[2em]">
              {paragraph.sentences.map((sentence, s) => renderSentence(sentence, `p${p}-${s}`))}
            </p>
          ),
        )}
      </article>

      {reading.questions && (
        <section className="mt-8 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('readings.questions')}</h2>
            <CopyButton text={reading.questions.map((question, q) => `${q + 1}. ${sentenceText(question)}`).join('\n')} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{t('readings.questionsDescription')}</p>
          <ol lang="zh-Hans" className="font-hanzi mt-2 list-decimal pl-8 text-xl leading-[2.9] sm:text-2xl">
            {reading.questions.map((question, q) => (
              <li key={q}>{renderSentence(question, `q${q}`)}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="text-sm font-medium text-accent-strong hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? t('readings.copied') : t('readings.copyQuestions')}
    </button>
  )
}

function WordButton({
  word,
  active,
  showPinyin,
  onSelect,
}: {
  word: ReadingWord
  active: boolean
  showPinyin: boolean
  onSelect: () => void
}) {
  const { toneColors } = useSettings().settings
  const tones = getWordTones(word)
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`rounded-sm px-0.5 focus-visible:outline-2 focus-visible:outline-accent ${active ? 'text-accent-strong' : 'hover:bg-accent-soft'}`}
    >
      <ruby>
        {Array.from(word.text).map((character, index) => {
          const tone = tones[index]
          const underline = toneColors && tone !== undefined ? TONE_BORDER_CLASSES[tone] : 'border-line'
          return (
            <span
              key={index}
              className={`mx-px inline-block border-b-2 leading-tight ${HAN.test(character) ? underline : 'border-transparent'}`}
            >
              {character}
            </span>
          )
        })}
        <rt className={`font-sans text-xs text-ink-muted ${showPinyin ? '' : 'invisible'}`}>
          {displayPinyin(word.pinyin ?? '')}
        </rt>
      </ruby>
    </button>
  )
}

/** The selected word: hanzi, pinyin and meaning here, HSK level, and each of its characters. */
function WordDetails({
  word,
  sentence,
  level: bookLevel,
  hsk5Words,
}: {
  word: ReadingWord
  sentence: ReadingSentence
  level: number | undefined
  hsk5Words: readonly Hsk5Word[]
}) {
  const store = useDictionaryStore()
  const dictionary = useDictionary()
  const { toneColors } = useSettings().settings
  const entry = findWordEntry(store.wordIndex, word)
  const level = getWordHskLevel(store.wordIndex, word, hsk5Words)
  const tones = getWordTones(word)
  const color = (tone: ReturnType<typeof getSyllableTone>) => (toneColors && tone ? TONE_TEXT_CLASSES[tone] : '')

  // Each hanzi with its syllable; an erhua 儿 ("r") isn't a character of its own here
  const syllables = splitSyllables(word.pinyin ?? '')
  const characters = Array.from(word.text)
    .filter((character) => HAN.test(character))
    .map((character, index) => ({ character, syllable: syllables[index] ?? '' }))
    .filter(({ syllable }) => syllable !== 'r')

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <HanziText className="text-2xl">
          {Array.from(word.text).map((character, index) => (
            <span key={index} className={color(tones[index])}>
              {character}
            </span>
          ))}
        </HanziText>
        <span>
          {splitSyllables(displayPinyin(word.pinyin ?? '')).map((syllable, index) => (
            <span key={index} className={color(getSyllableTone(syllable.replace(/r$/, '')))}>
              {index > 0 && ' '}
              {syllable}
            </span>
          ))}
        </span>
        <span className="sm:text-lg">{word.meaning}</span>
        {level !== undefined && (
          <span className="ml-auto rounded-md border border-line px-2 py-0.5 text-sm text-ink-muted">
            {t('dictionary.hskLevelValue', { level })}
          </span>
        )}
      </div>
      {characters.length > 1 && (
        <ul className="mt-2 flex flex-col gap-0.5 text-sm">
          {characters.map(({ character, syllable }, index) => {
            const meanings = getCharacter(dictionary, character)
            return (
              <li key={index} className="flex gap-2">
                <HanziText className="text-base">{character}</HanziText>
                <span className={color(getSyllableTone(syllable))}>{syllable}</span>
                <span className="line-clamp-2 text-ink-muted">
                  {meanings ? getMeanings(meanings.meanings).slice(0, 3).join('; ') : '…'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {entry && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <LearnWordButton entry={entry} word={word} sentence={sentence} level={bookLevel} />
          <Link to={getEntryPath(entry)} className="text-accent-strong hover:underline">
            {t('readings.openInDictionary')}
          </Link>
        </div>
      )}
    </div>
  )
}
