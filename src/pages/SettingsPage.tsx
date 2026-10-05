import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { InstallSetting } from '../features/install/components/InstallSetting.tsx'
import { ToneLegend } from '../features/dictionary/components/ToneLegend.tsx'
import { useProgress } from '../features/progress/progressContext.ts'
import { EXERCISE_TYPES } from '../features/practice/exerciseDefinitions.ts'
import { EXERCISE_TYPE_HINTS, EXERCISE_TYPE_LABELS } from '../features/practice/exerciseLabels.ts'
import { DAILY_GOAL_OPTIONS, hasRecognitionType, SESSION_SIZE_OPTIONS } from '../features/settings/settings.ts'
import { useSettings } from '../features/settings/settingsContext.ts'
import { THEME_OPTIONS } from '../features/settings/theme.ts'
import { t } from '../i18n/index.ts'

const DATA_SOURCES = [
  {
    labelKey: 'settings.aboutMeanings',
    name: 'CC-CEDICT',
    url: 'https://cc-cedict.org/wiki/',
    license: 'CC BY-SA 4.0',
  },
  {
    labelKey: 'settings.aboutWordList',
    name: 'clem109/hsk-vocabulary',
    url: 'https://github.com/clem109/hsk-vocabulary',
    license: 'MIT',
  },
  {
    labelKey: 'settings.aboutCharacterData',
    name: 'Unicode Unihan',
    url: 'https://www.unicode.org/reports/tr38/',
    license: 'Unicode License v3',
  },
  {
    labelKey: 'settings.aboutEtymology',
    name: 'Make Me a Hanzi',
    url: 'https://github.com/skishore/makemeahanzi',
    license: 'LGPL 3.0+',
  },
  {
    labelKey: 'settings.aboutStrokeOrder',
    name: 'Hanzi Writer data',
    url: 'https://github.com/chanind/hanzi-writer-data',
    license: 'Arphic Public License',
  },
  {
    labelKey: 'settings.aboutExamples',
    name: 'Tatoeba',
    url: 'https://tatoeba.org',
    license: 'CC BY 2.0 FR',
  },
] as const

export function SettingsPage() {
  return (
    <>
      <PageHeader title={t('nav.settings')} description={t('settings.description')} />
      <div className="flex max-w-2xl flex-col gap-4 sm:gap-6">
        <SettingsSection title={t('settings.practice')}>
          <div className="flex flex-col gap-4">
            <SessionSizeSetting />
            <DailyGoalSetting />
            <ExerciseTypesSetting />
          </div>
        </SettingsSection>
        <SettingsSection title={t('settings.appearance')}>
          <ThemeSetting />
        </SettingsSection>
        <SettingsSection title={t('settings.tones')}>
          <div className="flex flex-col gap-4">
            <ToggleSetting setting="toneColors" label={t('settings.toneColors')} hint={t('settings.toneColorsHint')} />
            <ToggleSetting setting="toneNumbers" label={t('settings.toneNumbers')} hint={t('settings.toneNumbersHint')} />
            <ToneLegend className="border-t border-line pt-4" />
          </div>
        </SettingsSection>
        <SettingsSection title={t('settings.app')}>
          <InstallSetting />
        </SettingsSection>
        <SettingsSection title={t('settings.data')}>
          <ResetProgress />
        </SettingsSection>
        <SettingsSection title={t('settings.about')}>
          <ul className="flex flex-col gap-2">
            {DATA_SOURCES.map((source) => (
              <li key={source.name}>
                {t(source.labelKey)}:{' '}
                <a href={source.url} className="text-accent-strong underline underline-offset-2">
                  {source.name}
                </a>{' '}
                ({source.license})
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-muted">{t('settings.aboutLicense')}</p>
        </SettingsSection>
      </div>
    </>
  )
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

/** Radio button styled as a segmented control (the real input stays hidden but accessible). */
const SEGMENTED_OPTION_CLASSES =
  'cursor-pointer rounded-xl border-2 border-line px-5 py-2 font-medium has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent'

function SessionSizeSetting() {
  const { settings, updateSettings } = useSettings()
  return (
    <NumberChoiceSetting
      name="session-size"
      legend={t('settings.sessionSize')}
      options={SESSION_SIZE_OPTIONS}
      value={settings.sessionSize}
      onChange={(sessionSize) => updateSettings({ sessionSize })}
    />
  )
}

function DailyGoalSetting() {
  const { settings, updateSettings } = useSettings()
  return (
    <NumberChoiceSetting
      name="daily-goal"
      legend={t('settings.dailyGoal')}
      hint={t('settings.dailyGoalHint')}
      options={DAILY_GOAL_OPTIONS}
      value={settings.dailyGoal}
      onChange={(dailyGoal) => updateSettings({ dailyGoal })}
    />
  )
}

type NumberChoiceSettingProps<T extends number> = {
  name: string
  legend: string
  hint?: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

function NumberChoiceSetting<T extends number>({ name, legend, hint, options, value, onChange }: NumberChoiceSettingProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-ink-muted">{legend}</legend>
      <div className="flex gap-2">
        {options.map((option) => (
          <label key={option} className={`${SEGMENTED_OPTION_CLASSES} tabular-nums`}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      {hint && <p className="mt-2 text-sm text-ink-muted">{hint}</p>}
    </fieldset>
  )
}

const THEME_LABELS = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
} as const

function ThemeSetting() {
  const { settings, updateSettings } = useSettings()
  return (
    <fieldset>
      <legend className="mb-2 text-ink-muted">{t('settings.theme')}</legend>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((theme) => (
          <label key={theme} className={SEGMENTED_OPTION_CLASSES}>
            <input
              type="radio"
              name="theme"
              value={theme}
              checked={settings.theme === theme}
              onChange={() => updateSettings({ theme })}
              className="sr-only"
            />
            {t(THEME_LABELS[theme])}
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{t('settings.themeHint')}</p>
    </fieldset>
  )
}

/**
 * Which exercise types can come up in Study sessions. The last one besides
 * writing can't be turned off: writing alone can't make a session.
 */
function ExerciseTypesSetting() {
  const { settings, updateSettings } = useSettings()
  const enabled = settings.exerciseTypes
  return (
    <fieldset>
      <legend className="mb-2 text-ink-muted">{t('settings.exerciseTypes')}</legend>
      <div className="flex flex-col gap-3">
        {EXERCISE_TYPES.map((type) => {
          const checked = enabled.includes(type)
          const without = enabled.filter((other) => other !== type)
          return (
            <CheckboxRow
              key={type}
              checked={checked}
              disabled={checked && !hasRecognitionType(without)}
              onChange={(on) =>
                updateSettings({ exerciseTypes: EXERCISE_TYPES.filter((other) => (other === type ? on : enabled.includes(other))) })
              }
              label={t(EXERCISE_TYPE_LABELS[type])}
              hint={t(EXERCISE_TYPE_HINTS[type])}
            />
          )
        })}
      </div>
      <p className="mt-3 text-sm text-ink-muted">{t('settings.exerciseTypesHint')}</p>
    </fieldset>
  )
}

type ToggleSettingProps = {
  setting: 'toneColors' | 'toneNumbers'
  label: string
  hint: string
}

/** A yes/no setting, with a native checkbox (accessible with keyboard and screen reader). */
function ToggleSetting({ setting, label, hint }: ToggleSettingProps) {
  const { settings, updateSettings } = useSettings()
  return (
    <CheckboxRow
      checked={settings[setting]}
      onChange={(checked) => updateSettings({ [setting]: checked })}
      label={label}
      hint={hint}
    />
  )
}

type CheckboxRowProps = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}

function CheckboxRow({ checked, disabled = false, onChange, label, hint }: CheckboxRowProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accent"
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-sm text-ink-muted">{hint}</span>
      </span>
    </label>
  )
}

/** Resetting progress asks for confirmation in two steps, because it cannot be undone. */
function ResetProgress() {
  const { resetProgress } = useProgress()
  const [step, setStep] = useState<'idle' | 'confirming' | 'done'>('idle')
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (step === 'confirming') cancelRef.current?.focus()
  }, [step])

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-ink-muted">{t('settings.dataDescription')}</p>
      {step === 'confirming' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4">
          <p>{t('settings.resetConfirm')}</p>
          <div className="flex flex-wrap gap-3">
            {/* Focus goes to "Cancel": pressing Enter without looking must not delete anything */}
            <Button ref={cancelRef} variant="secondary" onClick={() => setStep('idle')}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetProgress()
                setStep('done')
              }}
            >
              {t('settings.resetConfirmButton')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setStep('confirming')}>
          {t('settings.reset')}
        </Button>
      )}
      <p role="status" className="text-success">
        {step === 'done' ? t('settings.resetDone') : ''}
      </p>
    </div>
  )
}
