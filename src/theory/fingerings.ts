/**
 * Scale/arpeggio fingerings — DATA only, never generated.
 * See docs/fingering-verification.md for source cross-checks.
 */

export type Hand = 'right' | 'left'

export interface FingeringPattern {
  key: string
  kind: 'scale' | 'arpeggio'
  mode?: 'major' | 'naturalMinor' | 'harmonicMinor'
  hand: Hand
  /** One octave ascending finger numbers; descending = reverse. */
  ascending: number[]
  verified: boolean
  notes?: string
}

/** Draft from spec §6 — majors verified status set in verification doc. */
export const SCALE_FINGERINGS: FingeringPattern[] = [
  // RH majors C G D A E: 1 2 3 1 2 3 4 5
  ...(['C', 'G', 'D', 'A', 'E'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'scale' as const,
    mode: 'major' as const,
    hand: 'right' as const,
    ascending: [1, 2, 3, 1, 2, 3, 4, 5],
    verified: true,
  })),
  {
    key: 'F major',
    kind: 'scale',
    mode: 'major',
    hand: 'right',
    ascending: [1, 2, 3, 4, 1, 2, 3, 4],
    verified: true,
  },
  // LH majors including F: 5 4 3 2 1 3 2 1
  ...(['C', 'G', 'D', 'A', 'E', 'F'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'scale' as const,
    mode: 'major' as const,
    hand: 'left' as const,
    ascending: [5, 4, 3, 2, 1, 3, 2, 1],
    verified: true,
  })),
  // Minors — marked unverified until dual-source check complete
  ...(['A', 'E', 'D'] as const).flatMap((key) =>
    (['naturalMinor', 'harmonicMinor'] as const).flatMap((mode) => [
      {
        key: `${key} ${mode}`,
        kind: 'scale' as const,
        mode,
        hand: 'right' as const,
        ascending: [1, 2, 3, 1, 2, 3, 4, 5],
        verified: false,
        notes: 'Unverified — confirm against two published charts before relying in UI',
      },
      {
        key: `${key} ${mode}`,
        kind: 'scale' as const,
        mode,
        hand: 'left' as const,
        ascending: [5, 4, 3, 2, 1, 3, 2, 1],
        verified: false,
        notes: 'Unverified — confirm against two published charts before relying in UI',
      },
    ]),
  ),
]

export function fingeringFor(
  key: string,
  hand: Hand,
  kind: 'scale' | 'arpeggio' = 'scale',
): FingeringPattern | undefined {
  return SCALE_FINGERINGS.find((f) => f.key === key && f.hand === hand && f.kind === kind)
}
