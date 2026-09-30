/** Practice modes and the optional features, each behind its own switch. */
import type { HandFilter } from '../types'

export type PracticeMode = 'learn' | 'play' | 'listen' | 'perform'

export interface PracticeOptions {
  /** Practising one hand: the app plays the other. */
  otherHand: boolean
  /** Your held keys on the piano; wrong notes in red. */
  showMyKeys: boolean
  /** Start the range again after each pass. */
  repeatLoop: boolean
  /** Raise the tempo after each clean pass… */
  speedUp: boolean
  /** …by this many percent… */
  speedStep: number
  /** …until it reaches this tempo. */
  speedTarget: number
  /** Play along: click every beat. */
  metronome: boolean
  /** Play along: one bar of clicks before the music starts. */
  countIn: boolean
  /** Save tempo, hands, range and switches with the piece. */
  rememberSettings: boolean
  /** Log practice time, mistakes per bar and clean runs. */
  trackStats: boolean
  /** Perform: press for every new note, or down to eighths (faster notes play by themselves). */
  performTap: PerformTap
}

export type PerformTap = 'note' | 'eighth'

export const DEFAULT_OPTIONS: PracticeOptions = {
  otherHand: false,
  showMyKeys: true,
  repeatLoop: false,
  speedUp: false,
  speedStep: 5,
  speedTarget: 100,
  metronome: true,
  countIn: true,
  rememberSettings: true,
  trackStats: true,
  performTap: 'note',
}

const LAST_OPTIONS_KEY = 'keys.practiceOptions'

/** Switches from the last piece practised, so a new piece starts the same way. */
export function loadLastOptions(): PracticeOptions {
  try {
    const raw = localStorage.getItem(LAST_OPTIONS_KEY)
    if (raw) return withDefaults(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OPTIONS }
}

export function saveLastOptions(options: PracticeOptions): void {
  try {
    localStorage.setItem(LAST_OPTIONS_KEY, JSON.stringify(options))
  } catch {
    /* ignore */
  }
}

/** Fill in switches added after these options were saved. */
export function withDefaults(saved: Partial<PracticeOptions> | undefined): PracticeOptions {
  const out = { ...DEFAULT_OPTIONS }
  for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof PracticeOptions)[]) {
    const v = saved?.[key]
    if (typeof v === typeof DEFAULT_OPTIONS[key]) (out as Record<string, unknown>)[key] = v
  }
  return out
}

/** Tempo for the next pass: up one step after a clean pass, capped at the target. */
export function tempoAfterPass(
  tempo: number,
  clean: boolean,
  options: Pick<PracticeOptions, 'speedUp' | 'speedStep' | 'speedTarget'>,
): number {
  if (!options.speedUp || !clean || tempo >= options.speedTarget) return tempo
  return Math.min(options.speedTarget, tempo + options.speedStep)
}

export type SheetView = 'staff' | 'roll' | 'both'

/** What a piece remembers between visits (when "Remember settings" is on). */
export interface PieceState {
  pieceId: string
  mode: PracticeMode
  tempoPercent: number
  hands: HandFilter
  /** Practice range (bars, inclusive); null = the whole piece. */
  range: { start: number; end: number } | null
  lastBar: number
  view: SheetView
  options: PracticeOptions
  updatedAt: string
}
