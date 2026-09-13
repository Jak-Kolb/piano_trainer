import {
  CHROMATIC_ROOTS,
  chordSymbol,
  spellChord,
  type TriadQuality,
} from '../theory'
import type { NoteName } from '../theory'

export interface TriadPrompt {
  root: NoteName
  quality: TriadQuality
  symbol: string
  notes: NoteName[]
  pitchClasses: number[]
  id: string
}

export interface AttemptRecord {
  prompt: TriadPrompt
  correct: boolean
  ms: number
}

export function promptId(root: NoteName, quality: TriadQuality): string {
  return `${root.letter}${root.accidental}|${quality}`
}

export function makePrompt(root: NoteName, quality: TriadQuality): TriadPrompt {
  const spelled = spellChord(root, quality)
  return {
    root,
    quality,
    symbol: chordSymbol(root, quality),
    notes: spelled.notes,
    pitchClasses: spelled.pitchClasses,
    id: promptId(root, quality),
  }
}

/** ~60% weighted toward slow ids, 40% uniform. */
export function drawPrompt(
  qualities: TriadQuality[],
  medianMsById: Record<string, number>,
  avoidId?: string,
): TriadPrompt {
  const pool: TriadPrompt[] = []
  for (const root of CHROMATIC_ROOTS) {
    for (const q of qualities) {
      const p = makePrompt(root, q)
      if (p.id !== avoidId) pool.push(p)
    }
  }
  if (pool.length === 0) {
    return makePrompt(CHROMATIC_ROOTS[0]!, qualities[0] ?? 'major')
  }

  const useWeighted = Math.random() < 0.6 && Object.keys(medianMsById).length > 0
  if (!useWeighted) {
    return pool[Math.floor(Math.random() * pool.length)]!
  }

  const weights = pool.map((p) => {
    const med = medianMsById[p.id]
    return med === undefined ? 1 : Math.max(med, 1)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!
    if (r <= 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export const DEFAULT_QUALITIES: TriadQuality[] = ['major', 'minor']
export const SESSION_LENGTH = 12
