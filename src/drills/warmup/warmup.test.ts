import { describe, expect, it } from 'vitest'
import {
  describeKeySignature,
  diatonicTriads,
  formatNoteName,
  keySignatureCount,
  noteAbove,
  pitchClass,
  PROGRESSIONS,
  progressionChords,
  QUIZ_INTERVALS,
  relativeMinor,
  type NoteName,
} from '../../theory'
import {
  arpeggioPasses,
  inversionTasks,
  keyOfTheDay,
  progressionTasks,
  scalePasses,
  triadTasks,
  WARMUP_KEYS,
} from './tasks'
import { theoryQuestions } from './theoryQuiz'

/** Deterministic RNG for tests. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n = (s: string): NoteName => ({
  letter: s[0] as NoteName['letter'],
  accidental: (s.slice(1) as NoteName['accidental']) ?? '',
})
const names = (ns: NoteName[]) => ns.map(formatNoteName).join(' ')

describe('diatonic theory', () => {
  it('builds the seven triads of a major key', () => {
    expect(diatonicTriads('G major').map((c) => `${c.roman}=${c.symbol}`)).toEqual([
      'I=G', 'ii=Am', 'iii=Bm', 'IV=C', 'V=D', 'vi=Em', 'vii°=F♯dim',
    ])
    expect(diatonicTriads('F major').map((c) => c.symbol)).toEqual([
      'F', 'Gm', 'Am', 'B♭', 'C', 'Dm', 'Edim',
    ])
  })

  it('knows key signatures and relative minors', () => {
    expect(WARMUP_KEYS.map((k) => keySignatureCount(k))).toEqual([0, 1, 2, 3, 4, -1])
    expect(describeKeySignature(1)).toBe('1 sharp')
    expect(describeKeySignature(-1)).toBe('1 flat')
    expect(formatNoteName(relativeMinor('D major'))).toBe('B')
  })

  it('spells intervals by letter (C up a minor 3rd is E♭)', () => {
    const iv = (name: string) => QUIZ_INTERVALS.find((i) => i.name === name)!
    expect(formatNoteName(noteAbove(n('C'), iv('minor 3rd')))).toBe('E♭')
    expect(formatNoteName(noteAbove(n('E'), iv('major 3rd')))).toBe('G♯')
    expect(formatNoteName(noteAbove(n('B'), iv('perfect 5th')))).toBe('F♯')
    expect(formatNoteName(noteAbove(n('F'), iv('perfect 4th')))).toBe('B♭')
  })

  it('lays out progressions in a key', () => {
    const p = PROGRESSIONS.find((x) => x.name === 'ii–V–I')!
    expect(progressionChords('C major', p).map((c) => c.symbol)).toEqual(['Dm', 'G', 'C'])
  })
})

describe('warmup tasks', () => {
  it('rotates the key daily through the keys with verified fingerings', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => keyOfTheDay(new Date(2026, 8, 20 + d)))
    expect(new Set(days.slice(0, 6)).size).toBe(6)
    expect(days[6]).toBe(days[0])
  })

  it('scales go one octave up and down with verified fingers', () => {
    const [rh, lh] = scalePasses('G major')
    expect(names(rh!.notes)).toBe('G A B C D E F♯ G F♯ E D C B A G')
    expect(rh!.notes[0]!.midi).toBe(67)
    expect(rh!.fingers).toEqual([1, 2, 3, 1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 2, 1])
    expect(lh!.notes[0]!.midi).toBe(55)
    expect(lh!.fingers).toEqual([5, 4, 3, 2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 4, 5])
  })

  it('arpeggios go one octave up and down with fingers', () => {
    const [rh, lh] = arpeggioPasses('C major')
    expect(names(rh!.notes)).toBe('C E G C G E C')
    expect(rh!.fingers).toEqual([1, 2, 3, 5, 3, 2, 1])
    expect(lh!.fingers).toEqual([5, 4, 2, 1, 2, 4, 5])
    expect(arpeggioPasses('D major')[1]!.fingers).toEqual([5, 3, 2, 1, 2, 3, 5])
  })

  it('triads come mostly from the key and never repeat back to back', () => {
    const tasks = triadTasks('D major', 40, seeded(1))
    const inKey = new Set(diatonicTriads('D major').map((c) => c.symbol))
    const fromKey = tasks.filter((t) => inKey.has(t.title)).length
    expect(fromKey / tasks.length).toBeGreaterThan(0.6)
    tasks.forEach((t, i) => i && expect(t.id).not.toBe(tasks[i - 1]!.id))
  })

  it('inversions ask for the right lowest note', () => {
    for (const t of inversionTasks('A major', 20, seeded(2))) {
      expect(t.bass).toEqual(t.notes[0])
      expect(t.hint).toBe(`lowest note ${formatNoteName(t.notes[0]!)}`)
      expect(new Set(t.notes.map(pitchClass))).toEqual(new Set(t.pcs))
    }
  })

  it('never loops on a stuck random source', () => {
    expect(inversionTasks('C major', 5, () => 0.4).length).toBeGreaterThan(0)
    expect(triadTasks('C major', 5, () => 0.4).length).toBeGreaterThan(0)
  })

  it('progressions keep their order and numerals', () => {
    const tasks = progressionTasks('G major', PROGRESSIONS[0]!)
    expect(tasks.map((t) => `${t.roman}:${t.title}`)).toEqual(['I:G', 'V:D', 'vi:Em', 'IV:C'])
  })
})

describe('theory questions', () => {
  it('mixes question types without repeating a prompt', () => {
    const qs = theoryQuestions('E major', 14, seeded(3))
    expect(qs).toHaveLength(14)
    expect(new Set(qs.map((q) => q.prompt)).size).toBe(14)
    expect(new Set(qs.map((q) => q.kind))).toEqual(new Set(['note', 'chord', 'choice']))
  })

  it('choice questions list the right answer once among distinct options', () => {
    for (const key of WARMUP_KEYS) {
      for (const q of theoryQuestions(key, 20, seeded(4))) {
        if (q.kind !== 'choice') continue
        expect(new Set(q.options).size).toBe(q.options.length)
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(q.answer).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('answers are musically right', () => {
    for (const q of theoryQuestions('F major', 30, seeded(5))) {
      if (q.kind === 'choice' && q.prompt.startsWith('How many')) {
        expect(q.options[q.answer]).toBe('1 flat')
      }
      if (q.prompt === "Play the chord of F major's relative minor" && q.kind === 'chord') {
        expect(q.answer.symbol).toBe('Dm')
      }
      if (q.prompt === 'Play the 4th note of the F major scale' && q.kind === 'note') {
        expect(formatNoteName(q.answer)).toBe('B♭')
      }
    }
  })
})
