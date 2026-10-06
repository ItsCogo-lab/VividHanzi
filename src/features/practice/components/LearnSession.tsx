import { useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { StatusBadge } from '../../progress/components/StatusBadge.tsx'
import { EntryDetails } from '../../dictionary/components/EntryDetails.tsx'
import { EntryLabel } from '../../dictionary/components/EntryLabel.tsx'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import { getStudyItemId, type StudyItem } from '../../dictionary/studyItem.ts'
import { SessionFrame } from './SessionFrame.tsx'
import { useSessionShortcuts } from '../shortcuts.ts'

type LearnSessionProps = {
  /** New items the session introduces, in order. */
  items: readonly StudyItem[]
  dictionary: Dictionary
  /** Called when an item is confirmed as learned, to save it right away. */
  onLearned: (item: StudyItem) => void
  /** Called when the user already knew the item: it comes back in Study only very occasionally. */
  onKnown: (item: StudyItem) => void
  /** Called when the user doesn't want to learn the item: Learn stops offering it. */
  onExcluded: (item: StudyItem) => void
  /** Actions of the final summary (e.g. review what was learned). */
  summaryActions: ReactNode
  /** Extra content below the entry, e.g. the user's notes in a custom set. */
  renderExtra?: (item: StudyItem) => ReactNode
}

/**
 * Learn session: introduces new items one by one with their full entry
 * (the same as in the dictionary) and the user confirms which ones they have
 * learned. There are no questions: that is Study.
 */
export function LearnSession({
  items,
  dictionary,
  onLearned,
  onKnown,
  onExcluded,
  summaryActions,
  renderExtra,
}: LearnSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  // What the user chose for each item, except the ones they decided not to learn
  const [learned, setLearned] = useState<readonly { item: StudyItem; known: boolean }[]>([])
  const [excluded, setExcluded] = useState<readonly StudyItem[]>([])
  const item = items[currentIndex]

  if (!item) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col gap-4 sm:gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('learn.summary.title')}</h2>
          <p className="mt-2 text-lg text-ink-muted">
            {t('learn.summary.count', { learned: learned.length, total: items.length })}
          </p>
        </div>
        {learned.length + excluded.length > 0 && (
          <ul className="divide-y divide-line">
            {learned.map(({ item: learnedItem, known }) => (
              <li key={getStudyItemId(learnedItem)} className="flex items-center justify-between gap-3 py-2">
                <EntryLabel entry={learnedItem.entry} withMeaning />
                {known && <StatusBadge status="mastered" />}
              </li>
            ))}
            {excluded.map((excludedItem) => (
              <li key={getStudyItemId(excludedItem)} className="flex items-center justify-between gap-3 py-2">
                <EntryLabel entry={excludedItem.entry} withMeaning />
                <StatusBadge status="excluded" />
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">{summaryActions}</div>
      </Card>
    )
  }

  const next = (choice: LearnChoice) => {
    if (choice === 'exclude') {
      onExcluded(item)
      setExcluded([...excluded, item])
    } else {
      if (choice === 'learned') onLearned(item)
      else onKnown(item)
      setLearned([...learned, { item, known: choice === 'known' }])
    }
    setCurrentIndex(currentIndex + 1)
  }

  const progressText = t('learn.progress', { current: currentIndex + 1, total: items.length })
  return (
    <SessionFrame
      progressText={progressText}
      value={currentIndex}
      max={items.length}
    >
      {(lookUp) => (
        <>
          <p className="text-center text-sm font-medium tracking-wide text-ink-muted uppercase">
            {t(item.kind === 'word' ? 'learn.newWord' : 'learn.newCharacter')}
          </p>
          {/* key: each item starts with its entry scrolled to the top */}
          <EntryDetails key={getStudyItemId(item)} item={item} dictionary={dictionary} opener={{ onOpen: lookUp }} />
          {renderExtra?.(item)}
          <LearnActions onChoice={next} />
        </>
      )}
    </SessionFrame>
  )
}

type LearnChoice = 'exclude' | 'learned' | 'known'

/** The three Learn buttons, also with the keys 1, 2 and 3. */
function LearnActions({ onChoice }: { onChoice: (choice: LearnChoice) => void }) {
  useSessionShortcuts({ '1': () => onChoice('exclude'), '2': () => onChoice('known'), '3': () => onChoice('learned') })

  return (
    // On mobile "I already know it" takes its own row above the other two
    <div className="sticky bottom-(--mobile-nav-height) -mx-1 grid grid-cols-2 gap-3 bg-paper px-1 py-3 sm:grid-cols-3 md:bottom-0">
      <Button variant="secondary" aria-keyshortcuts="1" onClick={() => onChoice('exclude')}>
        {t('learn.dontLearn')} <Kbd>1</Kbd>
      </Button>
      <Button
        variant="secondary"
        aria-keyshortcuts="2"
        className="order-first col-span-2 sm:order-none sm:col-span-1"
        onClick={() => onChoice('known')}
      >
        {t('learn.alreadyKnown')} <Kbd>2</Kbd>
      </Button>
      <Button aria-keyshortcuts="3" onClick={() => onChoice('learned')}>
        {t('learn.gotIt')} <Kbd>3</Kbd>
      </Button>
    </div>
  )
}
