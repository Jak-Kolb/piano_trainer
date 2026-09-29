export type ModuleId =
  | 'warmup'
  | 'triad-recall'
  | 'inversions'
  | 'slash-chords'
  | 'scales'
  | 'arpeggios'
  | 'progressions'
  | 'theory'
  | 'left-hand'
  | 'progress'

export interface ModuleDef {
  id: ModuleId
  title: string
  blurb: string
  /** Mic can auto-grade this module (monophonic). */
  micAutoGrade: boolean
  /** Shown first and wide on the Skills screen. */
  featured?: boolean
}

export const MODULES: ModuleDef[] = [
  {
    id: 'warmup',
    title: '10-minute warmup',
    blurb: 'Scale, arpeggio, triads, inversions, a progression and theory, all in today’s key',
    micAutoGrade: false,
    featured: true,
  },
  {
    id: 'scales',
    title: 'Scales',
    blurb: 'Fingerings across two octaves',
    micAutoGrade: true,
  },
  {
    id: 'arpeggios',
    title: 'Arpeggios',
    blurb: 'Root position with finger numbers',
    micAutoGrade: true,
  },
  {
    id: 'triad-recall',
    title: 'Triad recall',
    blurb: 'Chord symbols → play the triad',
    micAutoGrade: false,
  },
  {
    id: 'inversions',
    title: 'Inversions',
    blurb: 'Shapes — root, 1st, 2nd',
    micAutoGrade: false,
  },
  {
    id: 'progressions',
    title: 'Chord progressions',
    blurb: 'I–V–vi–IV and friends, then again from the numerals',
    micAutoGrade: false,
  },
  {
    id: 'slash-chords',
    title: 'Slash chords',
    blurb: 'Symbol reading flashcards',
    micAutoGrade: false,
  },
  {
    id: 'left-hand',
    title: 'Left-hand patterns',
    blurb: 'Block, broken, Alberti',
    micAutoGrade: false,
  },
  {
    id: 'theory',
    title: 'Theory',
    blurb: 'Intervals, key signatures, scale degrees, chord names',
    micAutoGrade: false,
  },
  {
    id: 'progress',
    title: 'Progress',
    blurb: 'Streak, triad times, piece log',
    micAutoGrade: false,
  },
]
