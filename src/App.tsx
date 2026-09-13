import { useMemo, useState } from 'react'
import { SafariNotice } from './components/SafariNotice'
import { TriadRecall } from './drills/TriadRecall'
import { createSelfReportSource } from './input'

type View = 'home' | 'triad-recall'

export default function App() {
  const [view, setView] = useState<View>('home')
  const input = useMemo(() => createSelfReportSource(), [])

  if (view === 'triad-recall') {
    return <TriadRecall input={input} onExit={() => setView('home')} />
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <SafariNotice />
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <div className="text-center">
          <h1 className="font-display text-6xl font-bold text-ivory md:text-7xl">
            Keys
          </h1>
          <p className="mt-3 font-ui text-dust">Piano practice on the stand</p>
        </div>
        <button
          type="button"
          onClick={() => setView('triad-recall')}
          className="min-h-16 min-w-[16rem] bg-brass px-8 font-ui text-xl font-medium text-ink"
        >
          Triad recall
        </button>
        <p className="max-w-sm text-center font-ui text-sm text-dust">
          Input: {input.label}. MIDI lands in Stage 2 — Kawai KDP110 via USB.
        </p>
      </main>
    </div>
  )
}
