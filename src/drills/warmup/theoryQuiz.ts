/** Quick theory questions about one major key, answered on the keyboard or by tapping. */
import {
  describeKeySignature,
  diatonicTriads,
  formatNoteName,
  keySignatureCount,
  keySignatureNotes,
  majorScale,
  noteAbove,
  QUIZ_INTERVALS,
  relativeMinor,
  spellChord,
  type NoteName,
} from '../../theory'

export type Rng = () => number

export interface ChordAnswer {
  symbol: string
  notes: NoteName[]
  pcs: number[]
}

export type TheoryQuestion =
  | { kind: 'note'; prompt: string; answer: NoteName; explain: string }
  | { kind: 'chord'; prompt: string; answer: ChordAnswer; explain: string }
  | { kind: 'choice'; prompt: string; options: string[]; answer: number; explain: string }

const F = formatNoteName
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th']
const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]!
const listNotes = (ns: NoteName[]) => ns.map(F).join(' ')

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Choice question with the answer shuffled in among distinct options. */
function choice(prompt: string, correct: string, distractors: string[], explain: string, rng: Rng): TheoryQuestion {
  const others = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 3)
  const options = shuffle([correct, ...others], rng)
  return { kind: 'choice', prompt, options, answer: options.indexOf(correct), explain }
}

function chordAnswer(root: NoteName, quality: 'major' | 'minor' | 'diminished', symbol: string): ChordAnswer {
  const c = spellChord(root, quality)
  return { symbol, notes: c.notes, pcs: c.pitchClasses }
}

type Maker = (key: string, rng: Rng) => TheoryQuestion

const interval: Maker = (key, rng) => {
  const from = pick(majorScale(key).slice(0, 7), rng)
  const iv = pick(QUIZ_INTERVALS, rng)
  const answer = noteAbove(from, iv)
  return {
    kind: 'note',
    prompt: `Play the note a ${iv.name} above ${F(from)}`,
    answer,
    explain: `${F(from)} up a ${iv.name} (${iv.semitones} half steps) is ${F(answer)}.`,
  }
}

const scaleDegree: Maker = (key, rng) => {
  const scale = majorScale(key)
  const degree = 2 + Math.floor(rng() * 6)
  const answer = scale[degree - 1]!
  return {
    kind: 'note',
    prompt: `Play the ${ORDINAL[degree]} note of the ${key} scale`,
    answer,
    explain: `${key}: ${listNotes(scale.slice(0, 7))}. The ${ORDINAL[degree]} note is ${F(answer)}.`,
  }
}

const degreeChord: Maker = (key, rng) => {
  const chord = pick(diatonicTriads(key).filter((c) => [2, 4, 5, 6].includes(c.degree)), rng)
  const answer = chordAnswer(chord.root, chord.quality as 'major' | 'minor', chord.symbol)
  return {
    kind: 'chord',
    prompt: `Play the ${chord.roman} chord in ${key}`,
    answer,
    explain: `${chord.roman} is built on the ${ORDINAL[chord.degree]} note: ${chord.symbol} (${listNotes(answer.notes)}).`,
  }
}

const relativeMinorChord: Maker = (key) => {
  const root = relativeMinor(key)
  const answer = chordAnswer(root, 'minor', `${F(root)}m`)
  return {
    kind: 'chord',
    prompt: `Play the chord of ${key}'s relative minor`,
    answer,
    explain: `The relative minor starts on the 6th note of the scale: ${F(root)} minor (${listNotes(answer.notes)}), same key signature.`,
  }
}

const keySignature: Maker = (key, rng) => {
  const count = keySignatureCount(key)
  const notes = keySignatureNotes(key)
  const near = [count - 1, count + 1, count + 2, count - 2, 0, 1, -1].filter((n) => n !== count && n >= -3 && n <= 5)
  return choice(
    `How many sharps or flats are in ${key}?`,
    describeKeySignature(count),
    shuffle(near, rng).map(describeKeySignature),
    notes.length
      ? `${key} has ${describeKeySignature(count).toLowerCase()}: ${listNotes(notes)}.`
      : `${key} has no sharps or flats.`,
    rng,
  )
}

const nameChord: Maker = (key, rng) => {
  const triads = diatonicTriads(key).filter((c) => c.quality !== 'diminished')
  const chord = pick(triads, rng)
  const notes = spellChord(chord.root, chord.quality).notes
  const flip = chord.quality === 'major' ? `${F(chord.root)}m` : F(chord.root)
  const others = triads.filter((c) => c.symbol !== chord.symbol).map((c) => c.symbol)
  return choice(
    `Which chord is ${notes.map(F).join(' – ')}?`,
    chord.symbol,
    [flip, ...shuffle(others, rng)],
    `${listNotes(notes)} stacks thirds on ${F(chord.root)}: ${chord.symbol} (${chord.roman} in ${key}).`,
    rng,
  )
}

const chordQuality: Maker = (key, rng) => {
  const chord = pick(diatonicTriads(key), rng)
  const label = chord.quality === 'major' ? 'Major' : chord.quality === 'minor' ? 'Minor' : 'Diminished'
  return choice(
    `In ${key}, what kind of chord is built on the ${ORDINAL[chord.degree]} note?`,
    label,
    ['Major', 'Minor', 'Diminished'],
    `It's ${chord.symbol} (${chord.roman}). In every major key I, IV and V are major; ii, iii and vi are minor; vii° is diminished.`,
    rng,
  )
}

const MAKERS: Maker[] = [interval, scaleDegree, degreeChord, relativeMinorChord, keySignature, nameChord, chordQuality]

/** A mixed set: every question type once before any repeats, never the same prompt twice. */
export function theoryQuestions(key: string, count: number, rng: Rng = Math.random): TheoryQuestion[] {
  const out: TheoryQuestion[] = []
  const seen = new Set<string>()
  let order: Maker[] = []
  let guard = 0
  while (out.length < count && guard++ < count * 20) {
    if (!order.length) order = shuffle(MAKERS, rng)
    const q = order.shift()!(key, rng)
    if (seen.has(q.prompt)) continue
    seen.add(q.prompt)
    out.push(q)
  }
  return out
}
