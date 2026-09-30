/**
 * Scale/arpeggio fingerings — DATA only, never generated.
 * See docs/fingering-verification.md for source cross-checks.
 *
 * Two-octave scales and all arpeggios (majors C G D A E F) match:
 * - Joy Morin, "Scale & Arpeggio Fingerings for Piano" (colorinmypiano.com, 2010–11)
 * - Piano-ology, "Fingering Charts: 12 Major Scales, Two Octaves" and
 *   "Fingering Charts: Major Triad Arpeggios, Two Octaves" (piano-ology.com)
 * - Arpeggios also: Robert Kelley, "Arpeggio Fingering Chart" (robertkelleyphd.com)
 * One chart (Schimenz, bestpianoclass.com) gives LH 5 3 2 1 for the C, G and F
 * arpeggios; the three above all give 5 4 2 1, which is what's used.
 */

export type Hand = 'right' | 'left'

export interface FingeringPattern {
  key: string
  kind: 'scale' | 'arpeggio'
  mode?: 'major' | 'naturalMinor' | 'harmonicMinor'
  hand: Hand
  /** One octave ascending finger numbers; descending = reverse. */
  ascending: number[]
  /** Two octaves ascending (not two one-octave patterns joined); descending = reverse. */
  twoOctaves?: number[]
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
    twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
    verified: true,
  })),
  {
    key: 'F major',
    kind: 'scale',
    mode: 'major',
    hand: 'right',
    ascending: [1, 2, 3, 4, 1, 2, 3, 4],
    twoOctaves: [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4],
    verified: true,
  },
  // LH majors including F: 5 4 3 2 1 3 2 1
  ...(['C', 'G', 'D', 'A', 'E', 'F'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'scale' as const,
    mode: 'major' as const,
    hand: 'left' as const,
    ascending: [5, 4, 3, 2, 1, 3, 2, 1],
    twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
    verified: true,
  })),
  // Major arpeggios, root position. RH all six: 1 2 3 5
  ...(['C', 'G', 'D', 'A', 'E', 'F'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'arpeggio' as const,
    mode: 'major' as const,
    hand: 'right' as const,
    ascending: [1, 2, 3, 5],
    twoOctaves: [1, 2, 3, 1, 2, 3, 5],
    verified: true,
  })),
  // LH all-white triads C G F: 5 4 2 1
  ...(['C', 'G', 'F'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'arpeggio' as const,
    mode: 'major' as const,
    hand: 'left' as const,
    ascending: [5, 4, 2, 1],
    twoOctaves: [5, 4, 2, 1, 4, 2, 1],
    verified: true,
  })),
  // LH black-key thirds D A E: 5 3 2 1
  ...(['D', 'A', 'E'] as const).map((key) => ({
    key: `${key} major`,
    kind: 'arpeggio' as const,
    mode: 'major' as const,
    hand: 'left' as const,
    ascending: [5, 3, 2, 1],
    twoOctaves: [5, 3, 2, 1, 3, 2, 1],
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
