import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseMidiArrayBuffer } from './parseMidi'
import type { StoredPiece } from './types'

interface KeysDB extends DBSchema {
  pieces: {
    key: string
    value: StoredPiece
  }
}

let dbPromise: Promise<IDBPDatabase<KeysDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KeysDB>('keys-pieces', 1, {
      upgrade(database) {
        database.createObjectStore('pieces', { keyPath: 'id' })
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
  await (await db()).delete('pieces', id)
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
