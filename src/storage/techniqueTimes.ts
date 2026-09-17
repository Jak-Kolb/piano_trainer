export type TechniqueKind = 'scale' | 'arpeggio'
export type TechniqueHand = 'right' | 'left'

export interface TechniqueBestMap {
  /** key: `${kind}|${scaleKey}|${hand}` -> best ms */
  bestMs: Record<string, number>
}

const KEY = 'keys.techniqueBest'

function storageKey(kind: TechniqueKind, scaleKey: string, hand: TechniqueHand) {
  return `${kind}|${scaleKey}|${hand}`
}

export function loadTechniqueBests(): TechniqueBestMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { bestMs: { ...JSON.parse(raw).bestMs } }
  } catch {
    /* ignore */
  }
  return { bestMs: {} }
}

export function getBestMs(
  kind: TechniqueKind,
  scaleKey: string,
  hand: TechniqueHand,
): number | null {
  const v = loadTechniqueBests().bestMs[storageKey(kind, scaleKey, hand)]
  return typeof v === 'number' ? v : null
}

/** Returns new best ms if improved or first, else null. */
export function recordCompletion(
  kind: TechniqueKind,
  scaleKey: string,
  hand: TechniqueHand,
  ms: number,
): { bestMs: number; isNewBest: boolean } {
  const all = loadTechniqueBests()
  const id = storageKey(kind, scaleKey, hand)
  const prev = all.bestMs[id]
  const isNewBest = prev === undefined || ms < prev
  if (isNewBest) {
    all.bestMs[id] = ms
    localStorage.setItem(KEY, JSON.stringify(all))
  }
  return { bestMs: isNewBest ? ms : (prev as number), isNewBest }
}

export function formatMs(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = s - m * 60
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`
}
