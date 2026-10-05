import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { formatPinyin, type Dictionary } from '../../dictionary/dictionary.ts'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { getMeaningLabel } from '../choiceExercises.ts'
import type { OptionState } from '../choiceState.ts'
import { LookUpButtons } from './LookUpButtons.tsx'

/**
 * Pieces shared by the multiple-choice questions (ChoiceQuestion and
 * ToneQuestion): the option buttons and the feedback after answering. The
 * logic they share is in choiceState.ts.
 */

const OPTION_STATE_CLASSES: Record<OptionState, string> = {
  idle: 'border-line bg-surface hover:border-accent hover:bg-accent-soft',
  correct: 'border-success bg-success/10',
  wrong: 'border-danger bg-danger/10',
  other: 'border-line bg-surface text-ink-muted',
}

type OptionButtonProps = {
  /** Key that picks this option. */
  shortcut: string
  state: OptionState
  disabled: boolean
  onSelect: () => void
  children: ReactNode
}

export function OptionButton({ shortcut, state, disabled, onSelect, children }: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-keyshortcuts={shortcut}
      disabled={disabled}
      onClick={onSelect}
      className={`relative flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 text-center transition-colors ${OPTION_STATE_CLASSES[state]}`}
    >
      {!disabled && (
        <span className="absolute top-1.5 left-2">
          <Kbd>{shortcut}</Kbd>
        </span>
      )}
      {children}
      {/* Color is not enough for everyone: also a symbol and a text for screen readers */}
      {state === 'correct' && <OptionMark symbol="✓" label={t('practice.choice.correctOption')} />}
      {state === 'wrong' && <OptionMark symbol="✗" label={t('practice.choice.yourOption')} />}
    </button>
  )
}

function OptionMark({ symbol, label }: { symbol: string; label: string }) {
  return (
    <>
      {/* Without this space, the screen reader would run the text together: "two(correct answer)" */}
      {' '}
      <span aria-hidden="true" className="font-semibold">
        {symbol}
      </span>
      <span className="sr-only">({label})</span>
    </>
  )
}

type AnswerFeedbackProps = {
  item: StudyItem
  isCorrect: boolean
  dictionary: Dictionary
  onLookUp: (item: StudyItem) => void
  onContinue: () => void
}

/**
 * Shown once an option is picked: whether it was right, the full answer and
 * "Continue". Options are disabled on answering, so focus moves to
 * "Continue", which stays in view and carries the feedback as its
 * description for screen readers. This way you can also keep going with the
 * keyboard only.
 */
export function AnswerFeedback({ item, isCorrect, dictionary, onLookUp, onContinue }: AnswerFeedbackProps) {
  const continueRef = useRef<HTMLButtonElement>(null)
  const feedbackId = useId()
  useEffect(() => continueRef.current?.focus(), [])

  return (
    <div className="flex flex-col items-center gap-4 border-t border-line pt-4 text-center">
      <div id={feedbackId}>
        <p className={`text-lg font-semibold ${isCorrect ? 'text-success' : 'text-danger'}`}>
          {t(isCorrect ? 'practice.choice.correct' : 'practice.choice.incorrect')}
        </p>
        {/* The {' '} separate the words when read aloud; the visual gap comes from gap */}
        <p className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <ToneHanzi entry={item.entry} className="text-2xl" />{' '}
          <PinyinText pinyin={formatPinyin(item.entry)} className="text-accent-strong" />{' '}
          <span className="text-ink-muted">{getMeaningLabel(item)}</span>
        </p>
      </div>
      <LookUpButtons item={item} dictionary={dictionary} onLookUp={onLookUp} />
      <Button
        ref={continueRef}
        aria-describedby={feedbackId}
        className="w-full sm:w-auto"
        aria-keyshortcuts="Enter"
        onClick={onContinue}
      >
        {t('practice.continue')}
      </Button>
    </div>
  )
}
