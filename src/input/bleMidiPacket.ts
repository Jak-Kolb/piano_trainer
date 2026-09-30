/**
 * BLE-MIDI packets (the MIDI over Bluetooth Low Energy spec): a header byte,
 * then MIDI messages, each after a timestamp byte. Pianos use running status
 * (data bytes that reuse the last status byte), and system exclusive can run
 * across packets. Timestamps are dropped on the way in: the time a packet
 * arrives is what the app uses.
 */

/** What carries over from one packet to the next. */
export interface BleParseState {
  /** Last channel status byte, for running status. */
  status: number
  /** Inside a system exclusive message (skipped). */
  sysex: boolean
}

export const newParseState = (): BleParseState => ({ status: 0, sysex: false })

/** Data bytes after a status byte (0 for real-time and unknown). */
function dataLength(status: number): number {
  if (status < 0xc0) return 2 // note off/on, poly pressure, control change
  if (status < 0xe0) return 1 // program change, channel pressure
  if (status < 0xf0) return 2 // pitch bend
  if (status === 0xf1 || status === 0xf3) return 1
  if (status === 0xf2) return 2
  return 0
}

const isData = (b: number | undefined): b is number => b !== undefined && b < 0x80

/** The MIDI messages in one packet, in order. */
export function parseBleMidi(packet: Uint8Array, state: BleParseState = newParseState()): number[][] {
  const out: number[][] = []
  // Header: 10xx xxxx (the timestamp's high bits).
  if (packet.length < 2 || (packet[0]! & 0xc0) !== 0x80) return out
  let i = 1
  const take = (status: number) => {
    const n = dataLength(status)
    const data: number[] = []
    while (data.length < n && isData(packet[i])) data.push(packet[i++]!)
    if (data.length === n) out.push([status, ...data])
  }
  while (i < packet.length) {
    const b = packet[i]!
    if (state.sysex) {
      if (isData(b)) {
        i++
        continue
      }
      // A timestamp, then the end of the sysex (or a real-time byte inside it).
      const next = packet[i + 1]
      if (next === 0xf7) state.sysex = false
      else if (next !== undefined && next >= 0xf8) out.push([next])
      i += 2
      continue
    }
    if (isData(b)) {
      // More data after a complete message: running status, same timestamp.
      if (state.status) take(state.status)
      else i++
      continue
    }
    // A timestamp byte, then a status byte or running-status data.
    i++
    const s = packet[i]
    if (s === undefined) break
    if (isData(s)) {
      if (state.status) take(state.status)
      else i++
      continue
    }
    i++
    if (s === 0xf0) state.sysex = true
    else if (s >= 0xf8) out.push([s])
    else {
      state.status = s < 0xf0 ? s : 0 // system common messages end running status
      take(s)
    }
  }
  return out
}

/**
 * Messages as BLE-MIDI packets, as few as fit in `mtu` bytes each (20 is the
 * Bluetooth default). All carry the same timestamp: `timeMs` on any clock.
 */
export function bleMidiPackets(messages: number[][], timeMs: number, mtu = 20): Uint8Array<ArrayBuffer>[] {
  const ts = Math.floor(timeMs) & 0x1fff
  const header = 0x80 | (ts >> 7)
  const stamp = 0x80 | (ts & 0x7f)
  const packets: Uint8Array<ArrayBuffer>[] = []
  let cur = [header]
  for (const m of messages) {
    if (cur.length > 1 && cur.length + 1 + m.length > mtu) {
      packets.push(Uint8Array.from(cur))
      cur = [header]
    }
    cur.push(stamp, ...m)
  }
  if (cur.length > 1) packets.push(Uint8Array.from(cur))
  return packets
}
