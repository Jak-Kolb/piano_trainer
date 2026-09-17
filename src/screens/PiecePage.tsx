import { useEffect, useState, type ReactNode } from 'react'
import type { InputSource } from '../input'
import { parseMidiArrayBuffer } from '../pieces/parseMidi'
import { getPiece } from '../pieces/pieceStore'
import type { ParsedPiece, PieceControls, StoredPiece } from '../pieces/types'
import { WalkThroughMode } from '../pieces/WalkThroughMode'

interface Props {
  pieceId: string
  input: InputSource
  onBack: () => void
}

export function PiecePage({ pieceId, input, onBack }: Props) {
  const [stored, setStored] = useState<StoredPiece | null>(null)
  const [parsed, setParsed] = useState<ParsedPiece | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <WalkThroughMode
      parsed={parsed}
      controls={controls}
      input={input}
      title={stored.name}
      onExit={onBack}
      onControls={setControls}
    />
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
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        <span />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="page-title page-title--section">{title}</h1>
        {children}
      </div>
    </div>
  )
}
