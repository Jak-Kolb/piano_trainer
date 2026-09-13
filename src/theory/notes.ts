/** Pitch class 0=C … 11=B. Pure theory — no UI. */

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = 'bb' | 'b' | '' | '#' | '##'

export interface NoteName {
  letter: Letter
  accidental: Accidental
}

export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const LETTER_PC: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const ACC_OFFSET: Record<Accidental, number> = {
  bb: -2,
  b: -1,
  '': 0,
  '#': 1,
  '##': 2,
}

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

export function pitchClass(note: NoteName): number {
  return mod12(LETTER_PC[note.letter] + ACC_OFFSET[note.accidental])
}

export function formatNoteName(note: NoteName): string {
  const acc =
    note.accidental === 'b'
      ? '♭'
      : note.accidental === '#'
        ? '♯'
        : note.accidental === 'bb'
          ? '𝄫'
          : note.accidental === '##'
            ? '𝄪'
            : ''
  return `${note.letter}${acc}`
}

/** Natural note letters in circle order for spelling helpers. */
export function letterAt(index: number): Letter {
  return LETTERS[((index % 7) + 7) % 7]
}

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter)
}
