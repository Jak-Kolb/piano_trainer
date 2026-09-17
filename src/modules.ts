export type ModuleId =
  | 'triad-recall'
  | 'inversions'
  | 'slash-chords'
  | 'scales'
  | 'arpeggios'
  | 'left-hand'
  | 'sight-reading'
  | 'rhythm'
  | 'session'
  | 'session-reading'
  | 'progress'

export interface ModuleDef {
  id: ModuleId
  title: string
  blurb: string
  /** Mic can auto-grade this module (monophonic). */
  micAutoGrade: boolean
}

export const MODULES: ModuleDef[] = [
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
    id: 'slash-chords',
    title: 'Slash chords',
    blurb: 'Symbol reading flashcards',
    micAutoGrade: false,
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
    id: 'left-hand',
    title: 'Left-hand patterns',
    blurb: 'Block, broken, Alberti',
    micAutoGrade: false,
  },
  {
    id: 'sight-reading',
    title: 'Sight-reading',
    blurb: 'Unseen exercises, one shot',
    micAutoGrade: false,
  },
  {
    id: 'rhythm',
    title: 'Rhythm',
    blurb: 'Tap the grid',
    micAutoGrade: false,
  },
  {
    id: 'session',
    title: "Today's practice",
    blurb: 'Warm-up → reading → repertoire',
    micAutoGrade: false,
  },
  {
    id: 'session-reading',
    title: '10 minutes only',
    blurb: 'Reading block alone',
    micAutoGrade: false,
  },
  {
    id: 'progress',
    title: 'Progress',
    blurb: 'Streaks, levels, piece log',
    micAutoGrade: false,
  },
]
