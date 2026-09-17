import { useEffect, useState } from 'react'
import {
  loadProgress,
  saveProgress,
  streakCount,
  type ProgressState,
} from '../storage/progress'
import {
  formatChordId,
  loadTriadStats,
  slowestChords,
  type TriadHistoryPoint,
} from '../storage/triadStats'
import { DrillFrame } from './DrillFrame'

export function ProgressView({ onExit }: { onExit: () => void }) {
  const [p, setP] = useState<ProgressState>(() => loadProgress())
  const [pieceName, setPieceName] = useState('')
  const [history, setHistory] = useState<TriadHistoryPoint[]>([])
  const [weak, setWeak] = useState<
    { id: string; medianMs: number; hits: number; misses: number }[]
  >([])

  useEffect(() => {
    let cancelled = false
    void loadTriadStats().then((state) => {
      if (cancelled) return
      setHistory(state.history)
      setWeak(slowestChords(state, 5))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = (next: ProgressState) => {
    setP(next)
    saveProgress(next)
  }

  const recentHistory = history.slice(-14)

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

        <div>
          <p className="font-ui text-sm text-dust">Triad median time (recent)</p>
          {recentHistory.length === 0 ? (
            <p className="mt-2 font-ui text-ivory">No triad data yet</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recentHistory.map((h) => (
                <li
                  key={h.day}
                  className="flex justify-between border-b border-dust/30 py-2 font-ui text-ivory"
                >
                  <span>{h.day}</span>
                  <span className="text-dust">
                    {Math.round(h.medianMs)} ms · {Math.round(h.hitRate * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-ui text-sm text-dust">Slowest triads</p>
          {weak.length === 0 ? (
            <p className="mt-2 font-ui text-ivory">Practice triads to populate</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {weak.map((c) => (
                <li
                  key={c.id}
                  className="flex justify-between border-b border-dust/30 py-2 font-ui text-ivory"
                >
                  <span>{formatChordId(c.id)}</span>
                  <span className="text-dust">{Math.round(c.medianMs)} ms</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block font-ui text-sm text-dust">
          External assessment score
          <input
            className="field-input mt-2 min-h-12 w-full px-3 text-base outline-none"
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
              className="field-input min-h-12 flex-1 px-3 text-base outline-none"
              placeholder="Piece name"
              value={pieceName}
              onChange={(e) => setPieceName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary min-h-12 px-4"
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
    <div className="surface-panel px-4 py-3">
      <p className="font-ui text-sm uppercase tracking-[0.12em] text-dust">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ivory">{value}</p>
    </div>
  )
}
