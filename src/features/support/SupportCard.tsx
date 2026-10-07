import { Link } from 'react-router'
import { Card } from '../../components/ui/Card.tsx'
import { t } from '../../i18n/index.ts'

export const KOFI_URL = 'https://ko-fi.com/cogo8'

/** Ko-fi's light blue, used for the support buttons. */
export const KOFI_BUTTON_CLASSES =
  'inline-flex items-center gap-2 rounded-xl bg-[#00b9fe] px-5 py-2.5 font-semibold text-white shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00b9fe]'

/**
 * "Support me" card that opens the Support page. A card instead of Ko-fi's
 * floating overlay widget: nothing floating over the tab bar or the study
 * buttons, and Ko-fi's code only loads on the Support page.
 */
export function SupportCard() {
  return (
    <Card aria-labelledby="support-title">
      <h2 id="support-title" className="mb-2 text-lg font-semibold">
        {t('support.title')}
      </h2>
      <p className="mb-4 text-ink-muted">{t('support.description')}</p>
      <Link to="/support" className={KOFI_BUTTON_CLASSES}>
        <span aria-hidden="true">☕</span>
        {t('support.button')}
      </Link>
    </Card>
  )
}
