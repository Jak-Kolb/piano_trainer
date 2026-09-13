import {
  INPUT_MODE_OPTIONS,
  type InputModeId,
  midiSupported,
} from '../input'

interface Props {
  mode: InputModeId
  status: string
  onChange: (mode: InputModeId) => void
}

export function ModeSelector({ mode, status, onChange }: Props) {
  return (
    <div className="w-full max-w-xl space-y-3">
      <p className="font-ui text-sm text-dust">Input mode</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {INPUT_MODE_OPTIONS.map((opt) => {
          const disabled = opt.id === 'midi' && !midiSupported()
          const selected = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`min-h-16 px-3 py-3 text-left font-ui ${
                selected
                  ? 'bg-brass text-ink'
                  : disabled
                    ? 'bg-shadow/50 text-dust/50'
                    : 'bg-shadow text-ivory'
              }`}
            >
              <span className="block text-base font-medium">{opt.label}</span>
              <span
                className={`mt-1 block text-xs ${selected ? 'text-ink/80' : 'text-dust'}`}
              >
                {disabled ? 'Needs Chrome' : opt.hint}
              </span>
            </button>
          )
        })}
      </div>
      <p className="font-ui text-sm text-dust">{status}</p>
    </div>
  )
}
