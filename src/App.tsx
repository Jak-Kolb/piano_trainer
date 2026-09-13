import { useEffect, useState } from 'react'
import { ComingSoon } from './components/ComingSoon'
import { ModeSelector } from './components/ModeSelector'
import { ModulePicker } from './components/ModulePicker'
import { SafariNotice } from './components/SafariNotice'
import { TriadRecall } from './drills/TriadRecall'
import {
  createInputSource,
  loadSavedInputMode,
  saveInputMode,
  type InputModeId,
  type InputSource,
} from './input'
import { MODULES, type ModuleId } from './modules'

export default function App() {
  const [mode, setMode] = useState<InputModeId>(() => loadSavedInputMode())
  const [input, setInput] = useState<InputSource | null>(null)
  const [status, setStatus] = useState('…')
  const [view, setView] = useState<'home' | ModuleId>('home')
  const [startError, setStartError] = useState<string | null>(null)

  // Recreate input when mode changes
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

  if (view === 'triad-recall' && input) {
    return (
      <TriadRecall
        input={input}
        micFallsBackToSelfReport={mode === 'mic'}
        onExit={() => setView('home')}
      />
    )
  }

  if (view !== 'home') {
    const mod = MODULES.find((m) => m.id === view)
    return (
      <ComingSoon
        title={mod?.title ?? 'Module'}
        onBack={() => setView('home')}
      />
    )
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
