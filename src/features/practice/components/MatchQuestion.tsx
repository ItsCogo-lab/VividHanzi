import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '../../../components/ui/Card.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import type { Dictionary } from '../../dictionary/dictionary.ts'
import { getStudyItemId, type StudyItem, type StudyItemId } from '../../dictionary/studyItem.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { getMeaningLabel, getPinyinLabel } from '../choiceExercises.ts'
import { useSessionShortcuts, type Shortcuts } from '../shortcuts.ts'
import type { MatchExercise } from '../types.ts'
import { AnswerFeedback } from './ChoiceParts.tsx'

/** How long a wrong pair stays red before both sides can be picked again. */
const WRONG_PAIR_MS = 700

type Side = 'hanzi' | 'answer'

type MatchQuestionProps = {
  exercise: MatchExercise
  dictionary: Dictionary
  onAnswer: (correct: boolean) => void
  onLookUp: (item: StudyItem) => void
}

/**
 * Pair each hanzi with its pinyin or meaning: pick one on each side, in any
 * order. A right pair stays green; a wrong one flashes red. The exercise is
 * graded on its own item: correct if it was never part of a wrong pair.
 * Keys 1-4 pick on the hanzi side and 5-8 on the other.
 */
export function MatchQuestion({ exercise, dictionary, onAnswer, onLookUp }: MatchQuestionProps) {
  const { type, item, items, answers } = exercise
  const itemId = getStudyItemId(item)
  const [matched, setMatched] = useState<ReadonlySet<StudyItemId>>(new Set())
  const [selected, setSelected] = useState<Partial<Record<Side, StudyItemId>>>({})
  const [wrongPair, setWrongPair] = useState<Record<Side, StudyItemId>>()
  const [itemMissed, setItemMissed] = useState(false)
  const isFinished = matched.size === items.length
  const isCorrect = !itemMissed
  const next = () => onAnswer(isCorrect)

  const pick = (side: Side, id: StudyItemId) => {
    if (matched.has(id) || wrongPair) return
    const pair = { ...selected, [side]: id }
    if (pair.hanzi === undefined || pair.answer === undefined) {
      setSelected(pair)
      return
    }
    setSelected({})
    if (pair.hanzi === pair.answer) {
      setMatched(new Set([...matched, pair.hanzi]))
    } else {
      setWrongPair({ hanzi: pair.hanzi, answer: pair.answer })
      if (pair.hanzi === itemId || pair.answer === itemId) setItemMissed(true)
    }
  }

  useEffect(() => {
    if (!wrongPair) return
    const timer = setTimeout(() => setWrongPair(undefined), WRONG_PAIR_MS)
    return () => clearTimeout(timer)
  }, [wrongPair])

  const shortcuts: Shortcuts = isFinished
    ? { Enter: next, ' ': next }
    : Object.fromEntries([
        ...items.map((option, index) => [String(index + 1), () => pick('hanzi', getStudyItemId(option))]),
        ...answers.map((option, index) => [String(index + 5), () => pick('answer', getStudyItemId(option))]),
      ])
  useSessionShortcuts(shortcuts)

  const stateOf = (side: Side, id: StudyItemId): PairState => {
    if (matched.has(id)) return 'matched'
    if (wrongPair?.[side] === id) return 'wrong'
    return selected[side] === id ? 'selected' : 'idle'
  }

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <h2 className="text-center text-lg text-ink-muted">
        {t(type === 'match-pinyin' ? 'practice.match.pinyinQuestion' : 'practice.match.meaningQuestion')}
      </h2>

      {/* Subgrid: each row is as tall as its tallest side, so pairs line up */}
      <div className="grid grid-cols-2 grid-rows-4 gap-3">
        <ul aria-label={t('practice.match.hanziSide')} className="row-span-4 grid grid-rows-subgrid">
          {items.map((option, index) => (
            <li key={getStudyItemId(option)}>
              <PairButton
                shortcut={String(index + 1)}
                state={stateOf('hanzi', getStudyItemId(option))}
                onSelect={() => pick('hanzi', getStudyItemId(option))}
              >
                {/* Tone colors would give the pinyin away */}
                <ToneHanzi entry={option.entry} showTones={type !== 'match-pinyin' || isFinished} className="text-3xl" />
              </PairButton>
            </li>
          ))}
        </ul>
        <ul aria-label={t('practice.match.answerSide')} className="row-span-4 grid grid-rows-subgrid">
          {answers.map((option, index) => (
            <li key={getStudyItemId(option)}>
              <PairButton
                shortcut={String(index + 5)}
                state={stateOf('answer', getStudyItemId(option))}
                onSelect={() => pick('answer', getStudyItemId(option))}
              >
                {type === 'match-pinyin' ? (
                  <PinyinText pinyin={getPinyinLabel(option)} className="text-lg" />
                ) : (
                  <span className="text-sm sm:text-base">{getMeaningLabel(option)}</span>
                )}
              </PairButton>
            </li>
          ))}
        </ul>
      </div>

      {isFinished && (
        <AnswerFeedback
          item={item}
          isCorrect={isCorrect}
          dictionary={dictionary}
          onLookUp={onLookUp}
          onContinue={next}
          otherItems={items.filter((other) => getStudyItemId(other) !== itemId)}
        />
      )}
    </Card>
  )
}

type PairState = 'idle' | 'selected' | 'matched' | 'wrong'

const PAIR_STATE_CLASSES: Record<PairState, string> = {
  idle: 'border-line bg-surface hover:border-accent hover:bg-accent-soft',
  selected: 'border-accent bg-accent-soft',
  matched: 'border-success bg-success/10 text-ink-muted',
  wrong: 'border-danger bg-danger/10',
}

type PairButtonProps = { shortcut: string; state: PairState; onSelect: () => void; children: ReactNode }

function PairButton({ shortcut, state, onSelect, children }: PairButtonProps) {
  const isMatched = state === 'matched'
  return (
    <button
      type="button"
      aria-keyshortcuts={shortcut}
      aria-pressed={state === 'selected'}
      disabled={isMatched}
      onClick={onSelect}
      className={`relative flex h-full min-h-16 w-full items-center justify-center rounded-xl border-2 px-3 py-2 pointer-fine:px-9 text-center transition-colors ${PAIR_STATE_CLASSES[state]}`}
    >
      {!isMatched && (
        <span className="absolute top-1.5 left-2">
          <Kbd>{shortcut}</Kbd>
        </span>
      )}
      {children}
      {/* Color is not enough for everyone: also a text for screen readers */}
      {isMatched && <span className="sr-only"> ({t('practice.match.matched')})</span>}
      {state === 'wrong' && <span className="sr-only"> ({t('practice.match.wrong')})</span>}
    </button>
  )
}
