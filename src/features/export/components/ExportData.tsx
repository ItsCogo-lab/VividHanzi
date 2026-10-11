import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { t } from '../../../i18n/index.ts'
import { toDateKey } from '../../../lib/dates.ts'
import { downloadTextFile } from '../../../lib/download.ts'
import { useCustomSets } from '../../customSets/customSetsContext.ts'
import { useDictionaryStore } from '../../dictionary/dictionaryContext.ts'
import { formatPinyin, getMeanings } from '../../dictionary/dictionary.ts'
import { getStudyItem, type StudyItemId } from '../../dictionary/studyItem.ts'
import { useProgress } from '../../progress/progressContext.ts'
import { useSettings } from '../../settings/settingsContext.ts'
import { buildDataExport, buildStudySummary, shortenMeaning } from '../exportData.ts'

type Status = 'idle' | 'copied' | 'copyFailed' | 'downloaded'

/**
 * Settings → Export: a Markdown summary of what the user is learning (to
 * paste into an AI assistant) and a JSON file with all their saved data.
 */
export function ExportData() {
  const { progress } = useProgress()
  const { settings } = useSettings()
  const { customSets } = useCustomSets()
  const store = useDictionaryStore()
  const [status, setStatus] = useState<Status>('idle')
  const today = toDateKey(new Date())

  /** The summary, after loading the entries of items outside HSK 1-4 (custom sets). */
  const buildSummary = async () => {
    const itemIds = [
      ...Object.keys(progress.items),
      ...Object.keys(progress.writing),
      ...Object.keys(progress.excluded),
      ...customSets.flatMap((set) => set.itemIds),
    ] as StudyItemId[]
    // Offline: what isn't loaded is shown by its hanzi alone
    await store.loadItems([...new Set(itemIds)]).catch(() => undefined)
    const dictionary = store.getSnapshot()
    return buildStudySummary(
      progress,
      settings,
      customSets,
      (itemId) => {
        const item = getStudyItem(dictionary, itemId)
        return (
          item && {
            hanzi: item.entry.hanzi,
            pinyin: formatPinyin(item.entry),
            meaning: shortenMeaning(getMeanings(item.entry.meanings)),
          }
        )
      },
      new Date(),
    )
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(await buildSummary())
      setStatus('copied')
    } catch {
      setStatus('copyFailed')
    }
  }

  const downloadSummary = async () => {
    downloadTextFile(`vividhanzi-summary-${today}.md`, await buildSummary(), 'text/markdown')
    setStatus('downloaded')
  }

  const downloadJson = () => {
    const data = buildDataExport(progress, settings, customSets, new Date())
    downloadTextFile(`vividhanzi-data-${today}.json`, JSON.stringify(data, null, 2), 'application/json')
    setStatus('downloaded')
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-ink-muted">{t('export.summaryHint')}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={copySummary}>{t('export.copySummary')}</Button>
        <Button variant="secondary" onClick={downloadSummary}>
          {t('export.downloadSummary')}
        </Button>
      </div>
      <p className="mt-2 text-ink-muted">{t('export.jsonHint')}</p>
      <Button variant="secondary" onClick={downloadJson}>
        {t('export.downloadJson')}
      </Button>
      <p role="status" className={status === 'copyFailed' ? 'text-danger' : 'text-success'}>
        {status === 'idle' ? '' : t(`export.${status}`)}
      </p>
    </div>
  )
}
