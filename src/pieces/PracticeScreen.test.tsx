// @vitest-environment jsdom
/**
 * The practice screen end to end with a fake MIDI keyboard: audio and
 * storage are stubbed, the sheet renders for real.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InputSource } from '../input'
import { parseMidiArrayBuffer } from './parseMidi'
import { setLocalControl } from './pianoOut'
import { playAccompaniment, startPlayAlong } from './pianoPlayer'
import { DEFAULT_OPTIONS, type PieceState, type PracticeOptions } from './practice/options'
import { PracticeScreen } from './PracticeScreen'
import { fakeKeyboard } from './testing/fakeKeyboard'
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

vi.mock('./pianoOut', () => ({ setLocalControl: vi.fn() }))

vi.mock('./pieceStore', () => ({
  listSessions: vi.fn(async () => []),
  savePieceState: vi.fn(async () => {}),
  saveSession: vi.fn(async () => 1),
}))

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

async function mount(
  parsed: ParsedPiece,
  input: InputSource,
  initial: PieceState,
  onRename?: (name: string) => void,
) {
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
        onRename={onRename}
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

const otherHandSwitch = () =>
  [...container.querySelectorAll('[role="switch"]')].find((b) =>
    b.textContent?.includes('Play the other hand for me'),
  ) as HTMLButtonElement

async function turnOnOtherHand() {
  await act(async () => button('Practice options').click())
  await act(async () => otherHandSwitch().click())
  expect(otherHandSwitch().getAttribute('aria-checked')).toBe('true')
}

describe('Learn mode', () => {
  it('"Play the other hand for me" starts off each time you open a piece', async () => {
    const kb = fakeKeyboard()
    // Left on last time, and saved with the piece
    await mount(await piece(), kb.src, stateWith({ hands: 'right' }, { otherHand: true }))
    expect(otherHandSwitch().getAttribute('aria-checked')).toBe('false')
    await kb.tap(60)
    expect(playAccompaniment).not.toHaveBeenCalled()
  })

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
    await mount(await piece(), kb.src, stateWith({ hands: 'right' }))
    await turnOnOtherHand()
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

describe('Perform mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] })
  })
  const later = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

  it('any key plays the next notes with your touch; a chord bang is one press', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    expect(status()).toContain('press any key')

    await kb.tap(90, 91, 92) // three wrong keys at once
    expect(playAccompaniment).toHaveBeenCalledTimes(1)
    const [notes, tempo, from] = vi.mocked(playAccompaniment).mock.calls[0]!
    expect(notes.map((n) => n.midi).sort()).toEqual([48, 60]) // C3 + C4, both hands
    expect([tempo, from]).toEqual([100, 0])
    expect(notes.every((n) => Math.abs(n.velocity - 0.7) < 0.02)).toBe(true) // pressed at 0.7

    await later(500)
    await kb.tap(20)
    expect(vi.mocked(playAccompaniment).mock.calls[1]![0].map((n) => n.midi)).toEqual([62])
  })

  it('plays the whole song, both hands, whatever the hands setting, only on your presses', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform', hands: 'right' }, { otherHand: true }))
    expect(container.querySelector('[aria-label="Hands"]')).toBeNull()
    for (const m of [30, 31, 32]) {
      await kb.tap(m)
      await later(500)
    }
    const calls = vi.mocked(playAccompaniment).mock.calls
    expect(calls.map((c) => c[0].map((n) => n.midi).sort())).toEqual([[48, 60], [62], [43, 64]])
    // Each press sounds its notes together, at the press: nothing trails it
    for (const [notes, , from] of calls) expect(notes.every((n) => n.time === from)).toBe(true)
  })

  it("mutes the piano's own key sound while performing, and restores it after", async () => {
    vi.mocked(setLocalControl).mockClear()
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    expect(vi.mocked(setLocalControl).mock.calls).toEqual([[false]])
    await act(async () => button('Learn').click())
    expect(vi.mocked(setLocalControl).mock.calls).toEqual([[false], [true]])
  })

  it("gives the piano its own sound back while this tab is hidden", async () => {
    vi.mocked(setLocalControl).mockClear()
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    const setVisibility = async (v: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      await act(async () => void document.dispatchEvent(new Event('visibilitychange')))
    }
    await setVisibility('hidden')
    await setVisibility('visible')
    expect(vi.mocked(setLocalControl).mock.calls).toEqual([[false], [true], [false]])
    delete (document as { visibilityState?: string }).visibilityState
  })

  it('forgives a rolled chord: keys a little apart are one press', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    await kb.press(60)
    await later(100) // the rest of the chord, 100 ms late
    await kb.press(64)
    expect(playAccompaniment).toHaveBeenCalledTimes(1)
    await later(300)
    await kb.press(67) // the next note
    expect(vi.mocked(playAccompaniment).mock.calls.map((c) => c[0].map((n) => n.midi))).toEqual([[48, 60], [62]])
  })

  it('follows your pace from the second press, faster or much slower', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    await kb.tap(40)
    await later(250) // a beat (0.5 s at 120 bpm) in 0.25 s
    await kb.tap(40)
    expect(vi.mocked(playAccompaniment).mock.calls[1]![1]).toBeCloseTo(200)
  })

  it('slow presses slow it down, even far below the written tempo', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    await kb.tap(40)
    await later(1600) // a beat in 1.6 s: under a third of the speed
    await kb.tap(40)
    expect(vi.mocked(playAccompaniment).mock.calls[1]![1]).toBeCloseTo(31.25)
  })
})

describe('Choosing bars', () => {
  // Four bars: a C4 and a C3 in each.
  async function fourBars(): Promise<ParsedPiece> {
    return parseMidiArrayBuffer(
      synthMidi({
        notes: [0, 4, 8, 12].flatMap((b) => [[b, 4, 60, 0], [b, 4, 48, 1]] as [number, number, number, number][]),
      }),
    )
  }
  const strip = () => {
    const track = container.querySelector('.bar-strip-track') as HTMLElement
    track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 10, right: 400, bottom: 10, x: 0, y: 0, toJSON() {} })
    track.setPointerCapture = () => {}
    return track
  }
  const onStrip = (type: string, clientX: number) =>
    act(async () => {
      strip().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX }))
    })
  const rangeChip = () => container.querySelector('.range-chip')?.textContent ?? ''

  it('clicking a bar outside the selected bars clears them and goes there', async () => {
    const kb = fakeKeyboard()
    await mount(await fourBars(), kb.src, stateWith({ range: { start: 2, end: 3 }, lastBar: 2 }))
    expect(rangeChip()).toContain('Bars 2–3')
    await onStrip('pointerdown', 350) // bar 4
    await onStrip('pointerup', 350)
    expect(rangeChip()).toContain('Whole piece')
    expect(status()).toContain('Bar 4')
  })

  it('dragging across the bar strip selects those bars', async () => {
    const kb = fakeKeyboard()
    await mount(await fourBars(), kb.src, stateWith({}))
    await onStrip('pointerdown', 50) // bar 1
    await onStrip('pointermove', 250) // bar 3
    await onStrip('pointerup', 250)
    expect(rangeChip()).toContain('Bars 1–3')
  })
})

describe('Perform: Assisted', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] })
  })
  const later = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))
  const played = () => vi.mocked(playAccompaniment).mock.calls.map((c) => c[0].map((n) => n.midi).sort())
  const notes = (...ns: [number, number, number][]) => ns.map(([b, l, m]) => [b, l, m, 0] as [number, number, number, number])

  it('eighth notes each take a press; the 16ths between them play by themselves', async () => {
    // 4/4 at 120 bpm (a quarter is 0.5 s): eighth C, eighth D, then 16ths E F G A
    const parsed = await parseMidiArrayBuffer(
      synthMidi({
        notes: [
          ...notes([0, 0.5, 60], [0.5, 0.5, 62], [1, 0.25, 64], [1.25, 0.25, 65], [1.5, 0.25, 67], [1.75, 0.25, 69]),
          [0, 4, 48, 1],
        ],
      }),
    )
    const kb = fakeKeyboard()
    await mount(parsed, kb.src, stateWith({ mode: 'perform' }, { performTap: 'assisted' }))
    expect(status()).toContain('16ths and faster play by themselves')

    // Pressed at the written speed: an eighth is 250 ms, a 16th 125 ms
    await kb.press(30)
    await later(250)
    expect(played()).toEqual([[48, 60]]) // the eighth after it waits for you
    await kb.press(31)
    await later(250)
    expect(played()).toEqual([[48, 60], [62]])
    await kb.press(32) // E, then F by itself
    expect(played().at(-1)).toEqual([64])
    await later(150)
    expect(played().at(-1)).toEqual([65])
    await later(100)
    await kb.press(33) // G, then A by itself
    await later(1000)
    expect(played()).toEqual([[48, 60], [62], [64], [65], [67], [69]])
  })

  it('pressing again before the fast notes have played drops them: you stay on time', async () => {
    const parsed = await parseMidiArrayBuffer(
      synthMidi({ notes: [...notes([0, 0.375, 60], [0.375, 0.125, 62], [0.5, 0.5, 64]), [0, 2, 48, 1]] }),
    )
    const kb = fakeKeyboard()
    await mount(parsed, kb.src, stateWith({ mode: 'perform' }, { performTap: 'assisted' }))
    await kb.press(30) // C, with the fast D after it (due at 187 ms)
    await later(150) // before D: press for E (the eighth, due at 250 ms)
    await kb.press(31)
    await later(1000)
    expect(played()).toEqual([[48, 60], [64]])
  })

  it('two keys pressed quickly back to back are one press: it doesn’t race ahead', async () => {
    // Eighths C D E F with 32nds after C (Piano Man-style); an eighth is 250 ms
    const parsed = await parseMidiArrayBuffer(
      synthMidi({
        notes: [
          ...notes([0, 0.125, 60], [0.125, 0.125, 61], [0.25, 0.25, 62], [0.5, 0.5, 64], [1, 0.5, 65], [1.5, 0.5, 67]),
          [0, 2, 48, 1],
        ],
      }),
    )
    const kb = fakeKeyboard()
    await mount(parsed, kb.src, stateWith({ mode: 'perform' }, { performTap: 'assisted' }))
    await kb.press(30)
    await later(90) // a second key, far too soon
    await kb.press(31)
    await later(300)
    expect(played()).toEqual([[48, 60], [61], [62]]) // C and its 32nds only
    await kb.press(32) // the next eighth, in time
    expect(played().at(-1)).toEqual([64])
    expect(vi.mocked(playAccompaniment).mock.calls.at(-1)![1]).toBeLessThan(150) // the pace didn't jump
  })

  it('switching to Assisted in the bar', async () => {
    const kb = fakeKeyboard()
    await mount(await piece(), kb.src, stateWith({ mode: 'perform' }))
    await act(async () => button('Assisted').click())
    expect(button('Assisted').getAttribute('aria-checked')).toBe('true')
    expect(status()).toContain('16ths and faster play by themselves')
  })
})
describe('Renaming a piece', () => {
  const setValue = (el: HTMLInputElement, v: string) => {
    // React tracks the value: set it through the native setter so onChange fires
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const titleBox = () => container.querySelector('input[aria-label="Piece name"]') as HTMLInputElement | null
  const title = () => container.querySelector('h1.practice-title')!

  it('double-click the title, type a new name, Enter saves; Escape cancels', async () => {
    const onRename = vi.fn()
    await mount(await piece(), fakeKeyboard().src, stateWith({}), onRename)
    await act(async () => void title().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(titleBox()?.value).toBe('Test piece')
    await act(async () => setValue(titleBox()!, '  Another Love (slow)  '))
    await act(async () => void titleBox()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onRename).toHaveBeenCalledWith('Another Love (slow)')
    expect(titleBox()).toBeNull()

    await act(async () => void title().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await act(async () => setValue(titleBox()!, 'Nope'))
    await act(async () => void titleBox()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(title().textContent).toBe('Test piece')
  })
})
