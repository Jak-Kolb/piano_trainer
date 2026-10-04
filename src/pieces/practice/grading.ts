/** Play-along grading: match key presses to the notes due around them. */
import { noteId } from '../notate'
import type { PieceNote } from '../types'

export type Grade = 'good' | 'early' | 'late' | 'missed'

export interface GradeWindows {
  /** Within this many ms (real time) of the note: on time. */
  goodMs: number
  /** Within this many ms: early / late; beyond it the press is a wrong note. */
  okMs: number
}

export const DEFAULT_WINDOWS: GradeWindows = { goodMs: 80, okMs: 200 }

export interface RunSummary {
  total: number
  good: number
  early: number
  late: number
  missed: number
  wrong: number
  /** Hit share, 0–1 (on time + early + late). */
  accuracy: number
  /** Mean signed offset of hits (ms): negative = ahead of the beat. */
  meanOffsetMs: number
  mistakesByBar: Record<number, number>
}

export type PressResult =
  | { kind: 'hit'; id: string; grade: Grade; offsetMs: number }
  | { kind: 'wrong'; bar: number | null }

export interface Grader {
  /** A key press at this piece time. */
  press(midi: number, pieceSec: number): PressResult
  /** Playhead moved: notes now too late to play are missed (their ids). */
  advance(pieceSec: number): string[]
  /** Result per graded note id. */
  readonly marks: ReadonlyMap<string, Grade>
  summary(): RunSummary
}

/**
 * `tempoFactor` converts piece seconds to real time (0.5 = half speed), so
 * the windows stay the same length in real time at any tempo.
 */
export function createGrader(
  expected: PieceNote[],
  tempoFactor: number,
  windows: GradeWindows = DEFAULT_WINDOWS,
): Grader {
  const notes = [...expected].sort((a, b) => a.time - b.time)
  const ids = notes.map(noteId)
  const done = new Set<number>()
  const marks = new Map<string, Grade>()
  const offsets: number[] = []
  const mistakes: Record<number, number> = {}
  let wrong = 0
  let cursor = 0 // first note not yet missed/hit in time order
  const realMs = (pieceSec: number, n: PieceNote) =>
    ((pieceSec - n.time) / tempoFactor) * 1000
  const barAt = (pieceSec: number): number | null => {
    let best: PieceNote | null = null
    for (const n of notes) {
      if (n.time > pieceSec + 1e-6) break
      best = n
    }
    return (best ?? notes[0])?.measure ?? null
  }
  const addMistake = (bar: number | null) => {
    if (bar !== null) mistakes[bar] = (mistakes[bar] ?? 0) + 1
  }

  return {
    press(midi, pieceSec) {
      let pick = -1
      let pickDist = Infinity
      for (let i = cursor; i < notes.length; i++) {
        const n = notes[i]!
        const off = realMs(pieceSec, n)
        if (off < -windows.okMs) break
        if (done.has(i) || n.midi !== midi || Math.abs(off) > windows.okMs) continue
        if (Math.abs(off) < pickDist) {
          pick = i
          pickDist = Math.abs(off)
        }
      }
      if (pick < 0) {
        wrong += 1
        const bar = barAt(pieceSec)
        addMistake(bar)
        return { kind: 'wrong', bar }
      }
      const n = notes[pick]!
      const offsetMs = realMs(pieceSec, n)
      const grade: Grade =
        Math.abs(offsetMs) <= windows.goodMs ? 'good' : offsetMs < 0 ? 'early' : 'late'
      done.add(pick)
      marks.set(ids[pick]!, grade)
      offsets.push(offsetMs)
      if (grade !== 'good') addMistake(n.measure)
      return { kind: 'hit', id: ids[pick]!, grade, offsetMs }
    },
    advance(pieceSec) {
      const missed: string[] = []
      while (cursor < notes.length) {
        const n = notes[cursor]!
        if (!done.has(cursor)) {
          if (realMs(pieceSec, n) <= windows.okMs) break
          done.add(cursor)
          marks.set(ids[cursor]!, 'missed')
          addMistake(n.measure)
          missed.push(ids[cursor]!)
        }
        cursor++
      }
      return missed
    },
    marks,
    summary() {
      let good = 0
      let early = 0
      let late = 0
      let missed = 0
      for (const g of marks.values()) {
        if (g === 'good') good++
        else if (g === 'early') early++
        else if (g === 'late') late++
        else missed++
      }
      const hits = good + early + late
      return {
        total: notes.length,
        good,
        early,
        late,
        missed,
        wrong,
        accuracy: notes.length ? hits / notes.length : 0,
        meanOffsetMs: offsets.length
          ? offsets.reduce((a, b) => a + b, 0) / offsets.length
          : 0,
        mistakesByBar: { ...mistakes },
      }
    },
  }
}
