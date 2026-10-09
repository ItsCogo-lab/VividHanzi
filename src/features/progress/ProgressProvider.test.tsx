import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { useProgress, type ProgressContextValue } from './progressContext.ts'
import { ProgressProvider } from './ProgressProvider.tsx'
import { loadProgress } from './storage.ts'

/** Renders the provider and returns a function to read the current context. */
function renderProvider(storage = memoryStorage()) {
  const latest: { value?: ProgressContextValue } = {}
  function Probe() {
    const context = useProgress()
    useEffect(() => {
      latest.value = context
    })
    return <p>{Object.keys(context.progress.items).join(',')}</p>
  }
  render(
    <ProgressProvider storage={storage}>
      <Probe />
    </ProgressProvider>,
  )
  return () => latest.value!
}

describe('ProgressProvider', () => {
  it('records answers and saves them to storage', () => {
    const storage = memoryStorage()
    const getContext = renderProvider(storage)

    act(() => getContext().recordAnswer('char:你', true))

    expect(screen.getByText('char:你')).toBeInTheDocument()
    expect(loadProgress(storage).items['char:你']).toMatchObject({ timesSeen: 1, timesCorrect: 1 })
  })

  it('loads saved progress on startup', () => {
    const storage = memoryStorage()
    const first = renderProvider(storage)
    act(() => first().recordAnswer('word:你好', false))
    cleanup()

    const getContext = renderProvider(storage)

    expect(getContext().progress.items['word:你好']).toMatchObject({ timesWrong: 1 })
  })

  it('"resetProgress" clears everything', () => {
    const storage = memoryStorage()
    const getContext = renderProvider(storage)
    act(() => getContext().recordAnswer('char:你', true))

    act(() => getContext().resetProgress())

    expect(getContext().progress).toEqual({ items: {}, writing: {}, writingTaught: {}, activity: {}, excluded: {} })
    expect(loadProgress(storage)).toEqual({ items: {}, writing: {}, writingTaught: {}, activity: {}, excluded: {} })
  })

  it('useProgress outside the provider throws a clear error', () => {
    function Orphan() {
      useProgress()
      return null
    }
    // React also logs the error to the console; we silence it in this test
    const originalError = console.error
    console.error = () => {}
    expect(() => render(<Orphan />)).toThrow('useProgress must be used within <ProgressProvider>')
    console.error = originalError
  })
})
