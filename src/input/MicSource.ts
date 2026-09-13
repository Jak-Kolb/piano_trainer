import type { InputSource } from './types'
import { hzToMidi, midiToPitchClass, yinPitch } from './yin'

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** Absolute floor — below this is always silence. */
const MIN_RMS = 0.035
/** Clarity required from YIN (0–1). */
const MIN_CLARITY = 0.82
/** Same pitch must win this many frames in a row before we report it. */
const ATTACK_FRAMES = 5
/** Frames below gate before we clear the held note. */
const RELEASE_FRAMES = 10

export function createMicSource(): InputSource {
  const listeners = new Set<() => void>()
  let ctx: AudioContext | null = null
  let stream: MediaStream | null = null
  let node: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let raf = 0
  let held: number[] = []
  let status = 'Mic off — will ask for permission'
  let disposed = false
  let noiseFloor = 0.008
  let candidatePc: number | null = null
  let candidateCount = 0
  let quietCount = 0

  const notify = () => {
    for (const l of listeners) l()
  }

  const clearHeld = () => {
    if (held.length) {
      held = []
      status = 'Listening…'
      notify()
    } else if (!status.startsWith('Listening')) {
      status = 'Listening…'
      notify()
    }
  }

  const stopTracks = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    source?.disconnect()
    source = null
    node?.disconnect()
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
    supportsAutomaticGrade: () => true,
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
        analyser.fftSize = 4096
        source.connect(analyser)
        node = analyser
        status = 'Listening…'
        notify()

        const buf = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (disposed || !ctx || !node) return
          node.getFloatTimeDomainData(buf)

          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!
          const rms = Math.sqrt(sum / buf.length)

          // Track noise floor only when quiet
          if (rms < MIN_RMS) {
            noiseFloor = noiseFloor * 0.95 + rms * 0.05
          }
          const gate = Math.max(MIN_RMS, noiseFloor * 5)

          if (rms < gate) {
            quietCount++
            candidatePc = null
            candidateCount = 0
            if (quietCount >= RELEASE_FRAMES) clearHeld()
            raf = requestAnimationFrame(tick)
            return
          }

          quietCount = 0
          const result = yinPitch(buf, ctx.sampleRate, 0.12)
          if (!result || result.clarity < MIN_CLARITY) {
            candidatePc = null
            candidateCount = 0
            // Loud but no clear pitch (chords / noise) — stay quiet
            if (held.length) {
              // keep last note briefly; release handled by quiet path
            } else {
              status = 'Listening…'
            }
            raf = requestAnimationFrame(tick)
            return
          }

          const pc = midiToPitchClass(hzToMidi(result.hz))
          if (candidatePc === pc) candidateCount++
          else {
            candidatePc = pc
            candidateCount = 1
          }

          if (candidateCount >= ATTACK_FRAMES) {
            const changed = held.length !== 1 || held[0] !== pc
            held = [pc]
            status = `Hearing ${NOTE_NAMES[pc]}`
            if (changed) notify()
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
