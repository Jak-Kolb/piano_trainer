import { ModulePicker } from '../components/ModulePicker'
import type { ModuleId } from '../modules'

interface Props {
  onBack: () => void
  onSelect: (id: ModuleId) => void
  midiStatus: string
}

export function SkillsScreen({ onBack, onSelect, midiStatus }: Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Home
        </button>
        <p className="truncate font-ui text-xs text-dust">{midiStatus}</p>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-10">
        <h1 className="font-display text-4xl text-ivory">Skills</h1>
        <ModulePicker onSelect={onSelect} />
      </main>
    </div>
  )
}
