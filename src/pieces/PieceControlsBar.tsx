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
    <div className="controls-bar">
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap font-medium text-ivory">
          {controls.tempoPercent}%
        </span>
        <input
          type="range"
          min={40}
          max={140}
          value={controls.tempoPercent}
          onChange={(e) => set({ tempoPercent: Number(e.target.value) })}
          className="h-4 w-28"
        />
      </label>
      <span className="flex items-center gap-1">
        Loop
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
          className="field-input w-12"
        />
        –
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
          className="field-input w-12"
        />
        <span className="text-dust-muted">/{measureCount}</span>
      </span>
      {hasTwoHands && (
        <span className="flex gap-1">
          {([
            ['both', 'Both'],
            ['right', 'RH'],
            ['left', 'LH'],
          ] as [HandFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ hands: id })}
              className={`btn btn-chip ${
                controls.hands === id ? 'btn-chip-active' : 'btn-chip-idle'
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      )}
    </div>
  )
}
