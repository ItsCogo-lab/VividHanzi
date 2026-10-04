import { useCallback, useState } from 'react'

/**
 * How many uncertain pronunciations each sentence of a block has, so the
 * block can explain them once at its end instead of under every sentence.
 */
export function useUncertainCounts() {
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({})
  const report = useCallback(
    (key: string, count: number) =>
      setCounts((current) => (current[key] === count ? current : { ...current, [key]: count })),
    [],
  )
  // Only the sentences shown now: counts from a previous entry are ignored
  const total = (keys: readonly string[]) => keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0)
  return { report, total }
}
