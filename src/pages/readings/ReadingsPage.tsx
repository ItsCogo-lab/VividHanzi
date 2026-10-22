import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { HanziText } from '../../components/ui/HanziText.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { groupReadings, parseReadings } from '../../features/readings/reading.ts'
import type { ReadingsStore } from '../../features/readings/readingsStore.ts'
import type { ReadingSummary } from '../../features/readings/types.ts'
import { useReadings } from '../../features/readings/useReadings.ts'
import { t, tCount } from '../../i18n/index.ts'
import { NotFoundPage } from '../NotFoundPage.tsx'

type Library = { status: 'loading' } | { status: 'error' } | { status: 'ready'; readings: ReadingSummary[] }

/** The owner's private readings, by book and unit, and where to add more. */
export function ReadingsPage() {
  const access = useReadings()
  if (access.status === 'none') return <NotFoundPage />
  return (
    <>
      <PageHeader title={t('readings.title')} description={t('readings.description')} />
      {access.status === 'loading' ? (
        <p className="text-ink-muted">{t('readings.loading')}</p>
      ) : (
        <ReadingsLibrary store={access.store} />
      )}
    </>
  )
}

function ReadingsLibrary({ store }: { store: ReadingsStore }) {
  const [library, setLibrary] = useState<Library>({ status: 'loading' })

  const reload = useCallback(
    () =>
      store.list().then(
        (readings) => setLibrary({ status: 'ready', readings }),
        (error: unknown) => {
          console.error('Could not load readings', error)
          setLibrary({ status: 'error' })
        },
      ),
    [store],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {library.status === 'loading' && <p className="text-ink-muted">{t('readings.loading')}</p>}
      {library.status === 'error' && <p className="text-danger">{t('readings.loadError')}</p>}
      {library.status === 'ready' && library.readings.length === 0 && (
        <p className="text-ink-muted">{t('readings.empty')}</p>
      )}
      {library.status === 'ready' &&
        groupReadings(library.readings).map((shelf) => (
          <Card key={shelf.book}>
            <h2 className="mb-3 text-lg font-semibold">{shelf.book}</h2>
            <div className="flex flex-col gap-4">
              {shelf.units.map((unit) => (
                <section key={unit.unit}>
                  <h3 className="mb-1 text-sm font-medium text-ink-muted">{t('readings.unit', { unit: unit.unit })}</h3>
                  <ul className="flex flex-col">
                    {unit.readings.map((reading) => (
                      <li key={reading.id}>
                        <Link
                          to={`/readings/${reading.id}`}
                          className="-mx-2 flex flex-wrap items-baseline gap-x-3 rounded-lg px-2 py-2 hover:bg-paper"
                        >
                          {reading.position !== undefined && (
                            <span className="text-sm text-ink-muted">{t('readings.text', { number: reading.position })}</span>
                          )}
                          <HanziText className="text-lg">{reading.title}</HanziText>
                          <span className="text-sm text-ink-muted">{reading.titleTranslation}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        ))}
      <ImportReadings store={store} onImported={reload} />
    </div>
  )
}

type ImportStatus = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string } | { status: 'done'; count: number }

/** Adds readings from a JSON file or pasted JSON (the format is in parseReadings). */
function ImportReadings({ store, onImported }: { store: ReadingsStore; onImported: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportStatus>({ status: 'idle' })
  const textId = useId()

  const save = async (json: string) => {
    let readings
    try {
      readings = parseReadings(json)
    } catch (error) {
      setResult({ status: 'error', message: (error as Error).message })
      return
    }
    setResult({ status: 'saving' })
    try {
      await store.save(readings)
      setResult({ status: 'done', count: readings.length })
      setText('')
      await onImported()
    } catch (error) {
      console.error('Could not save readings', error)
      setResult({ status: 'error', message: t('readings.saveError') })
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('readings.importTitle')}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t('readings.importDescription')}</p>
      <label className="mt-4 block text-sm font-medium">
        {t('readings.importFile')}
        <input
          type="file"
          accept=".json,application/json"
          className="mt-1 block text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) await save(await file.text())
          }}
        />
      </label>
      <label htmlFor={textId} className="mt-4 block text-sm font-medium">
        {t('readings.importPaste')}
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        className="mt-1 w-full rounded-xl border border-line bg-surface p-3 font-mono text-sm"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save(text)} disabled={text.trim() === '' || result.status === 'saving'}>
          {t('readings.importButton')}
        </Button>
        <p role="status" className={result.status === 'error' ? 'text-sm text-danger' : 'text-sm text-ink-muted'}>
          {result.status === 'saving' && t('readings.saving')}
          {result.status === 'error' && result.message}
          {result.status === 'done' && tCount(result.count, 'readings.importedOne', 'readings.imported')}
        </p>
      </div>
    </Card>
  )
}
