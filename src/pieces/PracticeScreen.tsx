import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InputSource } from '../input'
import {
  loadSheetPolarity,
  saveSheetPolarity,
  type SheetPolarity,
} from '../settings/colorProfile'
import { barsPerSystem, dominantBarQuarters, playNotesDemo } from './demoAudio'
import {
  canAcceptMidiStep,
  latchAfterMidiAccept,
  midiNames,
  pruneMidiLatch,
} from './noteMatch'
import { staffAssigner } from './notate'
import { chordWindowSec, groupSteps } from './parseMidi'
import { PianoBar } from './PianoBar'
import { PianoRoll } from './PianoRoll'
import {
  listSessions,
  savePieceState,
  saveSession,
} from './pieceStore'
import {
  playAccompaniment,
  preloadPiano,
  silencePiano,
  startPlayAlong,
} from './pianoPlayer'
import { BarStrip } from './practice/BarStrip'
import { createGrader, type Grade, type Grader, type RunSummary as Summary } from './practice/grading'
import { accompanimentFor, classifyHeld, isWrongNote } from './practice/learn'
import { clickTimes, countInClicks } from './practice/metronome'
import {
  saveLastOptions,
  tempoAfterPass,
  type PieceState,
  type PracticeMode,
  type PracticeOptions,
  type SheetView,
} from './practice/options'
import { PracticeDrawer } from './practice/PracticeDrawer'
import { RunSummary } from './practice/RunSummary'
import { summarize, type PracticeSession } from './practice/stats'
import { TransportBar, type RunState } from './practice/TransportBar'
import { systemIndexOf, type SystemPlan } from './sheetLayout'
import { StaffNotation } from './StaffNotation'
import { measureInfoAt } from './tieSlices'
import type { HandFilter, ParsedPiece, PieceNote } from './types'

interface Props {
  pieceId: string
  parsed: ParsedPiece
  title: string
  input: InputSource
  /** Settings to start from (saved for this piece, or the last-used ones). */
  initial: PieceState
  onExit: () => void
}

/** Playback in progress (Listen or Play along). */
interface ActiveRun {
  kind: 'listen' | 'play'
  stop: () => void
  pause?: () => void
  resume?: () => void
  /** performance.now() when the piece reaches originSec. */
  startedAt: number
  originSec: number
  endSec: number
  tempoFactor: number
  pausedAt?: number
  /** Listen: what's playing, so Repeat can start it again. */
  span?: { what: 'range' | 'bar' | 'line'; lo: number; hi: number }
}

/** Seconds of no playing after which practice time stops counting. */
const IDLE_SEC = 20

function firstStepAtBar(steps: PieceNote[][], bar: number): number {
  const i = steps.findIndex((s) => (s[0]?.measure ?? 0) >= bar)
  return i >= 0 ? i : Math.max(0, steps.length - 1)
}

/** Index of the step sounding at piece time t. */
function stepAt(steps: PieceNote[][], t: number): number {
  let lo = 0
  let hi = steps.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((steps[mid]![0]?.time ?? 0) <= t + 0.02) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export function PracticeScreen({ pieceId, parsed, title, input, initial, onExit }: Props) {
  const measureCount = parsed.measureCount
  const measures = parsed.measures
  const hasMidi = input.id === 'midi'
  // A keyboard is actually connected (not just MIDI mode with none plugged in)
  const keyboardOn = hasMidi && midiConnected(input)

  // ——— Settings (remembered per piece) ———
  const [mode, setMode] = useState<PracticeMode>(initial.mode)
  const [tempo, setTempo] = useState(initial.tempoPercent)
  const [hands, setHands] = useState<HandFilter>(initial.hands)
  const [range, setRange] = useState(initial.range)
  const [view, setView] = useState<SheetView>(initial.view)
  const [options, setOptions] = useState<PracticeOptions>(initial.options)
  const [polarity, setPolarity] = useState<SheetPolarity>(() => loadSheetPolarity())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [systems, setSystems] = useState<SystemPlan[]>([])

  const lo = range?.start ?? 1
  const hi = range?.end ?? measureCount

  // ——— What you play vs what the app plays ———
  const staffOf = useMemo(() => staffAssigner(parsed.notes), [parsed.notes])
  const handOf = useCallback(
    (n: PieceNote): HandFilter => (staffOf(n) === 'treble' ? 'right' : 'left'),
    [staffOf],
  )
  const inRange = useMemo(
    () => parsed.notes.filter((n) => n.measure >= lo && n.measure <= hi),
    [parsed.notes, lo, hi],
  )
  const mine = useMemo(
    () => (hands === 'both' ? inRange : inRange.filter((n) => handOf(n) === hands)),
    [inRange, hands, handOf],
  )
  const others = useMemo(
    () => (hands === 'both' ? [] : inRange.filter((n) => handOf(n) !== hands)),
    [inRange, hands, handOf],
  )
  const steps = useMemo(
    () => groupSteps(mine, chordWindowSec(parsed.secPerQuarter)),
    [mine, parsed.secPerQuarter],
  )

  // ——— Cursor: the step you're on (Learn), or where playback starts ———
  const [stepIdx, setStepIdx] = useState(() =>
    firstStepAtBar(steps, Math.min(measureCount, Math.max(1, initial.lastBar))),
  )
  const step = steps[stepIdx] as PieceNote[] | undefined
  const finished = steps.length > 0 && stepIdx >= steps.length
  const cursorBar = step?.[0]?.measure ?? (finished ? hi : lo)
  const cursorBarRef = useRef(cursorBar)
  cursorBarRef.current = cursorBar

  // Keep your place when the hand or range changes the step list.
  const stepsSeen = useRef(steps)
  useEffect(() => {
    if (stepsSeen.current === steps) return
    stepsSeen.current = steps
    const bar = Math.min(hi, Math.max(lo, cursorBarRef.current))
    setStepIdx(firstStepAtBar(steps, bar))
  }, [steps, lo, hi])

  // ——— Playback (Listen / Play along) ———
  const [run, setRun] = useState<RunState>('idle')
  const runRef = useRef<ActiveRun | null>(null)
  const [now, setNow] = useState<number | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const graderRef = useRef<Grader | null>(null)
  const [marks, setMarks] = useState<ReadonlyMap<string, Grade>>(new Map())
  const [summary, setSummary] = useState<{
    summary: Summary
    tempo: number
    nextTempo: number | null
  } | null>(null)
  const [countIn, setCountIn] = useState(false)

  // ——— Learn mode ———
  const latched = useRef<Set<number>>(new Set())
  const passMistakes = useRef(0)
  const [passes, setPasses] = useState({ total: 0, clean: 0, lastClean: false })
  const [held, setHeld] = useState<number[]>([])
  const [wrongHeld, setWrongHeld] = useState<Set<number>>(new Set())

  // ——— Stats ———
  const session = useRef<PracticeSession>({
    pieceId,
    startedAt: new Date().toISOString(),
    seconds: 0,
    mode: initial.mode,
    passes: 0,
    cleanPasses: 0,
    bestTempo: 0,
    mistakesByBar: {},
  })
  const [savedSessions, setSavedSessions] = useState<PracticeSession[]>([])
  const [statsEpoch, setStatsEpoch] = useState(0)
  const lastActive = useRef(0)
  const markActive = () => {
    lastActive.current = performance.now()
  }

  // Latest state for input / timer callbacks that subscribe once.
  const latest = useRef({ mode, run, steps, stepIdx, options, hands, tempo, others, lo, hi })
  latest.current = { mode, run, steps, stepIdx, options, hands, tempo, others, lo, hi }

  useEffect(() => {
    preloadPiano()
    void listSessions(pieceId).then(setSavedSessions).catch(() => {})
  }, [pieceId])

  const recordMistake = useCallback((bar: number) => {
    if (!latest.current.options.trackStats) return
    const m = session.current.mistakesByBar
    m[bar] = (m[bar] ?? 0) + 1
    setStatsEpoch((e) => e + 1)
  }, [])

  const recordPass = useCallback(
    (clean: boolean, atTempo: number, accuracy?: number) => {
      const L = latest.current
      if (!L.options.trackStats) return
      const s = session.current
      s.passes += 1
      s.mode = L.mode
      if (clean) {
        s.cleanPasses += 1
        s.bestTempo = Math.max(s.bestTempo, atTempo)
        const wholePiece = L.lo === 1 && L.hi === measureCount && L.hands === 'both'
        if (wholePiece) s.wholePieceClean = true
      }
      if (accuracy !== undefined) s.bestAccuracy = Math.max(s.bestAccuracy ?? 0, accuracy)
      setStatsEpoch((e) => e + 1)
    },
    [measureCount],
  )

  // Practice time: count seconds with recent playing or running playback.
  useEffect(() => {
    const id = window.setInterval(() => {
      const L = latest.current
      if (!L.options.trackStats) return
      const active =
        L.run === 'running' || performance.now() - lastActive.current < IDLE_SEC * 1000
      if (active) session.current.seconds += 1
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Save the session every 30 s and on the way out (serialized so the
  // first insert's id is known before the next update).
  const flushSession = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => {
    let chain = Promise.resolve()
    const save = () => {
      if (!latest.current.options.trackStats || session.current.seconds < 5) return chain
      const { id: _unsaved, ...snapshot } = {
        ...session.current,
        mistakesByBar: { ...session.current.mistakesByBar },
      }
      void _unsaved
      chain = chain
        .then(() => {
          // An explicit `id: undefined` is an invalid key; leave it out until
          // the store has assigned one.
          const known = session.current.id
          return saveSession(known === undefined ? snapshot : { ...snapshot, id: known })
        })
        .then((id) => {
          session.current.id = id
        })
        .catch((e: unknown) => console.warn('Could not save practice session', e))
      return chain
    }
    flushSession.current = save
    const id = window.setInterval(save, 30_000)
    // Closing or reloading the tab skips React cleanup: save on the way out.
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHide)
      save()
    }
  }, [])

  const troubleBars = useMemo(() => {
    if (!options.trackStats) return undefined
    void statsEpoch
    return summarize([...savedSessions, session.current]).troubleBars
  }, [options.trackStats, savedSessions, statsEpoch])

  // Remember settings with the piece; last-used switches seed new pieces.
  useEffect(() => {
    saveLastOptions(options)
    const t = window.setTimeout(() => {
      const state: PieceState = {
        pieceId,
        mode,
        tempoPercent: tempo,
        hands,
        range,
        lastBar: cursorBar,
        view,
        options,
        updatedAt: new Date().toISOString(),
      }
      // With remembering off, keep only the switches (so it stays off).
      void savePieceState(
        options.rememberSettings ? state : { ...initial, pieceId, options, updatedAt: state.updatedAt },
      ).catch(() => {})
    }, 400)
    return () => window.clearTimeout(t)
  }, [pieceId, mode, tempo, hands, range, cursorBar, view, options, initial])

  // ——— Playback control ———
  const stopRun = useCallback(() => {
    runRef.current?.stop()
    runRef.current = null
    setRun('idle')
    setNow(null)
    setHighlightIdx(-1)
    setCountIn(false)
  }, [])

  useEffect(() => () => runRef.current?.stop(), [])

  const lineOf = (bar: number): [number, number] => {
    const sys = systems[systemIndexOf(systems, bar)]
    return sys ? [sys.start, sys.start + sys.count - 1] : [bar, bar]
  }

  const startListen = async (what: 'range' | 'bar' | 'line', fromBar = cursorBar) => {
    stopRun()
    setSummary(null)
    const [a, b] =
      what === 'bar' ? [fromBar, fromBar] : what === 'line' ? lineOf(fromBar) : [fromBar, hi]
    const notes = mine.filter((n) => n.measure >= a && n.measure <= b)
    if (!notes.length) return
    setRun('loading')
    markActive()
    try {
      const h = await playNotesDemo(notes, tempo)
      runRef.current = {
        kind: 'listen',
        stop: h.stop,
        pause: h.pause,
        resume: h.resume,
        startedAt: h.startedAt,
        originSec: h.originSec,
        endSec: h.endSec,
        tempoFactor: Math.max(0.25, tempo / 100),
        span: { what, lo: a, hi: b },
      }
      setRun('running')
    } catch {
      setRun('idle')
    }
  }

  const startPlay = async (atTempo = tempo) => {
    stopRun()
    setSummary(null)
    const startBar = range ? lo : Math.min(hi, Math.max(lo, cursorBar))
    const first = measureInfoAt(measures, startBar)
    const last = measureInfoAt(measures, hi)
    const tempoFactor = Math.max(0.25, atTempo / 100)
    const expected = mine.filter((n) => n.measure >= startBar)
    const accompaniment =
      options.otherHand && hands !== 'both' ? others.filter((n) => n.measure >= startBar) : []
    const clicks = [
      ...(options.countIn ? countInClicks(measures, startBar) : []),
      ...(options.metronome ? clickTimes(measures, startBar, hi) : []),
    ]
    graderRef.current = midiConnected(input) ? createGrader(expected, tempoFactor) : null
    setMarks(new Map())
    setRun('loading')
    markActive()
    try {
      const h = await startPlayAlong({
        originSec: first.startSec,
        notes: accompaniment,
        clicks,
        countInSec: options.countIn ? first.durationSec : 0,
        tempoPercent: atTempo,
      })
      runRef.current = {
        kind: 'play',
        stop: h.stop,
        startedAt: h.startedAt,
        originSec: first.startSec,
        endSec: last.startSec + last.durationSec,
        tempoFactor,
      }
      setStepIdx(firstStepAtBar(steps, startBar))
      setRun('running')
    } catch {
      setRun('idle')
    }
  }

  const finishPlay = (stoppedEarly: boolean) => {
    const r = runRef.current
    const grader = graderRef.current
    const L = latest.current
    stopRun()
    if (!r) return
    let s: Summary | null = null
    if (grader) {
      grader.advance(stoppedEarly ? (now ?? r.originSec) : r.endSec + 1)
      s = grader.summary()
      setMarks(new Map(grader.marks))
      for (const [bar, n] of Object.entries(s.mistakesByBar)) {
        for (let i = 0; i < n; i++) recordMistake(Number(bar))
      }
    }
    const clean = !!s && s.total > 0 && s.missed === 0 && s.wrong === 0
    if (!stoppedEarly) recordPass(clean, L.tempo, s?.accuracy)
    const next = tempoAfterPass(L.tempo, clean, L.options)
    if (!stoppedEarly && L.options.repeatLoop) {
      if (next !== L.tempo) setTempo(next)
      void startPlay(next)
      return
    }
    if (next !== L.tempo) setTempo(next)
    setSummary({
      summary: s ?? {
        total: 0, good: 0, early: 0, late: 0, missed: 0, wrong: 0,
        accuracy: 0, meanOffsetMs: 0, mistakesByBar: {},
      },
      tempo: L.tempo,
      nextTempo: next !== L.tempo ? next : null,
    })
  }

  // 60fps playhead while something is running.
  useEffect(() => {
    if (run !== 'running') return
    let raf = 0
    const tick = () => {
      const r = runRef.current
      if (!r) return
      const t = r.originSec + ((performance.now() - r.startedAt) / 1000) * r.tempoFactor
      if (t >= r.endSec) {
        if (r.kind === 'play') {
          finishPlay(false)
        } else {
          const span = r.span
          stopRun()
          if (span?.what === 'range' && latest.current.options.repeatLoop) {
            void startListen('range', latest.current.lo)
          }
        }
        return
      }
      setCountIn(t < r.originSec)
      setNow(Math.max(t, r.originSec))
      if (r.kind === 'play' && graderRef.current) {
        const missed = graderRef.current.advance(t)
        if (missed.length) setMarks(new Map(graderRef.current.marks))
      }
      setHighlightIdx(t < r.originSec ? -1 : stepAt(latest.current.steps, t))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // finishPlay / startListen read fresh state through refs
  }, [run, stopRun])

  const pauseRun = () => {
    const r = runRef.current
    if (!r?.pause || run !== 'running') return
    r.pause()
    r.pausedAt = performance.now()
    setRun('paused')
  }
  const resumeRun = () => {
    const r = runRef.current
    if (!r?.resume || run !== 'paused') return
    if (r.pausedAt != null) r.startedAt += performance.now() - r.pausedAt
    r.pausedAt = undefined
    r.resume()
    setRun('running')
  }

  // ——— Learn: accept steps from the keyboard ———
  const acceptStep = useCallback(
    (skipped: boolean) => {
      const L = latest.current
      const i = L.stepIdx
      const s = L.steps[i]
      if (!s) return
      markActive()
      if (skipped) passMistakes.current += 1
      if (L.options.otherHand && L.hands !== 'both') {
        const from = s[0]!.time
        const next = L.steps[i + 1]
        const to = next ? next[0]!.time : from + Math.max(...s.map((n) => n.duration))
        void playAccompaniment(accompanimentFor(L.others, from, to), L.tempo, from)
      }
      if (i + 1 < L.steps.length) {
        setStepIdx(i + 1)
        return
      }
      const clean = passMistakes.current === 0
      passMistakes.current = 0
      recordPass(clean, L.tempo)
      setPasses((p) => ({ total: p.total + 1, clean: p.clean + (clean ? 1 : 0), lastClean: clean }))
      if (L.options.repeatLoop) {
        setTempo(tempoAfterPass(L.tempo, clean, L.options))
        setStepIdx(0)
      } else {
        setStepIdx(L.steps.length)
      }
    },
    [recordPass],
  )

  useEffect(() => {
    if (!hasMidi) return
    const offChange = input.onChange(() => {
      const heldNow = input.getHeldMidiNotes()
      setHeld(heldNow)
      const L = latest.current
      latched.current = pruneMidiLatch(latched.current, heldNow)
      if (L.mode !== 'learn' || L.run !== 'idle') return
      const s = L.steps[L.stepIdx]
      if (!s || !heldNow.length) return
      if (!canAcceptMidiStep(heldNow, s, latched.current)) return
      latched.current = latchAfterMidiAccept(heldNow)
      acceptStep(false)
    })
    const offNote = input.onNote((e) => {
      markActive()
      if (!e.on) {
        setWrongHeld((prev) => {
          if (!prev.has(e.midi)) return prev
          const next = new Set(prev)
          next.delete(e.midi)
          return next
        })
        return
      }
      const L = latest.current
      const flagWrong = () =>
        setWrongHeld((prev) => new Set(prev).add(e.midi))
      if (L.mode === 'learn' && L.run === 'idle') {
        const s = L.steps[L.stepIdx]
        if (!s) return
        const t = s[0]!.time
        const nearby = L.others.filter((n) => Math.abs(n.time - t) < 1)
        if (isWrongNote(e.midi, s, nearby)) {
          passMistakes.current += 1
          recordMistake(s[0]!.measure)
          flagWrong()
        }
        return
      }
      const r = runRef.current
      if (L.mode === 'play' && r?.kind === 'play' && graderRef.current) {
        const t = r.originSec + ((e.time - r.startedAt) / 1000) * r.tempoFactor
        if (t < r.originSec - 0.3) return // count-in
        const res = graderRef.current.press(e.midi, t)
        setMarks(new Map(graderRef.current.marks))
        if (res.kind === 'wrong') flagWrong()
      }
    })
    return () => {
      offChange()
      offNote()
    }
  }, [input, hasMidi, acceptStep, recordMistake])

  // ——— Navigation ———
  const jumpTo = (bar: number) => {
    if (run !== 'idle') return
    setSummary(null)
    latched.current = new Set()
    passMistakes.current = 0
    setStepIdx(firstStepAtBar(steps, Math.min(hi, Math.max(lo, bar))))
  }

  const changeMode = (m: PracticeMode) => {
    stopRun()
    silencePiano()
    setSummary(null)
    setMarks(new Map())
    setMode(m)
  }

  const primary = () => {
    if (mode === 'learn') acceptStep(true)
    else if (mode === 'listen') void startListen('range')
    else void startPlay()
  }

  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  {
    onKeyRef.current = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return
      }
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false)
        else if (run !== 'idle' && mode === 'play') finishPlay(true)
        else if (run !== 'idle') stopRun()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (run === 'running' && mode === 'play') finishPlay(true)
        else if (run === 'running') pauseRun()
        else if (run === 'paused') resumeRun()
        else if (run === 'idle') primary()
        return
      }
      if (run !== 'idle') return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        jumpTo(cursorBar - 1)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        jumpTo(cursorBar + 1)
      }
    }
  }

  // ——— What the sheet and keyboard show ———
  const running = run === 'running' || run === 'paused'
  const activeNotes = useMemo<PieceNote[]>(
    () => (running ? (steps[highlightIdx] ?? []) : (step ?? [])),
    [running, steps, highlightIdx, step],
  )
  const displayBar = running && now !== null ? barAtTime(measures, now, cursorBar) : cursorBar
  const nowSec = running ? (now ?? undefined) : step?.[0]?.time

  const activeKeys = useMemo(
    () => activeNotes.map((n) => ({ midi: n.midi, hand: handOf(n) === 'right' ? ('right' as const) : ('left' as const) })),
    [activeNotes, handOf],
  )
  const heldMap = useMemo(() => {
    if (!hasMidi || !options.showMyKeys) return undefined
    return classifyHeld(held, mode === 'listen' ? [] : activeNotes, wrongHeld)
  }, [hasMidi, options.showMyKeys, held, mode, activeNotes, wrongHeld])

  const barsPerLine = barsPerSystem(dominantBarQuarters(measures))
  const nextTempo =
    options.speedUp && tempo < options.speedTarget
      ? Math.min(options.speedTarget, tempo + options.speedStep)
      : null

  const onMeasurePointer = (bar: number, shift: boolean) => {
    if (run !== 'idle') return
    if (shift) {
      const a = range && bar >= range.start ? range.start : cursorBar
      setRange({ start: Math.min(a, bar), end: Math.max(a, bar) })
      return
    }
    jumpTo(bar)
  }

  const status = (() => {
    if (!steps.length) {
      return hands === 'both'
        ? 'No notes in this range.'
        : `No ${hands === 'right' ? 'right' : 'left'}-hand notes in this range.`
    }
    if (mode === 'play') {
      if (countIn) return 'Count-in…'
      if (running) {
        const g = graderRef.current?.summary()
        return g && g.good + g.early + g.late + g.missed > 0
          ? `Playing · bar ${displayBar} · ${Math.round(g.accuracy * 100)}% so far`
          : `Playing · bar ${displayBar}`
      }
      return `Press Start (or Space) to play along from bar ${range ? lo : cursorBar}.`
    }
    if (mode === 'listen') {
      return running ? `Listening · bar ${displayBar}` : `Play from bar ${cursorBar}, or hear one bar or line.`
    }
    if (finished) {
      return passes.total
        ? `Range complete · ${passes.clean} of ${passes.total} passes clean`
        : 'Range complete'
    }
    const pass = passes.total ? ` · pass ${passes.total + 1}${passes.lastClean ? ' (last one clean)' : ''}` : ''
    const who = hasMidi
      ? activeNotes.length > 1
        ? `hold all ${activeNotes.length}`
        : 'your turn'
      : 'play it, then Skip'
    return `Bar ${cursorBar} · ${midiNames(activeNotes.map((n) => n.midi))} · ${who}${pass}`
  })()


  return (
    <div className="practice">
      <header className="practice-top">
        <button
          type="button"
          className="btn btn-ghost h-9"
          onClick={() => {
            stopRun()
            // Let the library see this session: finish the write first.
            void flushSession.current().finally(onExit)
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="mr-1">
            <path d="M9 2 4 7l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Pieces
        </button>
        <h1 className="practice-title">{title}</h1>
        <span className="practice-device" title={input.getStatus()}>
          <span className={`device-dot${keyboardOn ? ' device-dot--on' : ''}`} />
          {hasMidi ? input.getStatus() : 'No keyboard (self-report)'}
        </span>
        <button
          type="button"
          className={`btn h-9 ${drawerOpen ? 'btn-primary' : 'btn-secondary'}`}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((o) => !o)}
        >
          Practice options
        </button>
      </header>

      <TransportBar
        mode={mode}
        onMode={changeMode}
        run={run}
        onPlay={() => (run === 'paused' ? resumeRun() : mode === 'play' ? void startPlay() : void startListen('range'))}
        onPause={pauseRun}
        onStop={() => (mode === 'play' ? finishPlay(true) : stopRun())}
        onPreview={(what) => void startListen(what)}
        tempo={tempo}
        tempoTarget={nextTempo}
        onTempo={setTempo}
        hands={hands}
        onHands={setHands}
        range={range}
        onClearRange={() => setRange(null)}
      />

      <div className="practice-main">
        {(view === 'staff' || view === 'both') && (
          <StaffNotation
            notes={parsed.notes}
            measure={displayBar}
            activeNotes={activeNotes}
            nowSec={nowSec}
            secPerQuarter={parsed.secPerQuarter}
            measureCount={measureCount}
            selection={range}
            onMeasurePointer={onMeasurePointer}
            onMeasureScroll={(dir) => jumpTo(cursorBar + dir)}
            barsPerLine={barsPerLine}
            beatsPerBar={parsed.beatsPerBar}
            measures={measures}
            polarity={polarity}
            onSystemsChange={setSystems}
            dimStaff={hands === 'right' ? 'bass' : hands === 'left' ? 'treble' : null}
            noteMarks={mode === 'play' ? marks : undefined}
          />
        )}
        {(view === 'roll' || view === 'both') && (
          <PianoRoll notes={mine} nowSec={nowSec ?? 0} />
        )}
        <BarStrip
          count={measureCount}
          current={displayBar}
          range={range}
          trouble={troubleBars}
          systems={systems}
          disabled={run !== 'idle'}
          onJump={jumpTo}
          onRange={setRange}
        />
        {summary && (
          <RunSummary
            summary={summary.summary}
            tempo={summary.tempo}
            nextTempo={summary.nextTempo}
            graded={summary.summary.total > 0}
            onAgain={() => void startPlay()}
            onClose={() => setSummary(null)}
          />
        )}
        <PracticeDrawer
          open={drawerOpen}
          options={options}
          onOptions={setOptions}
          view={view}
          onView={setView}
          polarity={polarity}
          onPolarity={(p) => {
            setPolarity(p)
            saveSheetPolarity(p)
          }}
          oneHand={hands !== 'both'}
          hasMidi={hasMidi}
          onClose={() => setDrawerOpen(false)}
        />
      </div>

      <PianoBar activeKeys={activeKeys} held={heldMap} />

      <footer className="practice-status">
        <div className="practice-nav">
          <button type="button" className="btn btn-ghost h-8" disabled={run !== 'idle'} onClick={() => jumpTo(lo)} title="Back to the start of the range">
            Start
          </button>
          <button type="button" className="btn btn-ghost h-8" disabled={run !== 'idle' || cursorBar <= lo} onClick={() => jumpTo(cursorBar - 1)} title="Previous bar (←)">
            ‹ Bar
          </button>
          <button type="button" className="btn btn-ghost h-8" disabled={run !== 'idle' || cursorBar >= hi} onClick={() => jumpTo(cursorBar + 1)} title="Next bar (→)">
            Bar ›
          </button>
          {mode === 'learn' && (
            <button type="button" className="btn btn-ghost h-8" disabled={finished || !step} onClick={() => acceptStep(true)} title="Skip this step (Space)">
              Skip step
            </button>
          )}
        </div>
        <p className="practice-status-text">{status}</p>
      </footer>
    </div>
  )
}

/** MIDI mode with a device plugged in (status lists device names). */
function midiConnected(input: InputSource): boolean {
  return (
    input.id === 'midi' &&
    !/^(No MIDI|MIDI off|MIDI permission|Web MIDI)/.test(input.getStatus())
  )
}

/** Bar containing piece time t (the playhead, including through rests). */
function barAtTime(measures: ParsedPiece['measures'], t: number, fallback: number): number {
  let lo = 0
  let hi = measures.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (measures[mid]!.startSec <= t + 1e-6) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best >= 0 ? best + 1 : fallback
}
