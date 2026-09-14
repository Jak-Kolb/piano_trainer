import type { HandFilter, PieceControls } from './types'

interface Props {
  controls: PieceControls
  measureCount: number
  hasTwoHands: boolean
  onChange: (next: PieceControls) => void
}

export function PieceControlsBar({
  controls,
  measureCount,
  hasTwoHands,
  onChange,
}: Props) {
  const set = (patch: Partial<PieceControls>) =>
    onChange({ ...controls, ...patch })

  return (
    <div className="w-full space-y-3 border-b border-dust/20 px-4 py-3">
      <label className="flex items-center justify-between gap-3 font-ui text-sm text-dust">
        Tempo {controls.tempoPercent}%
        <input
          type="range"
          min={40}
          max={140}
          value={controls.tempoPercent}
          onChange={(e) => set({ tempoPercent: Number(e.target.value) })}
          className="w-48"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 font-ui text-sm text-dust">
        <span>Loop</span>
        <input
          type="number"
          min={1}
          max={measureCount}
          value={controls.loopStartMeasure}
          onChange={(e) =>
            set({
              loopStartMeasure: Math.min(
                Number(e.target.value) || 1,
                controls.loopEndMeasure,
              ),
            })
          }
          className="min-h-12 w-16 bg-shadow px-2 text-ivory"
        />
        <span>–</span>
        <input
          type="number"
          min={1}
          max={measureCount}
          value={controls.loopEndMeasure}
          onChange={(e) =>
            set({
              loopEndMeasure: Math.max(
                Number(e.target.value) || measureCount,
                controls.loopStartMeasure,
              ),
            })
          }
          className="min-h-12 w-16 bg-shadow px-2 text-ivory"
        />
        <span className="text-dust/70">/ {measureCount}</span>
      </div>
      {hasTwoHands && (
        <div className="flex gap-2">
          {([
            ['both', 'Both'],
            ['right', 'RH'],
            ['left', 'LH'],
          ] as [HandFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ hands: id })}
              className={`min-h-12 px-4 font-ui ${
                controls.hands === id
                  ? 'bg-brass text-ink'
                  : 'bg-shadow text-dust'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
