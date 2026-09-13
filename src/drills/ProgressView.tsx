import { useState } from 'react'
import {
  loadProgress,
  saveProgress,
  streakCount,
  type ProgressState,
} from '../storage/progress'
import { DrillFrame } from './DrillFrame'

export function ProgressView({ onExit }: { onExit: () => void }) {
  const [p, setP] = useState<ProgressState>(() => loadProgress())
  const [pieceName, setPieceName] = useState('')

  const update = (next: ProgressState) => {
    setP(next)
    saveProgress(next)
  }

  return (
    <DrillFrame title="Progress" onExit={onExit}>
      <div className="w-full max-w-md space-y-6 overflow-y-auto py-4">
        <Stat label="Practice streak" value={`${streakCount(p.practiceDays)} days`} />
        <Stat
          label="Sight-reading exercises (lifetime)"
          value={String(p.sightReadingCount)}
        />
        <Stat label="Sight-reading level" value={String(p.sightReadingLevel)} />
        <Stat
          label="Triad hits / misses"
          value={`${p.triadHits} / ${p.triadMisses}`}
        />

        <label className="block font-ui text-sm text-dust">
          External assessment score
          <input
            className="mt-2 min-h-12 w-full bg-shadow px-3 font-ui text-ivory outline-none"
            value={p.assessmentScore}
            onChange={(e) => update({ ...p, assessmentScore: e.target.value })}
          />
        </label>

        <div>
          <p className="font-ui text-sm text-dust">Piece log</p>
          <ul className="mt-2 space-y-2">
            {p.pieces.map((piece) => (
              <li
                key={piece.name + piece.started}
                className="border-b border-dust/30 py-2 font-ui text-ivory"
              >
                {piece.name} · started {piece.started}
                {piece.clean ? ` · clean ${piece.clean}` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="min-h-12 flex-1 bg-shadow px-3 font-ui text-ivory outline-none"
              placeholder="Piece name"
              value={pieceName}
              onChange={(e) => setPieceName(e.target.value)}
            />
            <button
              type="button"
              className="min-h-12 bg-brass px-4 font-ui text-ink"
              onClick={() => {
                if (!pieceName.trim()) return
                update({
                  ...p,
                  pieces: [
                    ...p.pieces,
                    {
                      name: pieceName.trim(),
                      started: new Date().toISOString().slice(0, 10),
                    },
                  ],
                })
                setPieceName('')
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </DrillFrame>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-ui text-sm text-dust">{label}</p>
      <p className="font-display text-4xl text-ivory">{value}</p>
    </div>
  )
}
