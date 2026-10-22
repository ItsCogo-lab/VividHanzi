import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { ReadingView } from '../../features/readings/components/ReadingView.tsx'
import { sentenceText } from '../../features/readings/reading.ts'
import type { ReadingsStore } from '../../features/readings/readingsStore.ts'
import type { Reading } from '../../features/readings/types.ts'
import { useReadings } from '../../features/readings/useReadings.ts'
import { t } from '../../i18n/index.ts'
import { NotFoundPage } from '../NotFoundPage.tsx'

type Loaded = { id: string } & ({ status: 'missing' } | { status: 'error' } | { status: 'ready'; reading: Reading })

/** One reading of the owner's, to read word by word. */
export function ReadingPage() {
  const access = useReadings()
  if (access.status === 'none') return <NotFoundPage />
  if (access.status === 'loading') return <p className="text-ink-muted">{t('readings.loading')}</p>
  return <LoadedReading store={access.store} />
}

function LoadedReading({ store }: { store: ReadingsStore }) {
  const { readingId = '' } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded>()

  useEffect(() => {
    let active = true
    store.get(readingId).then(
      (reading) => active && setLoaded(reading ? { id: readingId, status: 'ready', reading } : { id: readingId, status: 'missing' }),
      (error: unknown) => {
        console.error('Could not load the reading', error)
        if (active) setLoaded({ id: readingId, status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [store, readingId])

  if (loaded?.id !== readingId) return <p className="text-ink-muted">{t('readings.loading')}</p>
  if (loaded.status === 'missing') return <NotFoundPage />
  if (loaded.status === 'error') return <p className="text-danger">{t('readings.loadError')}</p>

  const { reading } = loaded
  const remove = async () => {
    if (!window.confirm(t('readings.deleteConfirm'))) return
    await store.remove(readingId)
    await navigate('/readings')
  }

  return (
    <>
      <title>{`${sentenceText(reading.title)} · ${t('app.name')}`}</title>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <Link to="/readings" className="hover:text-accent-strong">
          ← {reading.book} · {t('readings.unit', { unit: reading.unit })}
        </Link>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => void remove()}>
          {t('readings.delete')}
        </Button>
      </div>
      <ReadingView reading={reading} />
    </>
  )
}
