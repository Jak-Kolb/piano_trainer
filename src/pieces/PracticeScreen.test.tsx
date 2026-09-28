// @vitest-environment jsdom
/**
 * The practice screen end to end with a fake MIDI keyboard: audio and
 * storage are stubbed, the sheet renders for real.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InputSource, NoteEvent } from '../input'
import { parseMidiArrayBuffer } from './parseMidi'
import { playAccompaniment, startPlayAlong } from './pianoPlayer'
import { DEFAULT_OPTIONS, type PieceState, type PracticeOptions } from './practice/options'
import { PracticeScreen } from './PracticeScreen'
import { installDomShims } from './testing/renderStaff'
import { synthMidi } from './testing/synthMidi'
import type { ParsedPiece } from './types'

vi.mock('./pianoPlayer', () => ({
  playAccompaniment: vi.fn(async () => {}),
  playPianoNotes: vi.fn(async () => ({
    stop() {},
    pause() {},
    resume() {},
    originSec: 0,
    endSec: 1,
    startedAt: performance.now(),
  })),
  preloadPiano: vi.fn(),
  silencePiano: vi.fn(),
  startPlayAlong: vi.fn(async () => ({ startedAt: performance.now(), stop: vi.fn() })),
}))

vi.mock('./pieceStore', () => ({
  listSessions: vi.fn(async () => []),
  savePieceState: vi.fn(async () => {}),
  saveSession: vi.fn(async () => 1),
}))

function fakeKeyboard() {
  const held = new Set<number>()
  const changes = new Set<() => void>()
  const notes = new Set<(e: NoteEvent) => void>()
  const src: InputSource = {
    id: 'midi',
    label: 'MIDI',
    getStatus: () => 'Kawai USB MIDI',
    getHeldPitchClasses: () => [],
    getHeldMidiNotes: () => [...held],
    getMeter: () => null,
    supportsAutomaticGrade: () => true,
    start: async () => {},
    onChange(l) {
      changes.add(l)
      return () => changes.delete(l)
    },
    onNote(l) {
      notes.add(l)
      return () => notes.delete(l)
    },
    dispose() {},
  }
  const send = (midi: number, on: boolean) =>
    act(() => {
      if (on) held.add(midi)
      else held.delete(midi)
      for (const l of notes) l({ midi, on, velocity: on ? 0.7 : 0, time: performance.now() })
      for (const l of changes) l()
    })
  return {
    src,
    press: (m: number) => send(m, true),
    release: (m: number) => send(m, false),
    /** Press and release, like tapping a key. */
    tap: async (...ms: number[]) => {
      for (const m of ms) await send(m, true)
      for (const m of ms) await send(m, false)
    },
  }
}

// One bar of 4/4 at 120 bpm: RH C D E F quarters; LH C3 half, G2 half.
async function piece(): Promise<ParsedPiece> {
  return parseMidiArrayBuffer(
    synthMidi({
      notes: [
        [0, 1, 60, 0], [1, 1, 62, 0], [2, 1, 64, 0], [3, 1, 65, 0],
        [0, 2, 48, 1], [2, 2, 43, 1],
      ],
    }),
  )
}

function stateWith(over: Partial<PieceState>, options: Partial<PracticeOptions> = {}): PieceState {
  return {
    pieceId: 'p1',
    mode: 'learn',
    tempoPercent: 100,
    hands: 'both',
    range: null,
    lastBar: 1,
    view: 'staff',
    options: { ...DEFAULT_OPTIONS, ...options },
    updatedAt: '',
    ...over,
  }
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function mount(parsed: ParsedPiece, input: InputSource, initial: PieceState) {
  installDomShims()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <PracticeScreen
        pieceId="p1"
        parsed={parsed}
        title="Test piece"
        input={input}
        initial={initial}
        onExit={() => {}}
      />,
    )
  })
}

const status = () => container.querySelector('.practice-status-text')?.textContent ?? ''
const key = (midi: number) => container.querySelector(`.piano-chrome [data-midi="${midi}"]`)!
const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!

beforeEach(() => {
  vi.mocked(playAccompaniment).mockClear()
  vi.mocked(startPlayAlong).mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('Learn mode', () => {
  it('waits for each chord, and flags a wrong note in red', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({}))
    expect(status()).toContain('C3 C4')

    await kb.press(61)
    expect(key(61).className).toContain('piano-key--held-wrong')
    await kb.release(61)

    await kb.press(60)
    expect(status()).toContain('C3 C4') // still needs the left hand
    await kb.press(48)
    expect(status()).toContain('D4')
    expect(key(60).className).toContain('piano-key--held') // still held, not part of D4
  })

  it('plays the other hand for you when you practise one hand', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ hands: 'right' }, { otherHand: true }))
    await kb.tap(60)
    expect(playAccompaniment).toHaveBeenCalledTimes(1)
    const [notes, tempo, from] = vi.mocked(playAccompaniment).mock.calls[0]!
    expect(notes.map((n) => n.midi)).toEqual([48])
    expect([tempo, from]).toEqual([100, 0])
  })

  it('repeats the range and speeds up after a clean pass', async () => {
    const kb = fakeKeyboard()
    await mount(
      await piece(),
      kb.src,
      stateWith({ hands: 'right', tempoPercent: 80 }, { repeatLoop: true, speedUp: true, speedStep: 5 }),
    )
    for (const m of [60, 62, 64, 65]) await kb.tap(m)
    expect(container.querySelector('.tempo-value')?.textContent).toContain('85%')
    expect(status()).toContain('C4')
    expect(status()).toContain('pass 2 (last one clean)')

    // A wrong note makes the next pass not clean: no speed-up
    await kb.tap(61)
    for (const m of [60, 62, 64, 65]) await kb.tap(m)
    expect(container.querySelector('.tempo-value')?.textContent).toContain('85%')
  })
})

describe('Play along', () => {
  it('grades key presses against the clock and sums up the run', async () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
    const kb = fakeKeyboard()
    await mount(
      await piece(),
      kb.src,
      stateWith({ mode: 'play', hands: 'right' }, { countIn: false, metronome: false }),
    )
    await act(async () => {
      button('Start').click()
    })
    expect(startPlayAlong).toHaveBeenCalledTimes(1)
    expect(vi.mocked(startPlayAlong).mock.calls[0]![0]).toMatchObject({ countInSec: 0, clicks: [] })

    const at = async (ms: number) => {
      await act(async () => {
        vi.advanceTimersByTime(ms)
      })
    }
    await kb.tap(60) // C4 at 0 ms: on time
    await at(650)
    await kb.tap(62) // D4 due at 500 ms: 150 ms late
    await at(1000) // E4 due at 1000 ms: never played
    await kb.tap(65) // F4 at 1650 ms: 150 ms late
    await at(1000) // past the end of the bar

    const card = container.querySelector('.run-summary')?.textContent ?? ''
    expect(card).toContain('1 on time')
    expect(card).toContain('0 early · 2 late')
    expect(card).toContain('1 missed · 0 wrong')
    expect(card).toContain('behind the beat')
  })
})
