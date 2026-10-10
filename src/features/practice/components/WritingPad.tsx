import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type HanziWriter from 'hanzi-writer'
import { t } from '../../../i18n/index.ts'
import { useStrokeData } from '../../dictionary/useStrokeData.ts'
import { getWriterColors } from '../../dictionary/writerColors.ts'
import { useSettings } from '../../settings/settingsContext.ts'
import { AUTO_HINT_AFTER_MISSES } from '../writing.ts'

/** What the exercise can ask of the pad. */
export interface WritingPadHandle {
  /** Flashes the whole character, then the next stroke. */
  hint: () => void
  /** Draws the whole character with its animation; then the pad is done. */
  reveal: () => void
}

/**
 * How much help the pad gives:
 * - `trace`: the character's outline is shown and each next stroke is
 *   flashed, to draw over it (the first time a character is written).
 * - `guided`: no outline, but a missed stroke is shown at once.
 * - `memory`: from memory; a stroke is shown only after 3 misses on it.
 */
export type WritingPadMode = 'trace' | 'guided' | 'memory'

type WritingPadProps = {
  hanzi: string
  /** `memory` by default. */
  mode?: WritingPadMode
  /** HSK 1-4 characters have a local copy of their strokes (offline fallback). */
  hasLocalCopy: boolean
  size: number
  ref?: Ref<WritingPadHandle>
  /** A stroke was missed; `misses` counts the misses on that stroke. */
  onMistake: (misses: number) => void
  /** The character is written (or was drawn with reveal). */
  onDone: () => void
  /** Its strokes can't be loaded (offline, outside HSK), so it can't be written. */
  onUnavailable: () => void
}

/** "Show me" draws each stroke this many times faster than Hanzi Writer's default... */
const REVEAL_STROKE_SPEED = 2
/** ...and waits this long between strokes (default 1000 ms). */
const REVEAL_DELAY_BETWEEN_STROKES = 150
/** While learning a character, a shown stroke is drawn slowly (Hanzi Writer's default is 2)... */
const LEARNING_HIGHLIGHT_SPEED = 0.6
/** ...and when tracing, the next stroke waits a moment after the last one is drawn. */
const NEXT_STROKE_DELAY_MS = 500
/** The hint shows the whole character this many times, each for a moment. */
const HINT_BLINKS = 2
const HINT_FADE_MS = 60
const HINT_VISIBLE_MS = 180
const HINT_GAP_MS = 120

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Blinks the whole character on the (otherwise hidden) outline layer. */
async function flashCharacter(writer: HanziWriter) {
  for (let blink = 0; blink < HINT_BLINKS; blink++) {
    if (blink > 0) await wait(HINT_GAP_MS)
    await writer.showOutline({ duration: HINT_FADE_MS })
    await wait(HINT_VISIBLE_MS)
    await writer.hideOutline({ duration: HINT_FADE_MS })
  }
}

/** The outline to trace over: stronger than the grid lines, softer than the strokes. */
function getTraceColor(element: HTMLElement): string {
  return getComputedStyle(element).getPropertyValue('--color-trace').trim() || '#d3c9ba'
}

/**
 * One character to write, in a 田字格 grid. Hanzi Writer's quiz grades each
 * stroke as it is drawn: a right one stays, a wrong one disappears, and
 * after 3 misses on the same stroke it is shown as a hint. When done, the
 * character stays drawn.
 */
export function WritingPad({ hanzi, mode = 'memory', hasLocalCopy, size, ref, onMistake, onDone, onUnavailable }: WritingPadProps) {
  const strokes = useStrokeData(hanzi, hasLocalCopy)
  const data = strokes.status === 'ready' ? strokes.data : undefined
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter>(null)
  const nextStrokeRef = useRef(0)
  // The quiz callbacks are set once: they read the latest props from here
  const callbacksRef = useRef({ onMistake, onDone, onUnavailable })
  useEffect(() => {
    callbacksRef.current = { onMistake, onDone, onUnavailable }
  })
  const { theme } = useSettings()
  const isTracing = mode === 'trace'
  const isUnavailable = strokes.status === 'unavailable' || strokes.status === 'missing'

  useEffect(() => {
    if (isUnavailable) callbacksRef.current.onUnavailable()
  }, [isUnavailable])

  useImperativeHandle(ref, () => ({
    hint: () => {
      const writer = writerRef.current
      if (!writer) return
      void flashCharacter(writer).then(() => {
        // The pad may have moved on to another character meanwhile
        if (writerRef.current === writer) void writer.highlightStroke(nextStrokeRef.current)
      })
    },
    reveal: () => {
      const writer = writerRef.current
      if (!writer) return
      writer.cancelQuiz()
      void writer.animateCharacter({ onComplete: () => callbacksRef.current.onDone() })
    },
  }))

  useEffect(() => {
    const target = targetRef.current
    if (!data || !target) return
    let cancelled = false
    nextStrokeRef.current = 0
    import('hanzi-writer').then(
      ({ default: Writer }) => {
        if (cancelled) return
        const colors = getWriterColors(target)
        const writer = Writer.create(target, hanzi, {
          width: size,
          height: size,
          padding: 8,
          showCharacter: false,
          showOutline: isTracing,
          ...colors,
          // From memory the outline is only the hint's flash; to trace, a soft color to draw over
          outlineColor: isTracing ? getTraceColor(target) : colors.highlightColor,
          strokeAnimationSpeed: REVEAL_STROKE_SPEED,
          delayBetweenStrokes: REVEAL_DELAY_BETWEEN_STROKES,
          ...(mode !== 'memory' && { strokeHighlightSpeed: LEARNING_HIGHLIGHT_SPEED }),
          charDataLoader: () => data,
        })
        writerRef.current = writer
        // Tracing also teaches the stroke order: the next stroke flashes
        const showNextStroke = () => {
          if (isTracing && writerRef.current === writer) void writer.highlightStroke(nextStrokeRef.current)
        }
        void writer.quiz({
          showHintAfterMisses: mode === 'memory' ? AUTO_HINT_AFTER_MISSES : 1,
          onMistake: (stroke) => callbacksRef.current.onMistake(stroke.mistakesOnStroke),
          onCorrectStroke: (stroke) => {
            nextStrokeRef.current = stroke.strokeNum + 1
            if (stroke.strokesRemaining > 0) {
              const next = nextStrokeRef.current
              // Unless another stroke was drawn meanwhile
              setTimeout(() => nextStrokeRef.current === next && showNextStroke(), NEXT_STROKE_DELAY_MS)
            }
          },
          onComplete: () => callbacksRef.current.onDone(),
        })
        showNextStroke()
      },
      () => {},
    )
    return () => {
      cancelled = true
      writerRef.current?.cancelQuiz()
      writerRef.current = null
      target.replaceChildren()
    }
  }, [data, hanzi, size, theme, mode, isTracing])

  return (
    <div className="relative rounded-xl border border-line bg-paper text-ink" style={{ width: size, height: size }}>
      <GridLines />
      {isUnavailable ? (
        <p role="alert" className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-muted">
          {t('writing.strokesUnavailable')}
        </p>
      ) : (
        // touch-action: none, or on a phone drawing downwards would scroll the page
        <div
          ref={targetRef}
          role="img"
          aria-label={t('writing.pad')}
          data-status={strokes.status}
          className="relative touch-none"
          style={{ width: size, height: size }}
        />
      )}
    </div>
  )
}

/** The 田字格 guide: a cross and both diagonals, dashed. */
function GridLines() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-line">
      <g stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" fill="none">
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="0" y1="50" x2="100" y2="50" />
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </g>
    </svg>
  )
}
