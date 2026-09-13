import { MODULES, type ModuleId } from '../modules'

interface Props {
  onSelect: (id: ModuleId) => void
}

export function ModulePicker({ onSelect }: Props) {
  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={!m.available}
          onClick={() => onSelect(m.id)}
          className={`min-h-20 px-5 py-4 text-left ${
            m.available
              ? 'bg-shadow text-ivory'
              : 'cursor-not-allowed bg-shadow/40 text-dust/60'
          }`}
        >
          <span className="font-display text-xl">{m.title}</span>
          <span className="mt-1 block font-ui text-sm text-dust">
            {m.available ? m.blurb : `${m.blurb} · Coming soon`}
          </span>
        </button>
      ))}
    </div>
  )
}
