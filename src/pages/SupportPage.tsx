import { PageHeader } from '../components/ui/PageHeader.tsx'
import { KOFI_BUTTON_CLASSES, KOFI_URL } from '../features/support/SupportCard.tsx'
import { t } from '../i18n/index.ts'

/** Ko-fi's donation panel, embedded so people can support without leaving the app. */
const KOFI_EMBED_URL = `${KOFI_URL}/?hidefeed=true&widget=true&embed=true&preview=true`

export function SupportPage() {
  return (
    <>
      <PageHeader title={t('support.title')} description={t('support.description')} />
      <div className="flex max-w-xl flex-col items-start gap-4">
        <iframe
          src={KOFI_EMBED_URL}
          title={t('support.embedTitle')}
          height={712}
          loading="lazy"
          className="w-full rounded-2xl border border-line bg-[#f9f9f9] p-1"
        />
        <p className="text-sm text-ink-muted">{t('support.embedFallback')}</p>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className={KOFI_BUTTON_CLASSES}>
          <span aria-hidden="true">☕</span>
          {t('support.openKofi')}
        </a>
      </div>
    </>
  )
}
