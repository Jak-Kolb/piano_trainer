export interface ProgressState {
  practiceDays: string[]
  triadHits: number
  triadMisses: number
  pieces: { name: string; started: string; clean?: string }[]
  assessmentScore: string
}

const KEY = 'keys.progress'

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaultProgress(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return defaultProgress()
}

export function saveProgress(p: ProgressState) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

function defaultProgress(): ProgressState {
  return {
    practiceDays: [],
    triadHits: 0,
    triadMisses: 0,
    pieces: [],
    assessmentScore: '',
  }
}

export function markPracticeToday(p: ProgressState): ProgressState {
  const day = new Date().toISOString().slice(0, 10)
  if (p.practiceDays.includes(day)) return p
  return { ...p, practiceDays: [...p.practiceDays, day] }
}

export function streakCount(days: string[]): number {
  if (!days.length) return 0
  const set = new Set(days)
  let streak = 0
  const d = new Date()
  for (;;) {
    const key = d.toISOString().slice(0, 10)
    if (!set.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
