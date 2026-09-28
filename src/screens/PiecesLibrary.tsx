import { useEffect, useMemo, useRef, useState } from 'react'
import { importMidiFile, listPieces, deletePiece, listSessions } from '../pieces/pieceStore'
import {
  formatAgo,
  formatDuration,
  summarize,
  type PieceSummary,
  type PracticeSession,
} from '../pieces/practice/stats'
import type { StoredPiece } from '../pieces/types'

interface Props {
  onBack: () => void
  onOpen: (id: string) => void
  midiStatus: string
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))
}

function PieceStats({ summary }: { summary: PieceSummary }) {
  if (!summary.sessions) return <span className="piece-row-meta">Not practised yet</span>
  const parts = [
    `Practised ${formatAgo(summary.lastPracticed!)}`,
    formatDuration(summary.totalSeconds),
  ]
  if (summary.cleanPasses) {
    parts.push(`${summary.cleanPasses} clean ${summary.cleanPasses === 1 ? 'run' : 'runs'}`)
  }
  if (summary.bestTempo) parts.push(`best ${summary.bestTempo}% tempo`)
  return (
    <>
      <span className="piece-row-meta">{parts.join(' · ')}</span>
      {summary.firstCleanAt && summary.firstPracticed && (
        <span className="piece-row-milestone">
          First clean play-through{' '}
          {new Date(summary.firstCleanAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' — '}
          {daysBetween(summary.firstPracticed, summary.firstCleanAt)} days after you started
        </span>
      )}
    </>
  )
}

export function PiecesLibrary({ onBack, onOpen, midiStatus }: Props) {
  const [pieces, setPieces] = useState<StoredPiece[]>([])
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    const [p, s] = await Promise.all([listPieces(), listSessions().catch(() => [])])
    setPieces(p)
    setSessions(s)
  }

  useEffect(() => {
    void reload()
  }, [])

  const summaries = useMemo(() => {
    const byPiece = new Map<string, PracticeSession[]>()
    for (const s of sessions) {
      const list = byPiece.get(s.pieceId) ?? []
      list.push(s)
      byPiece.set(s.pieceId, list)
    }
    return new Map(pieces.map((p) => [p.id, summarize(byPiece.get(p.id) ?? [])]))
  }, [pieces, sessions])

  // Recently practised first, then newest imports.
  const ordered = useMemo(
    () =>
      [...pieces].sort((a, b) => {
        const la = summaries.get(a.id)?.lastPracticed ?? ''
        const lb = summaries.get(b.id)?.lastPracticed ?? ''
        return lb.localeCompare(la) || b.createdAt.localeCompare(a.createdAt)
      }),
    [pieces, summaries],
  )

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const piece = await importMidiFile(file)
      await reload()
      onOpen(piece.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import MIDI')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="topbar">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Home
        </button>
        <p className="topbar-status">{midiStatus}</p>
      </div>
      <main className="page-main page-main--pieces">
        <div className="library-head">
          <h1 className="page-title page-title--section">Pieces</h1>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="btn btn-primary h-10 px-5"
          >
            {busy ? 'Importing…' : 'Import MIDI'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".mid,.midi,audio/midi"
          className="hidden"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        {error && <p className="font-ui text-sm text-felt">{error}</p>}
        {ordered.length === 0 ? (
          <p className="library-empty">
            No pieces yet. Import a .mid file to see its sheet music and practise it with your
            keyboard.
          </p>
        ) : (
          <ul className="library-list">
            {ordered.map((p) => {
              const summary = summaries.get(p.id)!
              return (
                <li key={p.id} className="piece-row">
                  <button type="button" onClick={() => onOpen(p.id)} className="piece-row-open">
                    <span className="piece-row-name">{p.name}</span>
                    <span className="piece-row-facts">
                      {p.measureCount} bars · {Math.floor(p.durationSec / 60)}:
                      {String(Math.round(p.durationSec % 60)).padStart(2, '0')}
                    </span>
                    <PieceStats summary={summary} />
                  </button>
                  {confirmDelete === p.id ? (
                    <span className="piece-row-confirm">
                      <button
                        type="button"
                        className="btn btn-danger h-8 px-3 text-xs"
                        onClick={() => {
                          setConfirmDelete(null)
                          void deletePiece(p.id).then(reload)
                        }}
                      >
                        Delete piece and history
                      </button>
                      <button type="button" className="btn btn-ghost h-8 text-xs" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost h-8 text-xs piece-row-delete"
                      onClick={() => setConfirmDelete(p.id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
