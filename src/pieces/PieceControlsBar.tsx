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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dust/20 px-3 py-1 font-ui text-xs text-dust">
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap">{controls.tempoPercent}%</span>
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
          className="h-7 w-12 bg-shadow px-1 text-ivory"
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
          className="h-7 w-12 bg-shadow px-1 text-ivory"
        />
        <span className="text-dust/60">/{measureCount}</span>
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
              className={`h-7 px-2 ${
                controls.hands === id
                  ? 'bg-brass text-ink'
                  : 'bg-shadow text-dust'
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
