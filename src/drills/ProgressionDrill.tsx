import { useMemo, useState } from 'react'
import type { InputSource } from '../input'
import { PROGRESSIONS } from '../theory'
import { ChordRun } from './warmup/ChordRun'
import type { RunResult } from './warmup/keyboard'
import { KeyChips, RunTop } from './warmup/shared'
import { keyOfTheDay, progressionTasks, WARMUP_KEYS } from './warmup/tasks'

/** Common progressions in any of the six keys: once with names, once from the numerals. */
export function ProgressionDrill({ input, onExit }: { input: InputSource; onExit: () => void }) {
  const [key, setKey] = useState(() => keyOfTheDay())
  const [pIdx, setPIdx] = useState(0)
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const progression = PROGRESSIONS[pIdx]!
  const tasks = useMemo(() => progressionTasks(key, progression), [key, progression])

  const restart = () => {
    setResult(null)
    setRound((r) => r + 1)
  }

  return (
    <div className="run-page">
      <RunTop
        onExit={onExit}
        title="Progressions"
        detail={`${progression.name} · ${key}`}
        right={<KeyChips keys={WARMUP_KEYS} value={key} onChange={(k) => { setKey(k); restart() }} />}
      />
      <div className="progression-picker">
        <div className="seg" role="radiogroup" aria-label="Progression">
          {PROGRESSIONS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              role="radio"
              aria-checked={i === pIdx}
              className={`seg-btn${i === pIdx ? ' seg-btn--on' : ''}`}
              onClick={() => {
                setPIdx(i)
                restart()
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      {result ? (
        <main className="warmup-intro">
          <h1 className="warmup-key">{result.line}</h1>
          <p className="warmup-kicker">
            {progression.name} in {key}
          </p>
          <div className="warmup-done-actions">
            <button type="button" className="btn btn-primary" onClick={restart}>
              Again
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPIdx((pIdx + 1) % PROGRESSIONS.length)
                restart()
              }}
            >
              Next progression
            </button>
          </div>
        </main>
      ) : (
        <ChordRun
          key={`${key}-${pIdx}-${round}`}
          input={input}
          tasks={tasks}
          layout="row"
          passes={2}
          heading={`${progression.name} in ${key}`}
          onDone={setResult}
        />
      )}
    </div>
  )
}
