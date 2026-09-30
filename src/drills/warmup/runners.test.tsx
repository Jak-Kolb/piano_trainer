// @vitest-environment jsdom
/** The warmup runners with a fake MIDI keyboard (audio stubbed). */
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeKeyboard } from '../../pieces/testing/fakeKeyboard'
import { PROGRESSIONS } from '../../theory'
import { ChordRun } from './ChordRun'
import { NoteRun } from './NoteRun'
import type { RunResult } from './keyboard'
import { arpeggioPasses, inversionTasks, progressionTasks, scalePasses } from './tasks'
import { TheoryRun } from './TheoryRun'
import type { TheoryQuestion } from './theoryQuiz'

vi.mock('../../pieces/pianoPlayer', () => ({
  preloadPiano: vi.fn(),
  playPianoNotes: vi.fn(async () => ({ stop() {} })),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function mount(el: ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(el))
}

const text = () => container.textContent ?? ''
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  // Not setImmediate: React's scheduler needs it for act() to finish
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('NoteRun (scales)', () => {
  it('moves on with each right key, counts wrong ones, then does the left hand', async () => {
    const kb = fakeKeyboard()
    const done = vi.fn<(r: RunResult) => void>()
    await mount(<NoteRun input={kb.src} passes={scalePasses('C major')} onDone={done} />)
    expect(text()).toContain('C major scale · right hand')
    expect(text()).toContain('Next: C4 with finger 1')

    const up = [60, 62, 64, 65, 67, 69, 71, 72]
    const down = [71, 69, 67, 65, 64, 62, 60]
    for (const m of up) await kb.tap(m)
    expect(text()).toContain('Next: B4 with finger 4') // the way down
    for (const m of down) await kb.tap(m)
    expect(text()).toContain('left hand')

    await kb.tap(49) // wrong
    expect(text()).toContain('1 wrong so far')
    for (const m of [...up, ...down].map((m) => m - 12)) await kb.tap(m)
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ line: '2 runs · 1 wrong note' }))
  })

  it('needs the exact key: the same note in another octave is wrong', async () => {
    const kb = fakeKeyboard()
    await mount(<NoteRun input={kb.src} passes={scalePasses('G major')} onDone={() => {}} />)
    await kb.tap(55) // G3 for G4
    expect(text()).toContain('Next: G4')
    expect(text()).toContain('1 wrong so far')
    await kb.tap(67)
    expect(text()).toContain('Next: A4')
  })

  it('arpeggios need the exact key too', async () => {
    const kb = fakeKeyboard()
    await mount(<NoteRun input={kb.src} passes={arpeggioPasses('C major')} onDone={() => {}} />)
    await kb.tap(60)
    await kb.tap(76) // E5 for E4
    expect(text()).toContain('Next: E4 with finger 2')
    expect(text()).toContain('1 wrong so far')
  })
})

describe('ChordRun', () => {
  it('grades triads, counting a wrong full chord once, and reports first tries', async () => {
    const kb = fakeKeyboard()
    const done = vi.fn<(r: RunResult) => void>()
    const tasks = progressionTasks('C major', { name: 'test', degrees: [1, 6] }) // C, Am
    await mount(<ChordRun input={kb.src} tasks={tasks} layout="single" onDone={done} />)
    expect(container.querySelector('.chord-big')?.textContent).toBe('C')

    await kb.tap(60, 64, 67) // C E G
    await wait(600)
    expect(container.querySelector('.chord-big')?.textContent).toBe('Am')

    await kb.press(57)
    await kb.press(60)
    await kb.press(65) // A C F: wrong full chord
    expect(text()).toContain('Not quite')
    await kb.release(65)
    await kb.press(64) // A C E: right
    await wait(600)
    expect(done).toHaveBeenCalledWith({ line: '1 of 2 first try', score: 0.5 })
  })

  it('shows the answer after two wrong chords', async () => {
    const kb = fakeKeyboard()
    const tasks = progressionTasks('C major', { name: 'test', degrees: [1] })
    await mount(<ChordRun input={kb.src} tasks={tasks} layout="single" onDone={() => {}} />)
    await kb.tap(60, 63, 67)
    expect(container.querySelector('.run-answer')).toBeNull()
    await kb.tap(60, 65, 69)
    expect(container.querySelector('.run-answer')?.textContent).toBe('C E G')
  })

  it('inversions need the right lowest note', async () => {
    const kb = fakeKeyboard()
    const done = vi.fn()
    let seed = 7
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const task = inversionTasks('C major', 60, rng).find((t) => t.id === 'C/1')
    expect(task).toBeDefined() // C major, 1st inversion
    await mount(<ChordRun input={kb.src} tasks={[task!]} layout="single" onDone={done} />)
    await kb.tap(60, 64, 67) // root position: not it
    expect(text()).toContain('Not quite')
    await kb.tap(64, 67, 72) // E G C
    await wait(600)
    expect(done).toHaveBeenCalled()
  })

  it('plays a progression twice, the second time from the numerals', async () => {
    const kb = fakeKeyboard()
    const done = vi.fn()
    const tasks = progressionTasks('C major', PROGRESSIONS.find((p) => p.name === 'ii–V–I')!)
    await mount(<ChordRun input={kb.src} tasks={tasks} layout="row" passes={2} onDone={done} />)
    const names = () => [...container.querySelectorAll('.chord-box-name')].map((e) => e.textContent)
    expect(names()).toEqual(['Dm', 'G', 'C'])
    for (const chord of [[62, 65, 69], [55, 59, 62], [60, 64, 67]]) {
      await kb.tap(...chord)
      await wait(600)
    }
    expect(names()).toEqual(['?', '?', '?'])
    for (const chord of [[62, 65, 69], [55, 59, 62], [60, 64, 67]]) {
      await kb.tap(...chord)
      await wait(600)
    }
    expect(done).toHaveBeenCalledWith({ line: '6 of 6 first try', score: 1 })
  })
})

describe('without a keyboard', () => {
  const noDevice = () => {
    const kb = fakeKeyboard()
    kb.src.hasDevice = () => false
    return kb.src
  }
  const click = (label: string) =>
    act(async () => {
      ;[...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click()
    })

  it('"Got it" moves through a progression, then the numerals-only pass', async () => {
    const done = vi.fn()
    const tasks = progressionTasks('G major', PROGRESSIONS[0]!)
    await mount(<ChordRun input={noDevice()} tasks={tasks} layout="row" passes={2} onDone={done} />)
    for (let i = 0; i < 4; i++) {
      await click('Got it')
      await wait(600)
    }
    const names = [...container.querySelectorAll('.chord-box-name')].map((e) => e.textContent)
    expect(names).toEqual(['?', '?', '?', '?'])
    expect(text()).toContain('5 / 8')
  })

  it('a double click counts once', async () => {
    const tasks = progressionTasks('G major', PROGRESSIONS[0]!)
    await mount(<ChordRun input={noDevice()} tasks={tasks} layout="row" onDone={() => {}} />)
    await click('Got it')
    await click('Got it')
    await wait(600)
    expect(text()).toContain('2 / 4')
  })

  it('scales are ticked off pass by pass', async () => {
    const done = vi.fn()
    await mount(<NoteRun input={noDevice()} passes={scalePasses('C major')} onDone={done} />)
    await click('Played it')
    expect(text()).toContain('left hand')
    await click('Played it')
    expect(done).toHaveBeenCalledWith({ line: '2 runs', score: 1 })
  })
})

describe('TheoryRun', () => {
  const questions: TheoryQuestion[] = [
    { kind: 'note', prompt: 'Play the note a major 3rd above C', answer: { letter: 'E', accidental: '' }, explain: 'C up a major 3rd is E.' },
    {
      kind: 'chord',
      prompt: 'Play the V chord in C major',
      answer: { symbol: 'G', notes: [{ letter: 'G', accidental: '' }, { letter: 'B', accidental: '' }, { letter: 'D', accidental: '' }], pcs: [7, 11, 2] },
      explain: 'V is G.',
    },
    { kind: 'choice', prompt: 'How many sharps or flats are in C major?', options: ['1 sharp', 'No sharps or flats', '1 flat'], answer: 1, explain: 'None.' },
  ]
  it('gives a second try, explains, and scores only first tries', async () => {
    const kb = fakeKeyboard()
    const done = vi.fn<(r: RunResult) => void>()
    await mount(<TheoryRun input={kb.src} questions={questions} onDone={done} />)

    await kb.tap(65) // F: wrong
    expect(text()).toContain('One more try')
    await kb.tap(76) // E5: right (any octave), but not first try
    expect(text()).toContain('C up a major 3rd is E.')
    await wait(2300)

    await kb.tap(67, 71, 74) // G B D
    expect(text()).toContain('V is G.')
    await wait(2300)

    const options = [...container.querySelectorAll<HTMLButtonElement>('.choice')]
    await act(async () => options[1]!.click())
    expect(options[1]!.className).toContain('choice--right')
    await wait(2300)
    expect(done).toHaveBeenCalledWith({ line: '2 of 3 right', score: 2 / 3 })
  })

  it('shows the answer after two misses and waits for Next', async () => {
    const kb = fakeKeyboard()
    await mount(<TheoryRun input={kb.src} questions={questions} onDone={() => {}} />)
    await kb.tap(62)
    await kb.tap(63)
    expect(text()).toContain('Answer: E')
    await wait(5000)
    expect(text()).toContain('Answer: E') // no auto-advance after a miss
  })
})
