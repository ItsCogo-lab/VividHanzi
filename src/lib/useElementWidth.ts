import { useEffect, useState } from 'react'

/**
 * Width of an element, kept up to date as it resizes. Returns a callback ref
 * to put on the element and its width, `undefined` until measured (or where
 * ResizeObserver doesn't exist, as in the tests).
 */
export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [width, setWidth] = useState<number>()

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [setElement, width] as const
}
