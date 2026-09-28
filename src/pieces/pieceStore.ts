import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseMidiArrayBuffer } from './parseMidi'
import type { PieceState } from './practice/options'
import type { PracticeSession } from './practice/stats'
import type { StoredPiece } from './types'

interface KeysDB extends DBSchema {
  pieces: {
    key: string
    value: StoredPiece
  }
  /** Per-piece settings (tempo, hands, range, switches). */
  pieceState: {
    key: string
    value: PieceState
  }
  /** Practice history. */
  sessions: {
    key: number
    value: PracticeSession
    indexes: { byPiece: string }
  }
}

let dbPromise: Promise<IDBPDatabase<KeysDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KeysDB>('keys-pieces', 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('pieces', { keyPath: 'id' })
        }
        if (oldVersion < 2) {
          database.createObjectStore('pieceState', { keyPath: 'pieceId' })
          const sessions = database.createObjectStore('sessions', {
            keyPath: 'id',
            autoIncrement: true,
          })
          sessions.createIndex('byPiece', 'pieceId')
        }
      },
    })
  }
  return dbPromise
}

export async function listPieces(): Promise<StoredPiece[]> {
  const all = await (await db()).getAll('pieces')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPiece(id: string): Promise<StoredPiece | undefined> {
  return (await db()).get('pieces', id)
}

export async function deletePiece(id: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['pieces', 'pieceState', 'sessions'], 'readwrite')
  await tx.objectStore('pieces').delete(id)
  await tx.objectStore('pieceState').delete(id)
  const byPiece = tx.objectStore('sessions').index('byPiece')
  for (let c = await byPiece.openCursor(id); c; c = await c.continue()) {
    await c.delete()
  }
  await tx.done
}

export async function importMidiFile(file: File): Promise<StoredPiece> {
  const midiBytes = await file.arrayBuffer()
  const parsed = await parseMidiArrayBuffer(midiBytes)
  const name = file.name.replace(/\.midi?$/i, '') || 'Untitled'
  const piece: StoredPiece = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    midiBytes,
    durationSec: parsed.durationSec,
    noteCount: parsed.notes.length,
    measureCount: parsed.measureCount,
    hasTwoHands: parsed.hasTwoHands,
  }
  await (await db()).put('pieces', piece)
  return piece
}

export async function getPieceState(pieceId: string): Promise<PieceState | undefined> {
  return (await db()).get('pieceState', pieceId)
}

export async function savePieceState(state: PieceState): Promise<void> {
  await (await db()).put('pieceState', state)
}

/** Sessions for one piece, or every piece when omitted. */
export async function listSessions(pieceId?: string): Promise<PracticeSession[]> {
  const d = await db()
  return pieceId
    ? d.getAllFromIndex('sessions', 'byPiece', pieceId)
    : d.getAll('sessions')
}

/** Insert or update a session; returns its id. */
export async function saveSession(session: PracticeSession): Promise<number> {
  return (await db()).put('sessions', session)
}
