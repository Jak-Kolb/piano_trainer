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
          onClick={() => onSelect(m.id)}
          className="surface-card btn-module"
        >
          <span className="btn-module-title">{m.title}</span>
          <span className="btn-module-blurb">{m.blurb}</span>
        </button>
      ))}
    </div>
  )
}
