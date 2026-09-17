import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export interface TriadChordStats {
  id: string
  timesMs: number[]
  hits: number
  misses: number
  updatedAt: string
}

export interface TriadHistoryPoint {
  day: string
  medianMs: number
  hitRate: number
  samples: number
}

export interface TriadStatsState {
  chords: Record<string, TriadChordStats>
  history: TriadHistoryPoint[]
  /** In-progress day buffer so daily median/hitRate stay accurate. */
  today: { day: string; timesMs: number[]; hits: number } | null
}

const DB_NAME = 'keys-triad-stats'
const STORE = 'state'
const STATE_KEY = 'main'
const MAX_TIMES = 30
const MAX_HISTORY_DAYS = 365
/** Misses count as at least this many ms for adaptive draw weight. */
export const MISS_FLOOR_MS = 4000

interface TriadStatsDB extends DBSchema {
  state: {
    key: string
    value: TriadStatsState
  }
}

let dbPromise: Promise<IDBPDatabase<TriadStatsDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<TriadStatsDB>(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export function emptyTriadStatsState(): TriadStatsState {
  return { chords: {}, history: [], today: null }
}

export function attemptWeightMs(ms: number, correct: boolean): number {
  return correct ? ms : Math.max(ms, MISS_FLOOR_MS)
}

function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function flushTodayIfStale(state: TriadStatsState, day: string): TriadStatsState {
  if (!state.today || state.today.day === day) return state
  return {
    ...state,
    today: null,
    history: upsertHistoryPoint(state.history, {
      day: state.today.day,
      medianMs: median(state.today.timesMs),
      hitRate:
        state.today.timesMs.length === 0
          ? 0
          : state.today.hits / state.today.timesMs.length,
      samples: state.today.timesMs.length,
    }),
  }
}

function upsertHistoryPoint(
  history: TriadHistoryPoint[],
  point: TriadHistoryPoint,
): TriadHistoryPoint[] {
  const next = history.filter((h) => h.day !== point.day)
  next.push(point)
  next.sort((a, b) => a.day.localeCompare(b.day))
  if (next.length > MAX_HISTORY_DAYS) {
    return next.slice(next.length - MAX_HISTORY_DAYS)
  }
  return next
}

/** Pure: apply one graded attempt into stats state. */
export function recordAttemptInState(
  state: TriadStatsState,
  id: string,
  ms: number,
  correct: boolean,
  now = new Date(),
): TriadStatsState {
  const day = isoDay(now)
  let next = flushTodayIfStale(state, day)
  const weight = attemptWeightMs(ms, correct)
  const prev = next.chords[id]
  const timesMs = [...(prev?.timesMs ?? []), weight].slice(-MAX_TIMES)
  const chord: TriadChordStats = {
    id,
    timesMs,
    hits: (prev?.hits ?? 0) + (correct ? 1 : 0),
    misses: (prev?.misses ?? 0) + (correct ? 0 : 1),
    updatedAt: now.toISOString(),
  }

  const today =
    next.today && next.today.day === day
      ? {
          day,
          timesMs: [...next.today.timesMs, weight],
          hits: next.today.hits + (correct ? 1 : 0),
        }
      : { day, timesMs: [weight], hits: correct ? 1 : 0 }

  const history = upsertHistoryPoint(next.history, {
    day,
    medianMs: median(today.timesMs),
    hitRate: today.hits / today.timesMs.length,
    samples: today.timesMs.length,
  })

  return {
    chords: { ...next.chords, [id]: chord },
    history,
    today,
  }
}

export function mediansForDrawFromState(
  state: TriadStatsState,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, chord] of Object.entries(state.chords)) {
    if (chord.timesMs.length === 0) continue
    out[id] = median(chord.timesMs)
  }
  return out
}

export function slowestChords(
  state: TriadStatsState,
  limit = 5,
): { id: string; medianMs: number; hits: number; misses: number }[] {
  return Object.values(state.chords)
    .filter((c) => c.timesMs.length > 0)
    .map((c) => ({
      id: c.id,
      medianMs: median(c.timesMs),
      hits: c.hits,
      misses: c.misses,
    }))
    .sort((a, b) => b.medianMs - a.medianMs)
    .slice(0, limit)
}

export function formatChordId(id: string): string {
  const [root, quality] = id.split('|')
  return quality ? `${root} ${quality}` : id
}

async function readState(): Promise<TriadStatsState> {
  try {
    const raw = await (await db()).get(STORE, STATE_KEY)
    if (!raw) return emptyTriadStatsState()
    return {
      chords: raw.chords ?? {},
      history: raw.history ?? [],
      today: raw.today ?? null,
    }
  } catch {
    return emptyTriadStatsState()
  }
}

async function writeState(state: TriadStatsState): Promise<void> {
  await (await db()).put(STORE, state, STATE_KEY)
}

export async function loadTriadStats(): Promise<TriadStatsState> {
  return readState()
}

export async function recordAttempt(
  id: string,
  ms: number,
  correct: boolean,
): Promise<void> {
  const next = recordAttemptInState(await readState(), id, ms, correct)
  await writeState(next)
}

export async function mediansForDraw(): Promise<Record<string, number>> {
  return mediansForDrawFromState(await readState())
}

/** Test helper: wipe DB (no-op if IDB unavailable). */
export async function resetTriadStatsForTests(): Promise<void> {
  dbPromise = null
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
  } catch {
    /* ignore in node without IDB */
  }
}
