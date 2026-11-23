interface RatingControlProps {
  label: string
  description: string
  name: string
  value: number | null
  disabled?: boolean
  onChange: (value: number) => void
}

const SCALE = [1, 2, 3, 4, 5, 6, 7]

export function RatingControl({ label, description, name, value, disabled, onChange }: RatingControlProps) {
  return (
    <fieldset className="mt-4" disabled={disabled}>
      <legend className="text-sm font-semibold text-ink-800">
        {label}
        <span className="ml-2 font-normal text-slate-500">{description}</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SCALE.map((n) => (
          <label
            key={n}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors ${
              value === n
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-teal-600'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              disabled={disabled}
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
