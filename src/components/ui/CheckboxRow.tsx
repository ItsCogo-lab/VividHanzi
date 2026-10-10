type CheckboxRowProps = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}

/** A native checkbox with a label and a hint below it (accessible with keyboard and screen reader). */
export function CheckboxRow({ checked, disabled = false, onChange, label, hint }: CheckboxRowProps) {
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
