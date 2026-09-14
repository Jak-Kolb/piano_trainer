import type { MicSettings } from '../settings/micSettings'
import { DEFAULT_MIC_SETTINGS } from '../settings/micSettings'
import type { InputSource } from './types'
import { hzToMidi, midiToPitchClass, yinPitch } from './yin'

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export function createMicSource(
  settings: MicSettings = DEFAULT_MIC_SETTINGS,
): InputSource {
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
  let lastRms = 0
  let lastGate = 0
  let lastNote: string | null = null

  const notify = () => {
    for (const l of listeners) l()
  }

  const clearHeld = () => {
    lastNote = null
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
    getHeldMidiNotes: () => [],
    getMeter: () => ({
      rms: lastRms,
      gate: lastGate,
      note: lastNote,
      status,
    }),
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
          lastRms = rms

          if (rms < settings.minRms) {
            noiseFloor = noiseFloor * 0.95 + rms * 0.05
          }
          const gate = Math.max(
            settings.minRms,
            noiseFloor * settings.noiseGateMult,
          )
          lastGate = gate

          if (rms < gate) {
            quietCount++
            candidatePc = null
            candidateCount = 0
            if (quietCount >= settings.releaseFrames) clearHeld()
            raf = requestAnimationFrame(tick)
            return
          }

          quietCount = 0
          const result = yinPitch(buf, ctx.sampleRate, settings.yinThreshold)
          if (!result || result.clarity < settings.minClarity) {
            candidatePc = null
            candidateCount = 0
            if (!held.length) status = 'Listening…'
            raf = requestAnimationFrame(tick)
            return
          }

          const pc = midiToPitchClass(hzToMidi(result.hz))
          if (candidatePc === pc) candidateCount++
          else {
            candidatePc = pc
            candidateCount = 1
          }

          if (candidateCount >= settings.attackFrames) {
            const changed = held.length !== 1 || held[0] !== pc
            held = [pc]
            lastNote = NOTE_NAMES[pc] ?? null
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
