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

function whiteBg(on: boolean, hand: PianoHand | null, isMiddle: boolean): string {
  if (on && hand === 'left') return 'bg-[#C45C6A]' // LH rose
  if (on && hand === 'right') return 'bg-brass' // RH gold
  if (on) return 'bg-brass'
  if (isMiddle) return 'bg-[#7EB6C9]'
  return 'bg-ivory'
}

function blackBg(on: boolean, hand: PianoHand | null): string {
  if (on && hand === 'left') return 'bg-[#8B3A48]'
  if (on && hand === 'right') return 'bg-felt'
  if (on) return 'bg-felt'
  return 'bg-[#1a1f2e]'
}

export function PianoBar({
  activeKeys,
  lowMidi = 36,
  highMidi = 96,
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
    <div className="w-full shrink-0 border-t border-dust/20 bg-ink px-2 py-2">
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
              const bg = whiteBg(on, hand, isMiddle)
              return (
                <div
                  key={m}
                  ref={isMiddle ? middleRef : undefined}
                  data-midi={m}
                  style={{ width: WHITE_W, height: WHITE_H }}
                  className={`relative flex shrink-0 flex-col justify-end border border-dust/40 pb-1 ${bg} ${
                    isMiddle ? 'ring-2 ring-inset ring-[#3D7A8F]' : ''
                  }`}
                  title={
                    isMiddle
                      ? 'Middle C (C4)'
                      : `${midiNoteLabel(m)}${hand === 'right' ? ' · RH' : hand === 'left' ? ' · LH' : ''}`
                  }
                >
                  {(on || isMiddle) && (
                    <span
                      className={`block text-center font-ui text-[10px] font-semibold leading-none ${
                        on ? 'text-ink' : 'text-ink/80'
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
                  className={`absolute top-0 flex flex-col justify-end rounded-b pb-1 ${blackBg(on, hand)} ${
                    on ? 'ring-1 ring-ivory/40' : ''
                  }`}
                  title={`${midiNoteLabel(m)}${hand === 'right' ? ' · RH' : hand === 'left' ? ' · LH' : ''}`}
                >
                  {on && (
                    <span className="block text-center font-ui text-[8px] font-semibold leading-none text-ivory">
                      {midiNoteLabel(m)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-3 pt-1 font-ui text-[10px] text-dust">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brass" />
          RH
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#C45C6A]" />
          LH
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#7EB6C9]" />
          Middle C
        </span>
        <span>· scroll if needed</span>
      </p>
    </div>
  )
}
