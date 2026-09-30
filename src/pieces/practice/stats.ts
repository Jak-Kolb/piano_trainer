/** Practice history per piece: sessions and what they add up to. */
import type { PracticeMode } from './options'

export interface PracticeSession {
  /** IndexedDB key (auto-increment). */
  id?: number
  pieceId: string
  startedAt: string
  /** Time spent actually practising (idle stretches don't count). */
  seconds: number
  mode: PracticeMode
  /** Complete runs through the practice range. */
  passes: number
  /** Runs with no mistakes. */
  cleanPasses: number
  /** Highest tempo (%) of a clean run, 0 if none. */
  bestTempo: number
  /** Best play-along accuracy (0–1), if any run finished. */
  bestAccuracy?: number
  /** A clean run covered the whole piece (the headline milestone). */
  wholePieceClean?: boolean
  mistakesByBar: Record<number, number>
}

export interface PieceSummary {
  sessions: number
  totalSeconds: number
  lastPracticed: string | null
  firstPracticed: string | null
  /** First clean run through the whole piece. */
  firstCleanAt: string | null
  cleanPasses: number
  bestTempo: number
  bestAccuracy: number | null
  /** Bar → 0–1: where the mistakes are, recent sessions weighing more. */
  troubleBars: Map<number, number>
}

/** Sessions → totals. Mistakes fade by half every 5 sessions back. */
export function summarize(sessions: PracticeSession[]): PieceSummary {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const weight = new Map<number, number>()
  let totalSeconds = 0
  let cleanPasses = 0
  let bestTempo = 0
  let bestAccuracy: number | null = null
  sorted.forEach((s, i) => {
    totalSeconds += s.seconds
    cleanPasses += s.cleanPasses
    bestTempo = Math.max(bestTempo, s.bestTempo)
    if (s.bestAccuracy !== undefined) {
      bestAccuracy = Math.max(bestAccuracy ?? 0, s.bestAccuracy)
    }
    const age = sorted.length - 1 - i
    const w = Math.pow(0.5, age / 5)
    for (const [bar, n] of Object.entries(s.mistakesByBar)) {
      const b = Number(bar)
      weight.set(b, (weight.get(b) ?? 0) + n * w)
    }
  })
  const max = Math.max(0, ...weight.values())
  const troubleBars = new Map<number, number>()
  if (max > 0) for (const [b, w] of weight) troubleBars.set(b, w / max)
  return {
    sessions: sorted.length,
    totalSeconds,
    lastPracticed: sorted.at(-1)?.startedAt ?? null,
    firstPracticed: sorted[0]?.startedAt ?? null,
    firstCleanAt: sorted.find((s) => s.wholePieceClean)?.startedAt ?? null,
    cleanPasses,
    bestTempo,
    bestAccuracy,
    troubleBars,
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 1) return 'under a minute'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

export function formatAgo(iso: string, now = new Date()): string {
  const then = new Date(iso)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(then)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
