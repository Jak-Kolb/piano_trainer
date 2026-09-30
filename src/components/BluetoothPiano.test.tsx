// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { disconnectBluetoothPiano } from '../input/bluetoothMidi'
import { ModeSelector } from './ModeSelector'

afterEach(() => {
  disconnectBluetoothPiano()
  vi.unstubAllGlobals()
})

it('connects a Bluetooth piano from the MIDI input mode, and disconnects it', async () => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  const io = Object.assign(new EventTarget(), {
    readValue: async () => new DataView(new ArrayBuffer(0)),
    startNotifications: async () => io,
    writeValue: async () => {},
  })
  const gatt = {
    connected: false,
    connect: async () => gatt,
    disconnect() {},
    getPrimaryService: async () => ({ getCharacteristic: async () => io }),
  }
  const device = Object.assign(new EventTarget(), { id: 'kdp', name: 'KDP110', gatt })
  vi.stubGlobal('navigator', {
    ...navigator,
    requestMIDIAccess: async () => ({}),
    bluetooth: { requestDevice: async () => device },
  })

  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => root.render(<ModeSelector mode="midi" status="" onChange={() => {}} />))
  const button = (label: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === label)!

  expect(el.textContent).toContain('Bluetooth piano')
  await act(async () => button('Connect').click())
  expect(el.textContent).toContain('KDP110 connected over Bluetooth')
  await act(async () => button('Disconnect').click())
  expect(el.textContent).toContain('Bluetooth piano')
  expect(button('Connect')).toBeTruthy()

  // Not offered for self-report
  await act(async () => root.render(<ModeSelector mode="self-report" status="" onChange={() => {}} />))
  expect(el.textContent).not.toContain('Bluetooth piano')
  await act(async () => root.unmount())
  el.remove()
})
