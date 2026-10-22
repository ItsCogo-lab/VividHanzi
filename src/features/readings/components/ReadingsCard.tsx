import { ButtonLink } from '../../../components/ui/ButtonLink.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t } from '../../../i18n/index.ts'
import { useReadings } from '../useReadings.ts'

/** Profile entry to the readings, only for the account that has them. */
export function ReadingsCard() {
  if (useReadings().status !== 'ready') return null
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('readings.title')}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t('readings.profileCard')}</p>
      <ButtonLink to="/readings" variant="secondary" className="mt-4">
        {t('readings.open')}
      </ButtonLink>
    </Card>
  )
}
