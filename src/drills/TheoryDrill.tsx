import { useMemo, useState } from 'react'
import type { InputSource } from '../input'
import type { RunResult } from './warmup/keyboard'
import { KeyChips, RunTop } from './warmup/shared'
import { keyOfTheDay, WARMUP_KEYS } from './warmup/tasks'
import { theoryQuestions } from './warmup/theoryQuiz'
import { TheoryRun } from './warmup/TheoryRun'

const QUESTIONS = 10

/** Ten quick theory questions about one key. */
export function TheoryDrill({ input, onExit }: { input: InputSource; onExit: () => void }) {
  const [key, setKey] = useState(() => keyOfTheDay())
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const questions = useMemo(() => {
    void round
    return theoryQuestions(key, QUESTIONS)
  }, [key, round])

  const again = () => {
    setResult(null)
    setRound((r) => r + 1)
  }

  return (
    <div className="run-page">
      <RunTop
        onExit={onExit}
        title="Theory"
        detail={key}
        right={<KeyChips keys={WARMUP_KEYS} value={key} onChange={(k) => { setKey(k); setResult(null) }} />}
      />
      {result ? (
        <main className="warmup-intro">
          <h1 className="warmup-key">{result.line}</h1>
          <p className="warmup-kicker">{key}</p>
          <div className="warmup-done-actions">
            <button type="button" className="btn btn-primary" onClick={again}>
              Ten more
            </button>
            <button type="button" className="btn btn-secondary" onClick={onExit}>
              Done
            </button>
          </div>
        </main>
      ) : (
        <TheoryRun key={`${key}-${round}`} input={input} questions={questions} onDone={setResult} />
      )}
    </div>
  )
}
