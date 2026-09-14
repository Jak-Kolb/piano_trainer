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
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <SafariNotice />
      <div className="flex justify-end px-4 pt-3">
        <button
          type="button"
          onClick={onSettings}
          className="min-h-12 px-4 font-ui text-dust"
        >
          Settings
        </button>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-10">
        <div className="text-center">
          <h1 className="font-display text-6xl font-bold text-ivory">Keys</h1>
          <p className="mt-3 font-ui text-dust">Skills · Pieces</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSkills}
            className="min-h-32 bg-shadow px-6 py-8 text-left"
          >
            <span className="font-display text-3xl text-ivory">Skills</span>
            <span className="mt-2 block font-ui text-dust">
              Triads, inversions, arpeggios, reading…
            </span>
          </button>
          <button
            type="button"
            onClick={onPieces}
            className="min-h-32 bg-shadow px-6 py-8 text-left"
          >
            <span className="font-display text-3xl text-ivory">Pieces</span>
            <span className="mt-2 block font-ui text-dust">
              Import MIDI · walk-through · verify
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
