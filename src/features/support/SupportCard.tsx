import { Card } from '../../components/ui/Card.tsx'
import { t } from '../../i18n/index.ts'

export const KOFI_URL = 'https://ko-fi.com/cogo8'

/**
 * "Support me" card with a plain link to Ko-fi. A link instead of Ko-fi's
 * floating overlay widget: no third-party script at runtime, and nothing
 * floating over the tab bar or the study buttons.
 */
export function SupportCard() {
  return (
    <Card aria-labelledby="support-title">
      <h2 id="support-title" className="mb-2 text-lg font-semibold">
        {t('support.title')}
      </h2>
      <p className="mb-4 text-ink-muted">{t('support.description')}</p>
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#00b9fe] px-5 py-2.5 font-semibold text-white shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00b9fe]"
      >
        <span aria-hidden="true">☕</span>
        {t('support.button')}
      </a>
    </Card>
  )
}
