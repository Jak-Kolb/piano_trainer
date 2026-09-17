/** Map MIDI velocity (0–1) to a standard dynamic marking. */
export function velocityToDynamic(velocity: number): string {
  const v = Math.max(0, Math.min(1, velocity))
  if (v < 0.22) return 'pp'
  if (v < 0.38) return 'p'
  if (v < 0.52) return 'mp'
  if (v < 0.68) return 'mf'
  if (v < 0.84) return 'f'
  return 'ff'
}

/** Mean velocity of a chord / slice group. */
export function meanVelocity(
  notes: { velocity?: number }[],
  fallback = 0.7,
): number {
  if (!notes.length) return fallback
  let sum = 0
  for (const n of notes) sum += n.velocity ?? fallback
  return sum / notes.length
}

/**
 * Audible gain from MIDI velocity — wider than Tone's default so mp/mf
 * contrast is obvious on Salamander samples.
 */
export function velocityToGain(velocity: number): number {
  const x = Math.max(0.05, Math.min(1, velocity))
  // mp (~0.45) → ~0.32, mf (~0.6) → ~0.52, f (~0.8) → ~0.78
  return 0.1 + Math.pow(x, 1.75) * 0.9
}

export interface DynamicMark {
  time: number
  measure: number
  label: string
}

/**
 * Piece-level dynamic changes only (not per staff line).
 * One mark when the overall loudness band changes — typically once at the
 * start if the whole song stays at mp/mf.
 */
export function dynamicMarksForPiece(
  notes: { time: number; measure: number; velocity?: number; midi: number }[],
  windowSec = 0.12,
): DynamicMark[] {
  if (!notes.length) return []
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const marks: DynamicMark[] = []
  let lastLabel: string | null = null
  let i = 0
  while (i < sorted.length) {
    const anchor = sorted[i]!.time
    const group = [sorted[i]!]
    i += 1
    while (i < sorted.length && sorted[i]!.time - anchor <= windowSec) {
      group.push(sorted[i]!)
      i += 1
    }
    const label = velocityToDynamic(meanVelocity(group))
    if (label !== lastLabel) {
      marks.push({
        time: anchor,
        measure: group[0]!.measure,
        label,
      })
      lastLabel = label
    }
  }
  return marks
}
