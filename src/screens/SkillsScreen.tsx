import { ModulePicker } from '../components/ModulePicker'
import type { ModuleId } from '../modules'

interface Props {
  onBack: () => void
  onSelect: (id: ModuleId) => void
  midiStatus: string
}

export function SkillsScreen({ onBack, onSelect, midiStatus }: Props) {
  return (
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Home
        </button>
        <p className="topbar-status">{midiStatus}</p>
      </div>
      <main className="page-main page-main--skills">
        <h1 className="page-title page-title--section">Skills</h1>
        <ModulePicker onSelect={onSelect} />
      </main>
    </div>
  )
}
