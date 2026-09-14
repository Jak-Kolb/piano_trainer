import { useEffect, useState, type ReactNode } from 'react'
import type { InputSource } from '../input'
import { parseMidiArrayBuffer } from '../pieces/parseMidi'
import { PieceControlsBar } from '../pieces/PieceControlsBar'
import { getPiece } from '../pieces/pieceStore'
import type { ParsedPiece, PieceControls, StoredPiece } from '../pieces/types'
import { ListenMode } from '../pieces/ListenMode'
import { VerifyMode } from '../pieces/VerifyMode'
import { WalkThroughMode } from '../pieces/WalkThroughMode'

type Mode = 'menu' | 'listen' | 'walk' | 'verify'

interface Props {
  pieceId: string
  input: InputSource
  onBack: () => void
}

export function PiecePage({ pieceId, input, onBack }: Props) {
  const [stored, setStored] = useState<StoredPiece | null>(null)
  const [parsed, setParsed] = useState<ParsedPiece | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('menu')
  const [controls, setControls] = useState<PieceControls>({
    tempoPercent: 100,
    loopStartMeasure: 1,
    loopEndMeasure: 1,
    hands: 'both',
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await getPiece(pieceId)
        if (!p) throw new Error('Piece not found')
        const parsedPiece = await parseMidiArrayBuffer(p.midiBytes)
        if (cancelled) return
        setStored(p)
        setParsed(parsedPiece)
        setControls((c) => ({
          ...c,
          loopEndMeasure: parsedPiece.measureCount,
        }))
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load piece')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pieceId])

  if (error) {
    return (
      <Shell onBack={onBack} title="Piece">
        <p className="font-ui text-felt">{error}</p>
      </Shell>
    )
  }

  if (!stored || !parsed) {
    return (
      <Shell onBack={onBack} title="Piece">
        <p className="font-ui text-dust">Loading…</p>
      </Shell>
    )
  }

  if (mode === 'walk') {
    return (
      <WalkThroughMode
        parsed={parsed}
        controls={controls}
        input={input}
        title={stored.name}
        onExit={() => setMode('menu')}
        onControls={setControls}
      />
    )
  }
  if (mode === 'verify') {
    return (
      <VerifyMode
        parsed={parsed}
        controls={controls}
        input={input}
        title={stored.name}
        onExit={() => setMode('menu')}
        onControls={setControls}
      />
    )
  }
  if (mode === 'listen') {
    return (
      <ListenMode
        parsed={parsed}
        controls={controls}
        title={stored.name}
        onExit={() => setMode('menu')}
        onControls={setControls}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-3 font-ui text-dust"
        >
          Library
        </button>
        <p className="truncate font-ui text-xs text-dust">{input.getStatus()}</p>
      </div>
      <h1 className="px-6 font-display text-4xl text-ivory">{stored.name}</h1>
      <PieceControlsBar
        controls={controls}
        measureCount={parsed.measureCount}
        hasTwoHands={parsed.hasTwoHands}
        onChange={setControls}
      />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-8">
        {(
          [
            ['listen', 'Listen', 'Hear the target MIDI'],
            ['walk', 'Walk-through', 'Piano roll · wait for correct notes'],
            ['verify', 'Verify', 'Timed run · review misses at the end'],
          ] as const
        ).map(([id, label, blurb]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className="min-h-20 bg-shadow px-5 py-4 text-left"
          >
            <span className="font-display text-2xl text-ivory">{label}</span>
            <span className="mt-1 block font-ui text-sm text-dust">{blurb}</span>
          </button>
        ))}
        {input.id !== 'midi' && (
          <p className="font-ui text-sm text-felt">
            Switch input to MIDI for Walk-through and Verify with your Kawai.
          </p>
        )}
      </div>
    </div>
  )
}

function Shell({
  onBack,
  title,
  children,
}: {
  onBack: () => void
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-ink">
      <button
        type="button"
        onClick={onBack}
        className="min-h-12 self-start px-4 py-3 font-ui text-dust"
      >
        Back
      </button>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="font-display text-3xl text-ivory">{title}</h1>
        {children}
      </div>
    </div>
  )
}
