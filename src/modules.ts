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
  | 'progress'

export interface ModuleDef {
  id: ModuleId
  title: string
  blurb: string
  /** false = listed but not playable yet */
  available: boolean
  /** Mic can auto-grade this module (monophonic). */
  micAutoGrade: boolean
}

export const MODULES: ModuleDef[] = [
  {
    id: 'triad-recall',
    title: 'Triad recall',
    blurb: 'Chord symbols → play the triad',
    available: true,
    micAutoGrade: false,
  },
  {
    id: 'inversions',
    title: 'Inversions',
    blurb: 'Shapes and voice-leading',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'slash-chords',
    title: 'Slash chords',
    blurb: 'Symbol reading flashcards',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'scales',
    title: 'Scales',
    blurb: 'Fingerings, metronome, evenness',
    available: false,
    micAutoGrade: true,
  },
  {
    id: 'arpeggios',
    title: 'Arpeggios',
    blurb: 'Two octaves with finger numbers',
    available: false,
    micAutoGrade: true,
  },
  {
    id: 'left-hand',
    title: 'Left-hand patterns',
    blurb: 'Block, broken, Alberti',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'sight-reading',
    title: 'Sight-reading',
    blurb: 'Unseen exercises, one shot',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'rhythm',
    title: 'Rhythm',
    blurb: 'Tap the grid',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'session',
    title: "Today's practice",
    blurb: 'Warm-up → reading → repertoire',
    available: false,
    micAutoGrade: false,
  },
  {
    id: 'progress',
    title: 'Progress',
    blurb: 'Streaks, levels, piece log',
    available: false,
    micAutoGrade: false,
  },
]
