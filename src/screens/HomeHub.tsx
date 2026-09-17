import { ModeSelector } from '../components/ModeSelector'
import { SafariNotice } from '../components/SafariNotice'
import type { InputModeId } from '../input'

interface Props {
  mode: InputModeId
  status: string
  startError: string | null
  onMode: (m: InputModeId) => void
  onSkills: () => void
  onPieces: () => void
  onSettings: () => void
}

export function HomeHub({
  mode,
  status,
  startError,
  onMode,
  onSkills,
  onPieces,
  onSettings,
}: Props) {
  return (
    <div className="page-shell">
      <SafariNotice />
      <div className="flex justify-end px-4 pt-3">
        <button type="button" onClick={onSettings} className="btn btn-ghost">
          Settings
        </button>
      </div>
      <main className="page-main page-main--center">
        <div className="text-center">
          <h1 className="page-title page-title--hero">Keys</h1>
          <p className="page-kicker">Skills · Pieces</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSkills}
            className="surface-card btn-tile"
          >
            <span className="btn-tile-title">Skills</span>
            <span className="btn-tile-blurb">
              Triads, inversions, arpeggios, reading…
            </span>
          </button>
          <button
            type="button"
            onClick={onPieces}
            className="surface-card btn-tile"
          >
            <span className="btn-tile-title">Pieces</span>
            <span className="btn-tile-blurb">
              Import MIDI · playthrough · Play song
            </span>
          </button>
        </div>

        <ModeSelector mode={mode} status={status} onChange={onMode} />
        {startError && (
          <p className="font-ui text-sm text-felt">{startError}</p>
        )}
      </main>
    </div>
  )
}
