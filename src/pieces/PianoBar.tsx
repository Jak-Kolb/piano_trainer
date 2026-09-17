/** Full-width piano; RH/LH colors, middle C always marked. */

import { useEffect, useRef } from 'react'
import { midiNoteLabel } from './nameChord'

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11])
const MIDDLE_C = 60

const WHITE_W = 28
const WHITE_H = 152
const BLACK_W = 18
const BLACK_H = 96

export type PianoHand = 'right' | 'left' | 'unknown'

export interface ActiveKey {
  midi: number
  hand: PianoHand
}

interface Props {
  activeKeys: ActiveKey[]
  lowMidi?: number
  highMidi?: number
}

function isWhite(midi: number): boolean {
  return WHITE_PC.has(((midi % 12) + 12) % 12)
}

function handFor(
  midi: number,
  byMidi: Map<number, PianoHand>,
): PianoHand | null {
  return byMidi.get(midi) ?? null
}

function whiteClass(
  on: boolean,
  hand: PianoHand | null,
  isMiddle: boolean,
): string {
  if (on && hand === 'left') return 'piano-key-white piano-key-white--on-lh'
  if (on && hand === 'right') return 'piano-key-white piano-key-white--on-rh'
  if (on) return 'piano-key-white piano-key-white--on'
  if (isMiddle) return 'piano-key-white piano-key-white--middle'
  return 'piano-key-white'
}

function blackClass(on: boolean, hand: PianoHand | null): string {
  if (on && hand === 'left') return 'piano-key-black piano-key-black--on-lh'
  if (on && hand === 'right') return 'piano-key-black piano-key-black--on-rh'
  if (on) return 'piano-key-black piano-key-black--on'
  return 'piano-key-black'
}

export function PianoBar({
  activeKeys,
  lowMidi = 21,
  highMidi = 108,
}: Props) {
  const byMidi = new Map<number, PianoHand>()
  for (const k of activeKeys) {
    const prev = byMidi.get(k.midi)
    // If both hands hit same pitch, mark unknown (rare)
    if (prev && prev !== k.hand && prev !== 'unknown' && k.hand !== 'unknown') {
      byMidi.set(k.midi, 'unknown')
    } else if (!prev) {
      byMidi.set(k.midi, k.hand)
    }
  }
  const activeMidis = [...byMidi.keys()]
  const scroller = useRef<HTMLDivElement>(null)
  const middleRef = useRef<HTMLDivElement>(null)

  const whites: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (isWhite(m)) whites.push(m)
  }
  const blacks: number[] = []
  for (let m = lowMidi; m <= highMidi; m++) {
    if (!isWhite(m)) blacks.push(m)
  }

  const whiteIndex = new Map(whites.map((m, i) => [m, i]))
  const totalW = whites.length * WHITE_W

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const targetMidi = activeMidis[0] ?? MIDDLE_C
    const el = root.querySelector(
      `[data-midi="${targetMidi}"]`,
    ) as HTMLElement | null
    const anchor = el ?? middleRef.current
    if (!anchor) return
    const a = anchor.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const delta = a.left + a.width / 2 - (r.left + r.width / 2)
    root.scrollLeft += delta
  }, [activeMidis.join(',')])

  return (
    <div className="piano-chrome">
      <div
        ref={scroller}
        className="w-full overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="relative mx-auto"
          style={{ width: totalW, height: WHITE_H }}
        >
          <div className="absolute inset-0 flex">
            {whites.map((m) => {
              const hand = handFor(m, byMidi)
              const on = hand != null
              const isMiddle = m === MIDDLE_C
              return (
                <div
                  key={m}
                  ref={isMiddle ? middleRef : undefined}
                  data-midi={m}
                  style={{ width: WHITE_W, height: WHITE_H }}
                  className={whiteClass(on, hand, isMiddle)}
                  title={
                    isMiddle
                      ? 'Middle C (C4)'
                      : `${midiNoteLabel(m)}${hand === 'right' ? ' · RH' : hand === 'left' ? ' · LH' : ''}`
                  }
                >
                  {(on || isMiddle) && (
                    <span
                      className={`piano-key-label ${
                        on || isMiddle ? 'text-on-accent' : 'text-on-accent/80'
                      }`}
                    >
                      {midiNoteLabel(m)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="pointer-events-none absolute inset-0">
            {blacks.map((m) => {
              const wi = whiteIndex.get(m - 1)
              if (wi == null) return null
              const left = (wi + 1) * WHITE_W - BLACK_W / 2
              const hand = handFor(m, byMidi)
              const on = hand != null
              return (
                <div
                  key={m}
                  data-midi={m}
                  style={{ left, width: BLACK_W, height: BLACK_H }}
                  className={blackClass(on, hand)}
                  title={`${midiNoteLabel(m)}${hand === 'right' ? ' · RH' : hand === 'left' ? ' · LH' : ''}`}
                >
                  {on && (
                    <span className="piano-key-label text-ivory">
                      {midiNoteLabel(m)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="piano-chrome-legend">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brass" />
          RH
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-lh" />
          LH
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-middle-c" />
          Middle C
        </span>
        <span className="normal-case tracking-normal">· scroll if needed</span>
      </p>
    </div>
  )
}
