import { Link } from 'react-router'
import { AccountCard } from '../features/account/components/AccountCard.tsx'
import { useAccount } from '../features/account/accountContext.ts'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { StatCard } from '../components/ui/StatCard.tsx'
import { hskCharacterItems, hskWordItems } from '../features/dictionary/hskDictionary.ts'
import { getRecentlyStudied } from '../features/myStudies/myStudies.ts'
import { useMyStudies } from '../features/myStudies/myStudiesContext.ts'
import { HskLevelCard } from '../features/progress/components/HskLevelCard.tsx'
import { useProgress } from '../features/progress/progressContext.ts'
import { getAnswerTotals, summarizeCharacters, summarizeItems } from '../features/progress/stats.ts'
import { getCurrentStreak } from '../features/progress/streak.ts'
import { SupportCard } from '../features/support/SupportCard.tsx'
import { useStudySets } from '../features/studySets/useStudySets.ts'
import { getSetPath } from '../features/studySets/setPaths.ts'
import { SetProgressBar } from '../features/studySets/components/SetProgressBar.tsx'
import { getSetProgress } from '../features/studySets/setProgress.ts'
import { getStudySet } from '../features/studySets/studySets.ts'
import { formatDate, formatPercent, t } from '../i18n/index.ts'

/**
 * Profile: a summary of what is stored in this browser and, when accounts
 * are configured, sign-in to sync it. Everything comes from per-item progress
 * and My Studies.
 */
export function ProfilePage() {
  const { progress } = useProgress()
  const account = useAccount()
  const { myStudies } = useMyStudies()
  const studySets = useStudySets()
  const now = new Date()
  const overall = summarizeItems(hskWordItems, progress, now)
  const studyingSets = myStudies.sets
    .map(({ setId }) => getStudySet(studySets, setId))
    .filter((set) => set !== undefined)
  const recent = getRecentlyStudied(myStudies).flatMap(({ setId, studiedAt }) => {
    const set = getStudySet(studySets, setId)
    return set ? [{ set, studiedAt }] : []
  })

  return (
    <>
      <PageHeader title={t('nav.profile')} description={t('profile.description')} />
      <div className="flex flex-col gap-4 sm:gap-6">
        <section aria-labelledby="profile-overview">
          <h2 id="profile-overview" className="mb-3 text-lg font-semibold">
            {t('profile.overall')}
          </h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('profile.charactersMastered')}
              value={summarizeCharacters(hskCharacterItems, hskWordItems, progress, now).mastered}
              detail={t('stats.studiedOf', { total: hskCharacterItems.length })}
            />
            <StatCard
              label={t('profile.wordsMastered')}
              value={summarizeItems(hskWordItems, progress, now).mastered}
              detail={t('stats.studiedOf', { total: hskWordItems.length })}
            />
            <StatCard label={t('profile.reviews')} value={getAnswerTotals(progress.activity).answers} />
            <StatCard label={t('stats.streak')} value={getCurrentStreak(progress.activity, now)} />
          </dl>
          <p className="mt-3 text-sm text-ink-muted">
            {t('profile.overallDetail', {
              percent: formatPercent(overall.total > 0 ? overall.mastered / overall.total : 0),
              studied: overall.studied,
              total: overall.total,
            })}
          </p>
        </section>

        <AccountCard />

        <HskLevelCard />

        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('profile.studying')}</h2>
            <Link to="/study" className="text-accent-strong underline underline-offset-2">
              {t('profile.manageSets')}
            </Link>
          </div>
          {studyingSets.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-ink-muted">{t('myStudies.empty')}</p>
              <ButtonLink to="/study/hsk">{t('myStudies.browseHsk')}</ButtonLink>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {studyingSets.map((set) => (
                <li key={set.id} className="flex flex-col gap-1.5">
                  <Link to={getSetPath(set)} className="font-medium hover:text-accent-strong hover:underline">
                    {set.name}
                  </Link>
                  <SetProgressBar name={set.name} progress={getSetProgress(set, progress, now)} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t('profile.recent')}</h2>
          {recent.length === 0 ? (
            <p className="text-ink-muted">{t('profile.noRecent')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(({ set, studiedAt }) => (
                <li key={set.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link to={getSetPath(set)} className="font-medium hover:text-accent-strong hover:underline">
                    {set.name}
                  </Link>
                  <span className="text-sm text-ink-muted">{formatDate(new Date(studiedAt))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <SupportCard />

        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/progress" variant="secondary">
            {t('profile.statistics')}
          </ButtonLink>
          <ButtonLink to="/settings" variant="secondary">
            {t('nav.settings')}
          </ButtonLink>
        </div>
        {!account.enabled && <p className="text-sm text-ink-muted">{t('profile.localNote')}</p>}
      </div>
    </>
  )
}
