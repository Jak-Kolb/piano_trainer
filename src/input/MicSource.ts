import type { InputSource } from './types'
import { hzToMidi, midiToPitchClass, yinPitch } from './yin'

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export function createMicSource(): InputSource {
  const listeners = new Set<() => void>()
  let ctx: AudioContext | null = null
  let stream: MediaStream | null = null
  let node: ScriptProcessorNode | AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let raf = 0
  let held: number[] = []
  let status = 'Mic off — will ask for permission'
  let disposed = false

  const notify = () => {
    for (const l of listeners) l()
  }

  const stopTracks = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    source?.disconnect()
    source = null
    if (node && 'disconnect' in node) node.disconnect()
    node = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    void ctx?.close()
    ctx = null
  }

  return {
    id: 'mic',
    label: 'Microphone',
    getStatus: () => status,
    getHeldPitchClasses: () => held,
    supportsAutomaticGrade: () => true, // drill decides if monophonic
    async start() {
      if (disposed) return
      if (stream) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
        ctx = new AudioContext()
        await ctx.resume()
        source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        node = analyser
        status = 'Listening…'
        notify()

        const buf = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (disposed || !ctx) return
          analyser.getFloatTimeDomainData(buf)
          // RMS gate
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!
          const rms = Math.sqrt(sum / buf.length)
          if (rms < 0.01) {
            if (held.length) {
              held = []
              status = 'Listening…'
              notify()
            }
          } else {
            const hz = yinPitch(buf, ctx.sampleRate)
            if (hz) {
              const pc = midiToPitchClass(hzToMidi(hz))
              const next = [pc]
              const changed = held.length !== 1 || held[0] !== pc
              held = next
              status = `Hearing ${NOTE_NAMES[pc]}`
              if (changed) notify()
            }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        status =
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Mic permission denied'
            : 'Mic unavailable'
        held = []
        notify()
        throw e
      }
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
      stopTracks()
    },
  }
}
