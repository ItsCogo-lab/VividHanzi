import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t, type MessageKey } from '../../../i18n/index.ts'
import { formatPinyin, getMeanings, type Dictionary } from '../../dictionary/dictionary.ts'
import { getRelatedItems, type StudyItem } from '../../dictionary/studyItem.ts'
import type { SkillResults } from '../../progress/skills.ts'
import { useSessionShortcuts } from '../shortcuts.ts'
import type { FlashcardExercise } from '../types.ts'
import { LookUpButtons } from './LookUpButtons.tsx'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'

/** Maximum number of related items shown (a character can appear in many words). */
const MAX_RELATED_ITEMS = 4

type FlashcardProps = {
  exercise: FlashcardExercise
  dictionary: Dictionary
  /** Correct only if both were known; `skills` says which one was. */
  onAnswer: (correct: boolean, skills: SkillResults) => void
  onLookUp: (item: StudyItem) => void
}

/**
 * The four self-grading buttons, in key order. Knowing only one of the two
 * counts as a miss for spaced repetition, but each skill keeps its own
 * result, so later sessions test the weaker one more (see pickDefinition).
 */
const GRADES = [
  { label: 'practice.knewNeither', pinyin: false, meaning: false },
  { label: 'practice.knewPinyin', pinyin: true, meaning: false },
  { label: 'practice.knewMeaning', pinyin: false, meaning: true },
  { label: 'practice.knewBoth', pinyin: true, meaning: true },
] as const satisfies readonly { label: MessageKey; pinyin: boolean; meaning: boolean }[]

export function Flashcard({ exercise, dictionary, onAnswer, onLookUp }: FlashcardProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const answerRef = useRef<HTMLDivElement>(null)
  const { item } = exercise
  const reveal = () => setIsRevealed(true)
  const grade = ({ pinyin, meaning }: (typeof GRADES)[number]) => onAnswer(pinyin && meaning, { pinyin, meaning })
  useSessionShortcuts(
    isRevealed
      ? Object.fromEntries(GRADES.map((option, index) => [String(index + 1), () => grade(option)]))
      : { ' ': reveal, Enter: reveal },
  )

  // On reveal, the "Show answer" button disappears: we move focus to the
  // answer so the keyboard and screen reader stay in place.
  useEffect(() => {
    if (isRevealed) answerRef.current?.focus()
  }, [isRevealed])

  return (
    <Card className="flex flex-col items-center gap-4 sm:gap-6 text-center">
      <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
        {t(item.kind === 'character' ? 'practice.kind.character' : 'practice.kind.word')}
      </p>
      {/* Tone colors give away the pronunciation: only after showing the answer */}
      <ToneHanzi entry={item.entry} showTones={isRevealed} className="text-7xl leading-tight sm:text-8xl" />

      {isRevealed ? (
        <div
          ref={answerRef}
          role="group"
          tabIndex={-1}
          aria-label={t('practice.answer')}
          className="flex w-full flex-col items-center gap-4 sm:gap-6 outline-none"
        >
          <FlashcardAnswer item={item} dictionary={dictionary} />
          <LookUpButtons item={item} dictionary={dictionary} onLookUp={onLookUp} />
          <fieldset className="w-full">
            <legend className="mb-3 w-full text-center text-ink-muted">{t('practice.whatDidYouKnow')}</legend>
            <div className="grid w-full grid-cols-2 gap-3">
              {GRADES.map((option, index) => (
                <Button
                  key={option.label}
                  variant={option.pinyin && option.meaning ? 'primary' : 'secondary'}
                  aria-keyshortcuts={String(index + 1)}
                  onClick={() => grade(option)}
                >
                  {t(option.label)} <Kbd>{String(index + 1)}</Kbd>
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <Button className="w-full sm:w-auto" aria-keyshortcuts="Space" onClick={reveal}>
          {t('practice.showAnswer')} <Kbd>Space</Kbd>
        </Button>
      )}
    </Card>
  )
}

function FlashcardAnswer({ item, dictionary }: { item: StudyItem; dictionary: Dictionary }) {
  const related = getRelatedItems(dictionary, item).slice(0, MAX_RELATED_ITEMS)

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-2xl font-medium text-accent-strong">
        <PinyinText pinyin={formatPinyin(item.entry)} />
      </p>
      <ul className="space-y-1 text-lg">
        {getMeanings(item.entry.meanings).map((meaning) => (
          <li key={meaning}>{meaning}</li>
        ))}
      </ul>

      {related.length > 0 && (
        <div className="w-full border-t border-line pt-4">
          <p className="mb-2 text-sm text-ink-muted">
            {t(item.kind === 'word' ? 'practice.charactersInWord' : 'practice.wordsWithCharacter')}
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {related.map(({ entry }) => (
              <li key={entry.id} className="rounded-lg bg-paper px-3 py-1.5">
                <ToneHanzi entry={entry} className="mr-2 text-lg" />
                <span className="text-sm text-ink-muted">{formatPinyin(entry)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
