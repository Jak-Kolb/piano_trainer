import { KeyManager } from 'vexflow'

/** Parse a Vex pitch root like "f#", "bb", "c". */
export function parsePitchRoot(root: string): { letter: string; acc: string } {
  const r = root.toLowerCase()
  // Double accidentals need a letter + "bb"/"##" (e.g. "bbb", "f##").
  // Plain "bb" is B-flat — must not be read as B double-flat.
  if (r.length >= 3 && r.endsWith('bb')) return { letter: r[0]!, acc: 'bb' }
  if (r.length >= 3 && r.endsWith('##')) return { letter: r[0]!, acc: '##' }
  if (r.includes('#')) return { letter: r[0]!, acc: '#' }
  if (r.length > 1 && r.endsWith('b')) return { letter: r[0]!, acc: 'b' }
  return { letter: r[0]!, acc: '' }
}

/**
 * True when this pitch needs an explicit accidental given the key signature
 * (i.e. it isn't already implied by the key).
 */
export function needsWrittenAccidental(
  pitchRoot: string,
  keySignature: string,
): boolean {
  const { letter, acc } = parsePitchRoot(pitchRoot)
  try {
    const km = new KeyManager(keySignature || 'C')
    const expected = km.getAccidental(letter)
    const expectedAcc = (expected?.accidental ?? '') as string
    return acc !== expectedAcc
  } catch {
    return acc !== ''
  }
}

/** Accidental glyph to write, or null if none / covered by key. */
export function writtenAccidental(
  pitchRoot: string,
  keySignature: string,
): '#' | 'b' | 'bb' | 'n' | null {
  const { letter, acc } = parsePitchRoot(pitchRoot)
  let expectedAcc = ''
  try {
    const km = new KeyManager(keySignature || 'C')
    expectedAcc = (km.getAccidental(letter)?.accidental ?? '') as string
  } catch {
    expectedAcc = ''
  }
  if (acc === expectedAcc) return null
  if (acc === '') return 'n' // natural cancels key accidental
  if (acc === '#' || acc === 'b' || acc === 'bb') return acc
  return null
}

/**
 * Accidental glyph for this note given measure persistence.
 * `seen` maps "letter/octave" → last effective accidental in the bar
 * ("" | "#" | "b" | "bb"). Missing entries mean "still following the key".
 * Mutates `seen` when a glyph is (or would be) written.
 */
export function accidentalForMeasure(
  pitchRoot: string,
  octave: string | number,
  keySignature: string,
  seen: Map<string, string>,
): '#' | 'b' | 'bb' | 'n' | null {
  const { letter, acc } = parsePitchRoot(pitchRoot)
  const slot = `${letter}/${octave}`
  let keyExpected = ''
  try {
    const km = new KeyManager(keySignature || 'C')
    keyExpected = (km.getAccidental(letter)?.accidental ?? '') as string
  } catch {
    keyExpected = ''
  }
  const prev = seen.has(slot) ? seen.get(slot)! : keyExpected
  if (acc === prev) return null
  seen.set(slot, acc)
  if (acc === '') return 'n'
  if (acc === '#' || acc === 'b' || acc === 'bb') return acc
  return null
}

