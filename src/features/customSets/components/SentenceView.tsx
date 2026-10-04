import { Fragment } from 'react'
import { t, tCount } from '../../../i18n/index.ts'
import { toToneNumbers } from '../../../lib/tones.ts'
import { EntryLink, type EntryOpener } from '../../dictionary/components/EntryLink.tsx'
import type { SentenceWord } from '../../dictionary/segmentation.ts'
import { TONE_TEXT_CLASSES } from '../../dictionary/toneClasses.ts'
import type { Tone } from '../../../lib/tones.ts'
import { useSettings } from '../../settings/settingsContext.ts'
import { countUncertain } from '../sentences.ts'
import type { CustomSentence, SentenceToken } from '../types.ts'

/**
 * A user sentence: the Chinese colored by tone (the same system as the rest
 * of the app) and the pinyin always below, so color is never the only cue.
 * Punctuation has no color, and neither does an uncertain character; a note
 * below says how many there are.
 */
export function SentenceView({ sentence }: { sentence: CustomSentence }) {
  return (
    <div className="flex flex-col gap-0.5">
      <AnnotatedSentence tokens={sentence.tokens} />
      <UncertainNote count={countUncertain(sentence.tokens)} />
    </div>
  )
}

/** Says how many pronunciations couldn't be determined (they have no tone color); nothing if there are none. */
export function UncertainNote({ count }: { count: number }) {
  if (count === 0) return null
  return <p className="text-sm text-ink-muted">{tCount(count, 'custom.uncertainNoteOne', 'custom.uncertainNote')}</p>
}

/**
 * The sentence split into dictionary words: each word opens its entry, and
 * its pinyin is underlined as one piece, so you can see where words of one
 * or more characters begin and end.
 */
export interface SentenceWords {
  words: readonly SentenceWord[]
  opener: EntryOpener
}

/** A sentence already run through the pinyin engine; also used by the dictionary's example sentences. */
export function AnnotatedSentence({ tokens, links }: { tokens: readonly SentenceToken[]; links?: SentenceWords }) {
  const { toneColors, toneNumbers } = useSettings().settings
  const pinyin = tokens.flatMap((token) => (token.pinyin ? [token.pinyin] : [])).join(' ')
  // The tone of each character, if it's colored
  const tones = tokens.flatMap((token) =>
    Array.from(token.text, () => (toneColors && !token.uncertain ? token.tone : undefined)),
  )

  return (
    <div className="flex flex-col gap-0.5">
      <p lang="zh-Hans" className="font-hanzi text-xl">
        {links ? (
          <LinkedWords links={links} tones={tones} />
        ) : (
          <ToneCharacters text={tokens.map((token) => token.text).join('')} tones={tones} />
        )}
      </p>
      <p className="text-accent-strong">
        {links ? (
          <LinkedPinyin tokens={tokens} links={links} toneColors={toneColors} />
        ) : (
          tokens.map((token, index) => (
            <PinyinPart key={index} token={token} first={index === 0} toneColors={toneColors} />
          ))
        )}
        {toneNumbers && pinyin && <span className="text-ink-muted"> ({toToneNumbers(pinyin)})</span>}
      </p>
    </div>
  )
}

/** Each dictionary word as a link to its entry; the tone colors stay as they are. */
function LinkedWords({ links, tones }: { links: SentenceWords; tones: readonly (Tone | undefined)[] }) {
  let offset = 0
  return links.words.map((word, index) => {
    const start = offset
    offset += Array.from(word.text).length
    const characters = <ToneCharacters text={word.text} tones={tones.slice(start)} />
    if (!word.item) return <span key={index}>{characters}</span>
    return (
      <EntryLink key={index} item={word.item} opener={links.opener} className="hover:opacity-70">
        {characters}
      </EntryLink>
    )
  })
}

/**
 * The pinyin grouped by word: the syllables of each dictionary word are
 * underlined together (in a neutral color, so the tone colors stay readable)
 * and also open its entry. The Chinese line already has that link for
 * keyboards and screen readers, so this one is left out of them.
 */
function LinkedPinyin({
  tokens,
  links,
  toneColors,
}: {
  tokens: readonly SentenceToken[]
  links: SentenceWords
  toneColors: boolean
}) {
  // Which word each token falls in: a token never spans two words (see segmentSentence)
  const wordEnds: number[] = []
  let end = 0
  for (const word of links.words) wordEnds.push((end += Array.from(word.text).length))
  const groups: SentenceToken[][] = links.words.map(() => [])
  let offset = 0
  for (const token of tokens) {
    groups[wordEnds.findIndex((wordEnd) => offset < wordEnd)]?.push(token)
    offset += Array.from(token.text).length
  }

  let first = true
  return groups.map((group, index) => {
    const item = links.words[index]?.item
    const isFirst = first
    if (group.length > 0) first = false
    if (!item) {
      return group.map((token, tokenIndex) => (
        <PinyinPart
          key={`${index}-${tokenIndex}`}
          token={token}
          first={isFirst && tokenIndex === 0}
          toneColors={toneColors}
        />
      ))
    }
    return (
      <Fragment key={index}>
        {isFirst ? '' : ' '}
        <EntryLink
          item={item}
          opener={links.opener}
          decorative
          className="underline decoration-ink-muted/60 decoration-1 underline-offset-4 hover:decoration-accent-strong"
        >
          {group.map((token, tokenIndex) => (
            <PinyinPart key={tokenIndex} token={token} first={tokenIndex === 0} toneColors={toneColors} />
          ))}
        </EntryLink>
      </Fragment>
    )
  })
}

/** Text with each character colored by its tone (`tones[i]` is the tone of the i-th character). */
function ToneCharacters({ text, tones }: { text: string; tones: readonly (Tone | undefined)[] }) {
  return Array.from(text).map((character, index) => {
    const tone = tones[index]
    return tone === undefined ? (
      <span key={index}>{character}</span>
    ) : (
      <span key={index} className={TONE_TEXT_CLASSES[tone]} data-tone={tone}>
        {character}
      </span>
    )
  })
}

/**
 * The syllable of a character, colored by its tone like the character
 * (uncertain ones keep the plain color), or punctuation as is, attached to
 * what comes before.
 */
function PinyinPart({ token, first, toneColors }: { token: SentenceToken; first: boolean; toneColors: boolean }) {
  if (token.pinyin === undefined && !token.uncertain) {
    // Non-Chinese text: kept, without the surrounding spaces
    return <>{token.text.trim() === '' ? ' ' : token.text.trim()}</>
  }
  const space = first ? '' : ' '
  if (!token.uncertain) {
    if (!toneColors || token.tone === undefined) return <>{`${space}${token.pinyin}`}</>
    return (
      <>
        {space}
        <span className={TONE_TEXT_CLASSES[token.tone]}>{token.pinyin}</span>
      </>
    )
  }
  if (token.pinyin === undefined) return <>{space}</>
  return (
    <>
      {space}
      <span>
        {token.pinyin}
        <span className="sr-only"> ({t('custom.uncertainMark')})</span>
      </span>
    </>
  )
}
