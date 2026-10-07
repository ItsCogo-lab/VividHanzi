import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui/Card.tsx'
import { allWords } from '../../data/index.ts'
import { t } from '../../i18n/index.ts'
import { toDateKey } from '../../lib/dates.ts'
import { PinyinText } from '../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../dictionary/components/ToneHanzi.tsx'
import { createDailyWordPool, getTodaysWord, type DailyWord } from './todaysWord.ts'

/** Meanings shown on the card; the entry page has them all. */
const MAX_MEANINGS = 3

/**
 * Home card with today's HSK 3-5 word. The HSK 5 list is loaded on its own
 * so it doesn't weigh on the app's first load.
 */
export function TodaysWord({ now }: { now: Date }) {
  const [daily, setDaily] = useState<DailyWord>()
  const today = toDateKey(now)

  useEffect(() => {
    let active = true
    void import('../../data/hsk5/words.ts').then(({ hsk5Words }) => {
      if (active) setDaily(getTodaysWord(createDailyWordPool(allWords, hsk5Words), today))
    })
    return () => {
      active = false
    }
  }, [today])

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('todaysWord.title')}</h2>
        {daily && <span className="text-sm text-ink-muted">HSK {daily.level}</span>}
      </div>
      {daily ? (
        <Link to={daily.path} className="-mx-2 mt-2 flex items-center gap-4 rounded-xl p-2 hover:bg-paper">
          <ToneHanzi entry={daily.word} className="shrink-0 text-5xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <PinyinText pinyin={daily.word.pinyin} className="text-lg" />
            <p className="text-ink-muted">{daily.word.meanings.en.slice(0, MAX_MEANINGS).join('; ')}</p>
          </div>
        </Link>
      ) : (
        <p className="mt-3 text-ink-muted">{t('todaysWord.loading')}</p>
      )}
    </Card>
  )
}
