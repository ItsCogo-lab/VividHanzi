import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { testCharacters, testWords } from '../../dictionary/testData.ts'
import { createFakeFetch, jsonResponse } from '../../../test/fakeFetch.ts'
import { memoryStorage } from '../../../test/memoryStorage.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { createEmptyProgress, markCharactersTaught } from '../../progress/progress.ts'
import { loadProgress, saveProgress } from '../../progress/storage.ts'
import type { WritingExercise as WritingExerciseType } from '../types.ts'
import { WritingExercise } from './WritingExercise.tsx'

/*
 * jsdom can't draw, so Hanzi Writer is replaced with a fake that records
 * what the exercise asks of it. The tests call the quiz callbacks as if the
 * user had drawn the strokes.
 */
type QuizOptions = {
  showHintAfterMisses: number
  onMistake: (stroke: { mistakesOnStroke: number }) => void
  onCorrectStroke: (stroke: { strokeNum: number }) => void
  onComplete: () => void
}
type FakeWriter = {
  hanzi: string
  options: { showOutline: boolean }
  quizOptions?: QuizOptions
  highlightStroke: ReturnType<typeof vi.fn>
  showOutline: ReturnType<typeof vi.fn>
  animateCharacter: ReturnType<typeof vi.fn>
}
const writers = vi.hoisted(() => [] as FakeWriter[])

vi.mock('hanzi-writer', () => ({
  default: {
    create: (_target: HTMLElement, hanzi: string, options: { showOutline: boolean }) => {
      const writer: FakeWriter & Record<string, unknown> = {
        hanzi,
        options,
        quiz: (options: QuizOptions) => {
          writer.quizOptions = options
          return Promise.resolve()
        },
        cancelQuiz: () => {},
        highlightStroke: vi.fn(),
        showOutline: vi.fn(() => Promise.resolve()),
        hideOutline: vi.fn(() => Promise.resolve()),
        animateCharacter: vi.fn((options: { onComplete: () => void }) => options.onComplete()),
      }
      writers.push(writer)
      return writer
    },
  },
}))

const dictionary = createDictionary(testCharacters, testWords)
const exercise: WritingExerciseType = { type: 'writing', item: { kind: 'word', entry: testWords[2]! } } // 谢谢
const strokes = { strokes: ['M 0 0 L 1 1'], medians: [[[0, 0], [1, 1]]] }
const online = createFakeFetch([[/hanzi-writer-data/, () => jsonResponse(strokes)]]).fetch

/** Storage where 谢 has already been taught, so 谢谢 is written from memory straight away. */
function taughtStorage() {
  const storage = memoryStorage()
  saveProgress(markCharactersTaught(createEmptyProgress(), ['谢'], new Date()), storage)
  return storage
}

function renderExercise({ fetchFn = online, storage = taughtStorage() } = {}) {
  const onAnswer = vi.fn()
  const onSkip = vi.fn()
  renderWithProviders(
    <WritingExercise exercise={exercise} dictionary={dictionary} onAnswer={onAnswer} onSkip={onSkip} onLookUp={() => {}} />,
    { fetchFn, storage },
  )
  return { onAnswer, onSkip }
}

/** Waits for the pad of the n-th character and returns its writer. */
async function writerFor(index: number) {
  // The next pad comes after a short pause (PAUSE_AFTER_CHARACTER_MS)
  await waitFor(() => expect(writers[index]?.quizOptions).toBeDefined(), { timeout: 3000 })
  return writers[index]!
}

async function write(index: number) {
  const writer = await writerFor(index)
  act(() => writer.quizOptions!.onComplete())
}

beforeEach(() => {
  writers.length = 0
})

describe('WritingExercise', () => {
  it('asks with the meaning and pinyin and writes the word one character at a time', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderExercise()

    expect(screen.getByText('thanks')).toBeInTheDocument()
    expect(screen.getByText('xièxie')).toBeInTheDocument()
    expect(screen.queryByText('谢谢')).not.toBeInTheDocument()

    await write(0)
    expect((await writerFor(1)).hanzi).toBe('谢')
    await write(1)

    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('one or two misses on a stroke are fine; three (the automatic hint) count as help', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderExercise()

    const first = await writerFor(0)
    act(() => first.quizOptions!.onMistake({ mistakesOnStroke: 2 }))
    await write(0)
    const second = await writerFor(1)
    act(() => second.quizOptions!.onMistake({ mistakesOnStroke: 3 }))
    await write(1)

    expect(screen.getByText('Done, with some help')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('"Hint" (or H) blinks the character, then flashes the next stroke, and counts as help', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderExercise()
    const writer = await writerFor(0)
    act(() => writer.quizOptions!.onCorrectStroke({ strokeNum: 0 }))

    await user.keyboard('h')
    expect(writer.showOutline).toHaveBeenCalled()
    await waitFor(() => expect(writer.highlightStroke).toHaveBeenCalledWith(1), { timeout: 2000 })

    await write(0)
    await write(1)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('"Show me" draws the character and counts as a miss', async () => {
    const user = userEvent.setup()
    renderExercise()
    const writer = await writerFor(0)

    await user.click(screen.getByRole('button', { name: 'Show me' }))
    expect(writer.animateCharacter).toHaveBeenCalled()
    await write(1)

    expect(screen.getByText('Shown for you')).toBeInTheDocument()
  })

  it('without stroke data it can be skipped without counting', async () => {
    const user = userEvent.setup()
    // Offline, and the local copy isn't reachable either
    const { onAnswer, onSkip } = renderExercise({ fetchFn: createFakeFetch().fetch })

    await user.click(await screen.findByRole('button', { name: 'Skip this one' }))
    expect(onSkip).toHaveBeenCalledOnce()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('on a phone in portrait it shows one big pad and the word as small boxes', async () => {
    // A 340 px wide pad area, as on a phone
    class FakeResizeObserver {
      onResize: ResizeObserverCallback
      constructor(onResize: ResizeObserverCallback) {
        this.onResize = onResize
      }
      observe() {
        this.onResize([{ contentRect: { width: 340 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    try {
      renderExercise()
      const pad = await screen.findByRole('img', { name: 'Writing box: draw the strokes here' })
      expect(pad).toHaveStyle({ width: '340px' })
      const boxes = within(screen.getByRole('list', { name: 'Characters to write' })).getAllByRole('listitem')
      expect(boxes).toHaveLength(2)
      expect(boxes[0]).toHaveAttribute('aria-current', 'step')

      await write(0)
      expect((await writerFor(1)).hanzi).toBe('谢')
      expect(screen.getAllByRole('img', { name: 'Writing box: draw the strokes here' })).toHaveLength(1)
      expect(boxes[0]).toHaveTextContent('谢')
      expect(boxes[1]).toHaveAttribute('aria-current', 'step')

      await write(1)
      expect(screen.getByText('Correct!')).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('teaches a new character first: traced over its outline, then with hints, then from memory', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    const { onAnswer } = renderExercise({ storage })

    // 谢 appears twice in 谢谢 but is taught once
    expect(screen.getByText('New character: trace it')).toBeInTheDocument()
    const trace = await writerFor(0)
    expect(trace.hanzi).toBe('谢')
    expect(trace.options.showOutline).toBe(true)
    expect(trace.highlightStroke).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('button', { name: /Hint/ })).not.toBeInTheDocument()
    act(() => trace.quizOptions!.onMistake({ mistakesOnStroke: 3 }))
    await write(0)
    // The traced character stays on screen for a moment before the next step
    expect(screen.getByText('New character: trace it')).toBeInTheDocument()
    expect(
      await screen.findByText('Now without the outline: a missed stroke is shown', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    const guided = await writerFor(1)
    expect(guided.options.showOutline).toBe(false)
    expect(guided.quizOptions!.showHintAfterMisses).toBe(1)
    // Help while learning doesn't count
    await user.click(screen.getByRole('button', { name: /Hint/ }))
    await write(1)
    expect(loadProgress(storage).writingTaught).toHaveProperty('谢')

    expect(await screen.findByText('Now write it from memory', {}, { timeout: 3000 })).toBeInTheDocument()
    expect((await writerFor(2)).quizOptions!.showHintAfterMisses).toBe(3)
    await write(2)
    await write(3)
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(true)
  })
})
