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
