import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, use, useEffect, useMemo, useState } from 'react'
import { useAccount } from '../account/accountContext.ts'
import { getSupabaseConfig, loadSupabaseClient } from '../account/supabase.ts'
import { isReadingsOwner } from './reading.ts'
import { createSupabaseReadings, type ReadingsStore } from './readingsStore.ts'

/** Tests put a fake store here; in the app it stays empty and Supabase is used. */
export const ReadingsStoreContext = createContext<ReadingsStore | undefined>(undefined)

export type ReadingsAccess = { status: 'loading' } | { status: 'none' } | { status: 'ready'; store: ReadingsStore }

/**
 * The readings, only for the owner's account (isReadingsOwner): everyone
 * else gets `none` and never sees the section.
 */
export function useReadings(): ReadingsAccess {
  const testStore = use(ReadingsStoreContext)
  const { loading, user } = useAccount()
  const email = user?.email ?? null
  const [owner, setOwner] = useState<{ email: string | null; isOwner: boolean }>()
  const [client, setClient] = useState<SupabaseClient>()

  useEffect(() => {
    let active = true
    isReadingsOwner(email).then(
      (isOwner) => active && setOwner({ email, isOwner }),
      () => active && setOwner({ email, isOwner: false }),
    )
    return () => {
      active = false
    }
  }, [email])

  const isOwner = owner?.email === email && owner.isOwner
  useEffect(() => {
    const config = getSupabaseConfig()
    if (!isOwner || !config) return
    let active = true
    loadSupabaseClient(config).then((loaded) => active && setClient(loaded), () => {})
    return () => {
      active = false
    }
  }, [isOwner])

  const userId = user?.id
  const store = useMemo(() => client && userId && createSupabaseReadings(client, userId), [client, userId])

  if (testStore) return { status: 'ready', store: testStore }
  if (loading || owner?.email !== email) return { status: 'loading' }
  if (!isOwner) return { status: 'none' }
  return store ? { status: 'ready', store } : { status: 'loading' }
}
