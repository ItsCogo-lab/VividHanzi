import type { ReactNode } from 'react'
import { CheckboxRow } from '../../../components/ui/CheckboxRow.tsx'
import { EXERCISE_TYPES } from '../../practice/exerciseDefinitions.ts'
import { EXERCISE_TYPE_HINTS, EXERCISE_TYPE_LABELS } from '../../practice/exerciseLabels.ts'
import { useSettings } from '../settingsContext.ts'
import { t } from '../../../i18n/index.ts'

/**
 * Which exercise types can come up in Study sessions, saved in the settings.
 * Used in Settings and before each session. The last one checked can't be
 * turned off: a session needs at least one type.
 */
export function ExerciseTypesChoice({ legend }: { legend: ReactNode }) {
  const { settings, updateSettings } = useSettings()
  const enabled = settings.exerciseTypes
  return (
    <fieldset>
      <legend className="mb-2 text-ink-muted">{legend}</legend>
      <div className="flex flex-col gap-3">
        {EXERCISE_TYPES.map((type) => {
          const checked = enabled.includes(type)
          return (
            <CheckboxRow
              key={type}
              checked={checked}
              disabled={checked && enabled.length === 1}
              onChange={(on) =>
                updateSettings({ exerciseTypes: EXERCISE_TYPES.filter((other) => (other === type ? on : enabled.includes(other))) })
              }
              label={t(EXERCISE_TYPE_LABELS[type])}
              hint={t(EXERCISE_TYPE_HINTS[type])}
            />
          )
        })}
      </div>
    </fieldset>
  )
}
