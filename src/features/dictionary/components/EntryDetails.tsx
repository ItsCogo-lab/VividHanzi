import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { HanziText } from '../../../components/ui/HanziText.tsx'
import { t } from '../../../i18n/index.ts'
import { GrammarNotes } from '../../grammar/components/GrammarNotes.tsx'
import { formatPinyin, getMeanings, getOtherReadings, getTraditionalForms, type Dictionary } from '../dictionary.ts'
import { getRelatedItems, getStudyItemId, type StudyItem } from '../studyItem.ts'
import { CharacterFacts } from './CharacterFacts.tsx'
import { EntryLabel } from './EntryLabel.tsx'
import { PinyinText } from './PinyinText.tsx'
import { ToneHanzi } from './ToneHanzi.tsx'
import { EntryLink, type EntryOpener } from './EntryLink.tsx'
import { ExampleSentences } from './ExampleSentences.tsx'
import { StrokeOrder } from './StrokeOrder.tsx'

/** Related words shown at once; the rest, with "Show more". */
const RELATED_PAGE_SIZE = 20

type EntryDetailsProps = {
  item: StudyItem
  dictionary: Dictionary
  /** What to do when a related item is pressed: go to its page or open it right here. */
  opener: EntryOpener
}

/**
 * Entry page for a character or a word. Only shows sections that have
 * data: if a source lacks some data, the section doesn't appear.
 */
export function EntryDetails({ item, dictionary, opener }: EntryDetailsProps) {
  const related = getRelatedItems(dictionary, item)
  // With the full dictionary, a character like 一 appears in thousands of words: they're shown in batches
  const itemId = getStudyItemId(item)
  const [shown, setShown] = useState({ itemId, count: RELATED_PAGE_SIZE })
  const relatedCount = shown.itemId === itemId ? shown.count : RELATED_PAGE_SIZE
  const traditional = getTraditionalForms(item.entry)
  const otherReadings = item.kind === 'word' ? getOtherReadings(dictionary, item.entry) : []

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ToneHanzi entry={item.entry} className="text-7xl leading-tight sm:text-8xl" />
        <p className="text-2xl font-medium text-accent-strong">
          <PinyinText pinyin={formatPinyin(item.entry)} />
        </p>
        {item.kind === 'word' && traditional.length > 0 && (
          <p className="text-ink-muted">
            {t('dictionary.traditional')}{' '}
            <HanziText lang="zh-Hant" className="text-xl text-ink">
              {traditional.join(' ')}
            </HanziText>
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('dictionary.meanings')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {getMeanings(item.entry.meanings).map((meaning) => (
            <li key={meaning}>{meaning}</li>
          ))}
        </ul>
      </section>

      {otherReadings.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{t('dictionary.otherReadings')}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {otherReadings.map((word) => (
              <li key={word.id}>
                <RelatedWord item={{ kind: 'word', entry: word }} opener={opener} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <GrammarNotes item={item} opener={opener} />

      {item.kind === 'character' && (
        <>
          <CharacterFacts character={item.entry} dictionary={dictionary} opener={opener} />
          {/* public/strokes/ only has HSK 1-4 ones: the rest depend on jsDelivr (docs/DATA_SOURCES.md) */}
          <StrokeOrder hanzi={item.entry.hanzi} hasLocalCopy={item.entry.hskLevel !== undefined} />
        </>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            {t(item.kind === 'word' ? 'practice.charactersInWord' : 'practice.wordsWithCharacter')}
          </h2>
          {item.kind === 'word' ? (
            <ul className="flex flex-wrap gap-2">
              {related.map((relatedItem) => (
                <li key={getStudyItemId(relatedItem)}>
                  <EntryLink
                    item={relatedItem}
                    opener={opener}
                    className="inline-block rounded-lg border border-line bg-paper px-3 py-1.5 hover:border-accent"
                  >
                    <EntryLabel entry={relatedItem.entry} />
                  </EntryLink>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {related.slice(0, relatedCount).map((relatedItem) => (
                <li key={getStudyItemId(relatedItem)}>
                  <RelatedWord item={relatedItem} opener={opener} />
                </li>
              ))}
            </ul>
          )}
          {item.kind === 'character' && relatedCount < related.length && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => setShown({ itemId, count: relatedCount + RELATED_PAGE_SIZE })}
            >
              {t('sets.showMore')}
            </Button>
          )}
        </section>
      )}

      <ExampleSentences item={item} opener={opener} />
    </Card>
  )
}

/** A related word: hanzi, traditional, pinyin, meaning and level. */
function RelatedWord({ item, opener }: { item: StudyItem; opener: EntryOpener }) {
  const traditional = getTraditionalForms(item.entry)
  return (
    <EntryLink item={item} opener={opener} className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 hover:bg-paper">
      <ToneHanzi entry={item.entry} className="text-xl" />
      {traditional.length > 0 && (
        <HanziText lang="zh-Hant" className="text-ink-muted">
          {traditional.join(' ')}
        </HanziText>
      )}
      <PinyinText pinyin={formatPinyin(item.entry)} className="text-accent-strong" />
      {/* With little room, the meaning drops to its own line instead of overflowing */}
      <span className="min-w-32 flex-1 break-words text-ink-muted">{getMeanings(item.entry.meanings)[0]}</span>
      {item.entry.hskLevel !== undefined && (
        <span className="text-sm text-ink-muted">{t('dictionary.hskLevelValue', { level: item.entry.hskLevel })}</span>
      )}
    </EntryLink>
  )
}
