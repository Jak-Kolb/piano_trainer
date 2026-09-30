import { describe, expect, it } from 'vitest'
import { bleMidiPackets, newParseState, parseBleMidi } from './bleMidiPacket'

const p = (...bytes: number[]) => Uint8Array.from(bytes)

describe('parseBleMidi', () => {
  it('reads a note on after the header and timestamp', () => {
    expect(parseBleMidi(p(0x80, 0x81, 0x90, 60, 100))).toEqual([[0x90, 60, 100]])
  })

  it('reads several messages, each with its timestamp', () => {
    expect(parseBleMidi(p(0x80, 0x81, 0x90, 60, 100, 0x82, 0x80, 64, 0, 0x83, 0xb0, 64, 127))).toEqual([
      [0x90, 60, 100],
      [0x80, 64, 0],
      [0xb0, 64, 127],
    ])
  })

  it('handles running status with and without a timestamp', () => {
    // C on, then E on (no timestamp), then G on (new timestamp, no status)
    expect(parseBleMidi(p(0x80, 0x81, 0x90, 60, 90, 64, 80, 0x85, 67, 70))).toEqual([
      [0x90, 60, 90],
      [0x90, 64, 80],
      [0x90, 67, 70],
    ])
  })

  it('keeps running status into the next packet', () => {
    const state = newParseState()
    parseBleMidi(p(0x80, 0x81, 0x90, 60, 90), state)
    expect(parseBleMidi(p(0x80, 0x81, 60, 0), state)).toEqual([[0x90, 60, 0]])
  })

  it('reads one-data-byte messages and real-time bytes', () => {
    expect(parseBleMidi(p(0x80, 0x81, 0xc0, 5, 0x81, 0xfe, 0x81, 0x90, 62, 50))).toEqual([
      [0xc0, 5],
      [0xfe],
      [0x90, 62, 50],
    ])
  })

  it('skips system exclusive, even across packets', () => {
    const state = newParseState()
    expect(parseBleMidi(p(0x80, 0x81, 0xf0, 0x40, 0x10, 0x20), state)).toEqual([])
    expect(parseBleMidi(p(0x80, 0x01, 0x02, 0x81, 0xf7, 0x82, 0x90, 60, 1), state)).toEqual([[0x90, 60, 1]])
  })

  it('ignores packets without a valid header', () => {
    expect(parseBleMidi(p(0x90, 60, 100))).toEqual([])
    expect(parseBleMidi(p(0x80))).toEqual([])
  })
})

describe('bleMidiPackets', () => {
  it('writes a header, then a timestamp before each message', () => {
    // 1000 ms = 0b0000111_1101000 → header 0x80|7, timestamp 0x80|0x68
    expect(bleMidiPackets([[0x90, 60, 100], [0x90, 64, 90]], 1000)).toEqual([
      p(0x87, 0xe8, 0x90, 60, 100, 0xe8, 0x90, 64, 90),
    ])
  })

  it('splits into packets that fit the MTU, and round-trips through the parser', () => {
    const notes = [60, 62, 64, 65, 67, 69].map((m) => [0x90, m, 80])
    const packets = bleMidiPackets(notes, 5, 20)
    expect(packets.every((x) => x.length <= 20)).toBe(true)
    expect(packets.length).toBe(2)
    const state = newParseState()
    expect(packets.flatMap((x) => parseBleMidi(x, state))).toEqual(notes)
  })
})
