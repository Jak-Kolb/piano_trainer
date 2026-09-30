import { useSyncExternalStore } from 'react'
import {
  bluetoothState,
  bluetoothSupported,
  connectBluetoothPiano,
  disconnectBluetoothPiano,
  onBluetoothChange,
} from '../input/bluetoothMidi'

/** Connect a piano over Bluetooth MIDI (shown with the MIDI input mode). */
export function BluetoothPiano() {
  const bt = useSyncExternalStore(onBluetoothChange, bluetoothState)
  if (!bluetoothSupported()) return null
  const connect = () => void connectBluetoothPiano()

  return (
    <div className="bt-row">
      <div className="bt-text">
        <p className="bt-title">
          {bt.status === 'connected'
            ? `${bt.name} connected over Bluetooth`
            : bt.status === 'connecting'
              ? `Connecting to ${bt.name ?? 'your piano'}…`
              : bt.status === 'lost'
                ? `${bt.name ?? 'Bluetooth piano'} disconnected — reconnecting…`
                : 'Bluetooth piano'}
        </p>
        <p className="bt-hint">
          {bt.error ??
            (bt.status === 'connected'
              ? 'Your keys, and sound through your piano, go over Bluetooth.'
              : 'No cable: turn on Bluetooth MIDI at the piano, then connect.')}
        </p>
      </div>
      {bt.status === 'connected' ? (
        <button type="button" className="btn btn-ghost h-9" onClick={disconnectBluetoothPiano}>
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-secondary h-9"
          disabled={bt.status === 'connecting'}
          onClick={connect}
        >
          {bt.name && bt.status !== 'idle' ? 'Choose piano' : 'Connect'}
        </button>
      )}
    </div>
  )
}
