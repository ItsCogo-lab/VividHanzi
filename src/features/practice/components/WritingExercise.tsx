import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { HanziText } from '../../../components/ui/HanziText.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { formatPinyin, type Dictionary } from '../../dictionary/dictionary.ts'
import { useProgress } from '../../progress/progressContext.ts'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { getMeaningLabel } from '../choiceExercises.ts'
import { useSessionShortcuts } from '../shortcuts.ts'
import type { WritingExercise as WritingExerciseType } from '../types.ts'
import { useElementWidth } from '../useElementWidth.ts'
import { getCharactersToTeach, gradeWriting, NO_HELP, type WritingHelp } from '../writing.ts'
import { LookUpButtons } from './LookUpButtons.tsx'
import { WritingPad, type WritingPadHandle, type WritingPadMode } from './WritingPad.tsx'

/** Below this width (a phone in portrait) only the character being written gets a pad, as big as fits. */
const NARROW_WIDTH = 560
const MAX_NARROW_PAD = 360
/** How long a finished character stays on screen before its pad is replaced by the next one. */
export const PAUSE_AFTER_CHARACTER_MS = 900
/** The pad for learning a character on wider screens. */
const LESSON_PAD = 240

/** A step to learn a new character before writing the item from memory. */
interface Lesson {
  character: string
  mode: Exclude<WritingPadMode, 'memory'>
}

type WritingExerciseProps = {
  exercise: WritingExerciseType
  dictionary: Dictionary
  onAnswer: (correct: boolean) => void
  /** The strokes couldn't be loaded: leave the exercise without counting it. */
  onSkip: () => void
  onLookUp: (item: StudyItem) => void
}

/**
 * Writing exercise: from the meaning and pinyin, the user writes the hanzi
 * one character at a time. Written characters stay in their box. When all
 * are done it is graded (gradeWriting) and the answer is shown, as in a
 * choice question.
 *
 * Characters never written before are taught first: each is traced over
 * its outline, then written with hints (see getCharactersToTeach). Help in
 * those steps doesn't count; only the writing from memory afterwards is graded.
 */
export function WritingExercise({ exercise, dictionary, onAnswer, onSkip, onLookUp }: WritingExerciseProps) {
  const { item } = exercise
  const characters = Array.from(item.entry.hanzi)
  const { progress, markCharactersTaught } = useProgress()
  // Fixed when the exercise opens, so marking a character taught doesn't change it
  const [lessons] = useState<Lesson[]>(() =>
    getCharactersToTeach(item, progress).flatMap((character) => [
      { character, mode: 'trace' },
      { character, mode: 'guided' },
    ]),
  )
  const [lessonIndex, setLessonIndex] = useState(0)
  const lesson = lessons[lessonIndex]
  const padsRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(padsRef)
  const isNarrow = width !== undefined && width < NARROW_WIDTH
  const [current, setCurrent] = useState(0)
  const [help, setHelp] = useState<WritingHelp>(NO_HELP)
  const [unavailable, setUnavailable] = useState(false)
  const padRef = useRef<WritingPadHandle>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const feedbackId = useId()
  const isDone = current >= characters.length
  const isCorrect = isDone && gradeWriting(help)
  // Once all are written, the last pad stays on screen with its character drawn
  const shown = Math.min(current, characters.length - 1)

  const hint = () => {
    // While learning a character, help is free
    if (!lesson) setHelp((previous) => ({ ...previous, hintUsed: true }))
    padRef.current?.hint()
  }
  // A finished character stays on screen for a moment, to see how it came out
  const [pausing, setPausing] = useState(false)
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(pauseTimerRef.current), [])
  const afterPause = (advance: () => void) => {
    setPausing(true)
    pauseTimerRef.current = setTimeout(() => {
      setPausing(false)
      advance()
    }, PAUSE_AFTER_CHARACTER_MS)
  }
  const finishLesson = (finished: Lesson) => {
    if (finished.mode === 'guided') markCharactersTaught([finished.character])
    afterPause(() => setLessonIndex((index) => index + 1))
  }
  const reveal = () => {
    setHelp((previous) => ({ ...previous, revealed: true }))
    padRef.current?.reveal()
  }
  const next = () => onAnswer(isCorrect)
  const onMistake = (misses: number) =>
    setHelp((previous) => ({ ...previous, maxMissesOnStroke: Math.max(previous.maxMissesOnStroke, misses) }))
  const hasLocalCopy = item.entry.hskLevel !== undefined
  // On wider screens all the pads sit side by side, smaller for words
  const wideSize = characters.length === 1 ? 240 : 150

  const canHint = !unavailable && !pausing && lesson?.mode !== 'trace'
  useSessionShortcuts(isDone ? { Enter: next, ' ': next } : canHint ? { h: hint, H: hint } : {})

  // As in choice questions: on finishing, focus goes to "Continue"
  useEffect(() => {
    if (isDone) continueRef.current?.focus()
  }, [isDone])

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {t(item.kind === 'character' ? 'practice.kind.character' : 'practice.kind.word')}
        </p>
        <p className="text-2xl font-medium">{getMeaningLabel(item)}</p>
        <PinyinText pinyin={formatPinyin(item.entry)} className="text-lg text-accent-strong" />
        <h2 className="text-lg text-ink-muted">
          {t(lesson ? `writing.${lesson.mode}` : lessons.length > 0 ? 'writing.fromMemory' : 'writing.question')}
        </h2>
      </div>

      <div ref={padsRef}>
        {lesson ? (
          <div className="flex justify-center">
            <WritingPad
              key={lessonIndex}
              ref={padRef}
              hanzi={lesson.character}
              mode={lesson.mode}
              hasLocalCopy={hasLocalCopy}
              size={isNarrow ? Math.min(width, MAX_NARROW_PAD) : LESSON_PAD}
              onMistake={() => {}}
              onDone={() => finishLesson(lesson)}
              onUnavailable={() => setUnavailable(true)}
            />
          </div>
        ) : isNarrow ? (
          <div className="flex flex-col items-center gap-3">
            {characters.length > 1 && (
              <CharacterProgress characters={characters} current={current} />
            )}
            <WritingPad
              key={shown}
              ref={padRef}
              hanzi={characters[shown]!}
              hasLocalCopy={hasLocalCopy}
              size={Math.min(width, MAX_NARROW_PAD)}
              onMistake={onMistake}
              // Its pad is replaced by the next character's: pause first (not after the last one, which stays)
              onDone={() => (shown + 1 < characters.length ? afterPause(() => setCurrent(shown + 1)) : setCurrent(shown + 1))}
              onUnavailable={() => setUnavailable(true)}
            />
          </div>
        ) : (
          <ol aria-label={t('writing.characters')} className="flex flex-wrap justify-center gap-3">
            {characters.map((character, index) => (
              <li key={index}>
                {index <= current ? (
                  <WritingPad
                    ref={index === current ? padRef : undefined}
                    hanzi={character}
                    hasLocalCopy={hasLocalCopy}
                    size={wideSize}
                    onMistake={onMistake}
                    onDone={() => setCurrent(index + 1)}
                    onUnavailable={() => setUnavailable(true)}
                  />
                ) : (
                  // Characters still to write: an empty box
                  <div aria-hidden="true" className="rounded-xl border border-dashed border-line" style={{ width: wideSize, height: wideSize }} />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {unavailable ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onSkip}>
            {t('writing.skip')}
          </Button>
        </div>
      ) : isDone ? (
        <div className="flex flex-col items-center gap-4 border-t border-line pt-4 text-center">
          <div id={feedbackId}>
            <p className={`text-lg font-semibold ${isCorrect ? 'text-success' : 'text-danger'}`}>
              {t(isCorrect ? 'practice.choice.correct' : help.revealed ? 'writing.revealed' : 'writing.withHelp')}
            </p>
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
            aria-keyshortcuts="Enter"
            className="w-full sm:w-auto"
            onClick={next}
          >
            {t('practice.continue')}
          </Button>
        </div>
      ) : lesson ? (
        // Tracing needs no buttons; writing with hints only the hint
        lesson.mode === 'guided' && (
          <div className="flex justify-center">
            <Button variant="secondary" aria-keyshortcuts="H" disabled={pausing} onClick={hint}>
              {t('writing.hint')} <Kbd>H</Kbd>
            </Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" aria-keyshortcuts="H" disabled={pausing} onClick={hint}>
            {t('writing.hint')} <Kbd>H</Kbd>
          </Button>
          <Button variant="secondary" disabled={pausing} onClick={reveal}>
            {t('writing.showMe')}
          </Button>
        </div>
      )}
    </Card>
  )
}

/**
 * On a phone, where only one pad fits: the word's characters as small boxes,
 * written ones filled in and the one being written marked.
 */
function CharacterProgress({ characters, current }: { characters: string[]; current: number }) {
  return (
    <ol aria-label={t('writing.characters')} className="flex gap-2">
      {characters.map((character, index) => (
        <li
          key={index}
          aria-current={index === current ? 'step' : undefined}
          className={`flex size-10 items-center justify-center rounded-lg border text-2xl ${
            index === current ? 'border-2 border-accent' : index < current ? 'border-line' : 'border-dashed border-line'
          }`}
        >
          {index < current && <HanziText>{character}</HanziText>}
        </li>
      ))}
    </ol>
  )
}
