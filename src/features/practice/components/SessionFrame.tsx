import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ProgressBar } from '../../../components/ui/ProgressBar.tsx'
import { t } from '../../../i18n/index.ts'
import { DictionaryPanel } from '../../dictionary/components/DictionaryPanel.tsx'
import { getStudyItemId, type StudyItem } from '../../dictionary/studyItem.ts'
import { ShortcutsEnabledContext } from '../shortcuts.ts'
import { BackButton } from './BackButton.tsx'

type SessionFrameProps = {
  /** Progress text, e.g. "Card 3 of 10". */
  progressText: string
  value: number
  max: number
  /** Undoes the last answer; without it (nothing answered yet) there is no Back button. */
  onBack?: () => void
  /** The content receives `lookUp` to open an item's entry in the panel. */
  children: (lookUp: (item: StudyItem) => void) => ReactNode
}

/**
 * What Learn and Study sessions share: the progress, the Dictionary button and
 * the dictionary panel. The panel opens on top of the session: the content
 * stays mounted underneath, with its state, and on close everything is as it was.
 */
export function SessionFrame({ progressText, value, max, onBack, children }: SessionFrameProps) {
  const [dictionaryOpen, setDictionaryOpen] = useState<{ item?: StudyItem }>()
  const dictionaryButtonRef = useRef<HTMLButtonElement>(null)

  const closeDictionary = () => {
    setDictionaryOpen(undefined)
    dictionaryButtonRef.current?.focus()
  }

  return (
    // With the dictionary open on desktop, the session moves to the left so both are visible
    <div className={dictionaryOpen ? 'md:pr-[28rem]' : undefined}>
      {/* The shortcuts (Back included) are off while the dictionary is open */}
      <ShortcutsEnabledContext value={dictionaryOpen === undefined}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted" aria-live="polite">
                {progressText}
              </p>
              <div className="flex gap-2">
                {onBack && <BackButton onBack={onBack} className="px-3 py-1.5 text-sm" />}
                <Button
                  ref={dictionaryButtonRef}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                  aria-expanded={dictionaryOpen !== undefined}
                  onClick={() => (dictionaryOpen ? closeDictionary() : setDictionaryOpen({}))}
                >
                  <span aria-hidden="true" className="font-hanzi">
                    典
                  </span>
                  {t('dictionary.panelTitle')}
                </Button>
              </div>
            </div>
            <ProgressBar value={value} max={max} label={progressText} />
          </div>
          {children((item) => setDictionaryOpen({ item }))}
        </div>
      </ShortcutsEnabledContext>
      {dictionaryOpen && (
        <DictionaryPanel
          // key: looking up another item opens its entry even if the panel was already open
          key={dictionaryOpen.item ? getStudyItemId(dictionaryOpen.item) : 'search'}
          initialItem={dictionaryOpen.item}
          onClose={closeDictionary}
        />
      )}
    </div>
  )
}
