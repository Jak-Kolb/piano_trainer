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
      <p className="font-ui text-sm uppercase tracking-[0.14em] text-dust">
        Input mode
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {INPUT_MODE_OPTIONS.map((opt) => {
          const disabled = opt.id === 'midi' && !midiSupported()
          const selected = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`flex min-h-16 flex-col items-start rounded-[var(--radius-md)] border px-3 py-3 text-left font-ui transition ${
                selected
                  ? 'border-[rgba(224,176,86,0.55)] bg-gradient-to-b from-brass-bright to-brass text-ink shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_rgba(192,150,63,0.28)]'
                  : disabled
                    ? 'border-panel-border bg-panel/50 text-dust/50'
                    : 'border-panel-border bg-panel text-ivory hover:border-dust/45'
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
