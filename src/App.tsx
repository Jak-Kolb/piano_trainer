import { useEffect, useState } from 'react'
import { ModeSelector } from './components/ModeSelector'
import { ModulePicker } from './components/ModulePicker'
import { SafariNotice } from './components/SafariNotice'
import { InversionDrill } from './drills/InversionDrill'
import { LeftHandDrill } from './drills/LeftHandDrill'
import { ProgressView } from './drills/ProgressView'
import { RhythmDrill } from './drills/RhythmDrill'
import { ScaleDrill } from './drills/ScaleDrill'
import { SessionRunner } from './drills/SessionRunner'
import { SightReadingDrill } from './drills/SightReadingDrill'
import { SlashChordDrill } from './drills/SlashChordDrill'
import { TriadRecall } from './drills/TriadRecall'
import {
  createInputSource,
  loadSavedInputMode,
  saveInputMode,
  type InputModeId,
  type InputSource,
} from './input'
import type { ModuleId } from './modules'

export default function App() {
  const [mode, setMode] = useState<InputModeId>(() => loadSavedInputMode())
  const [input, setInput] = useState<InputSource | null>(null)
  const [status, setStatus] = useState('…')
  const [view, setView] = useState<'home' | ModuleId>('home')
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    const src = createInputSource(mode)
    setInput(src)
    setStatus(src.getStatus())
    setStartError(null)
    const unsub = src.onChange(() => setStatus(src.getStatus()))
    void src.start().catch((e: unknown) => {
      setStartError(e instanceof Error ? e.message : 'Could not start input')
      setStatus(src.getStatus())
    })
    return () => {
      unsub()
      src.dispose()
    }
  }, [mode])

  const selectMode = (next: InputModeId) => {
    saveInputMode(next)
    setMode(next)
  }

  const back = () => setView('home')

  if (input && view !== 'home') {
    switch (view) {
      case 'triad-recall':
        return (
          <TriadRecall
            input={input}
            micFallsBackToSelfReport={mode === 'mic'}
            onExit={back}
          />
        )
      case 'inversions':
        return <InversionDrill input={input} onExit={back} />
      case 'slash-chords':
        return <SlashChordDrill input={input} onExit={back} />
      case 'scales':
        return <ScaleDrill input={input} onExit={back} kind="scale" />
      case 'arpeggios':
        return <ScaleDrill input={input} onExit={back} kind="arpeggio" />
      case 'left-hand':
        return <LeftHandDrill input={input} onExit={back} />
      case 'sight-reading':
        return <SightReadingDrill input={input} onExit={back} />
      case 'rhythm':
        return <RhythmDrill input={input} onExit={back} />
      case 'session':
        return <SessionRunner input={input} onExit={back} />
      case 'session-reading':
        return <SessionRunner input={input} onExit={back} readingOnly />
      case 'progress':
        return <ProgressView onExit={back} />
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <SafariNotice />
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-10">
        <div className="text-center">
          <h1 className="font-display text-6xl font-bold text-ivory">Keys</h1>
          <p className="mt-3 font-ui text-dust">Pick a module · set your input</p>
        </div>

        <ModeSelector mode={mode} status={status} onChange={selectMode} />
        {startError && (
          <p className="font-ui text-sm text-felt">{startError}</p>
        )}

        <ModulePicker onSelect={(id) => setView(id)} />
      </main>
    </div>
  )
}
