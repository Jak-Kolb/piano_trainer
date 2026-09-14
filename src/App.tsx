import { useEffect, useState } from 'react'
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
import { HomeHub } from './screens/HomeHub'
import { PiecePage } from './screens/PiecePage'
import { PiecesLibrary } from './screens/PiecesLibrary'
import { SettingsScreen } from './screens/SettingsScreen'
import { SkillsScreen } from './screens/SkillsScreen'
import {
  loadMicSettings,
  saveMicSettings,
  type MicSettings,
} from './settings/micSettings'

type Nav =
  | { screen: 'home' }
  | { screen: 'skills' }
  | { screen: 'pieces' }
  | { screen: 'piece'; id: string }
  | { screen: 'drill'; id: ModuleId }
  | { screen: 'settings' }

export default function App() {
  const [mode, setMode] = useState<InputModeId>(() => loadSavedInputMode())
  const [input, setInput] = useState<InputSource | null>(null)
  const [status, setStatus] = useState('…')
  const [startError, setStartError] = useState<string | null>(null)
  const [nav, setNav] = useState<Nav>({ screen: 'home' })
  const [micSettings, setMicSettings] = useState<MicSettings>(() =>
    loadMicSettings(),
  )
  const [micEpoch, setMicEpoch] = useState(0)

  useEffect(() => {
    const src = createInputSource(mode, micSettings)
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
  }, [mode, micSettings, micEpoch])

  const selectMode = (next: InputModeId) => {
    saveInputMode(next)
    setMode(next)
  }

  if (!input) {
    return <div className="flex h-full items-center justify-center bg-ink font-ui text-dust">Loading…</div>
  }

  if (nav.screen === 'drill') {
    const back = () => setNav({ screen: 'skills' })
    switch (nav.id) {
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

  if (nav.screen === 'piece') {
    return (
      <PiecePage
        pieceId={nav.id}
        input={input}
        onBack={() => setNav({ screen: 'pieces' })}
      />
    )
  }

  if (nav.screen === 'skills') {
    return (
      <SkillsScreen
        midiStatus={status}
        onBack={() => setNav({ screen: 'home' })}
        onSelect={(id) => setNav({ screen: 'drill', id })}
      />
    )
  }

  if (nav.screen === 'pieces') {
    return (
      <PiecesLibrary
        midiStatus={status}
        onBack={() => setNav({ screen: 'home' })}
        onOpen={(id) => setNav({ screen: 'piece', id })}
      />
    )
  }

  if (nav.screen === 'settings') {
    return (
      <SettingsScreen
        initial={micSettings}
        onBack={() => setNav({ screen: 'home' })}
        onSave={(next) => {
          saveMicSettings(next)
          setMicSettings(next)
          setMicEpoch((e) => e + 1)
          setNav({ screen: 'home' })
        }}
      />
    )
  }

  return (
    <HomeHub
      mode={mode}
      status={status}
      startError={startError}
      onMode={selectMode}
      onSkills={() => setNav({ screen: 'skills' })}
      onPieces={() => setNav({ screen: 'pieces' })}
      onSettings={() => setNav({ screen: 'settings' })}
    />
  )
}

