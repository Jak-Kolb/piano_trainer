/** Best-effort chord symbol from MIDI pitch classes (MIDI has no enharmonics). */

const PC_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

const QUALITIES: { suffix: string; intervals: number[] }[] = [
  { suffix: '', intervals: [0, 4, 7] },
  { suffix: 'm', intervals: [0, 3, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] },
  { suffix: 'aug', intervals: [0, 4, 8] },
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
  { suffix: 'dim7', intervals: [0, 3, 6, 9] },
]

function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

/** Label a simultaneous group; null if single note or unrecognized. */
export function nameChordFromMidis(midis: number[]): string | null {
  const pcs = [...new Set(midis.map(mod12))].sort((a, b) => a - b)
  if (pcs.length < 2) return null
  if (pcs.length === 2) {
    return `${PC_SHARP[pcs[0]!]}–${PC_SHARP[pcs[1]!]}`
  }

  let best: { score: number; name: string } | null = null
  for (const root of pcs) {
    for (const q of QUALITIES) {
      const need = new Set(q.intervals.map((i) => mod12(root + i)))
      if (need.size !== pcs.length) continue
      let ok = true
      for (const p of pcs) {
        if (!need.has(p)) {
          ok = false
          break
        }
      }
      if (!ok) continue
      // Prefer denser / exact matches; favor triads slightly over 7ths when equal
      const score = pcs.length * 10 + (q.suffix === '' ? 2 : 0)
      const name = `${PC_SHARP[root]!}${q.suffix}`
      if (!best || score > best.score) best = { score, name }
    }
  }
  return best?.name ?? pcs.map((p) => PC_SHARP[p]!).join('/')
}

export function midiNoteLabel(midi: number): string {
  return `${PC_SHARP[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}
