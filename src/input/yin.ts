/** YIN pitch detector (monophonic). */

export interface YinResult {
  hz: number
  /** 0–1, higher = clearer pitch (1 - yin value at tau). */
  clarity: number
}

export function yinPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.15,
): YinResult | null {
  const size = buffer.length
  if (size < 64) return null

  const half = Math.floor(size / 2)
  const yinBuffer = new Float32Array(half)

  for (let tau = 1; tau < half; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const delta = buffer[i]! - buffer[i + tau]!
      sum += delta * delta
    }
    yinBuffer[tau] = sum
  }

  yinBuffer[0] = 1
  let runningSum = 0
  for (let tau = 1; tau < half; tau++) {
    runningSum += yinBuffer[tau]!
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau]! * tau) / runningSum
  }

  let tauEstimate = -1
  for (let tau = 2; tau < half; tau++) {
    if (yinBuffer[tau]! < threshold) {
      while (tau + 1 < half && yinBuffer[tau + 1]! < yinBuffer[tau]!) tau++
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === -1) return null

  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1
  const x2 = tauEstimate + 1 < half ? tauEstimate + 1 : tauEstimate
  let betterTau: number
  if (x0 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate]! <= yinBuffer[x2]! ? tauEstimate : x2
  } else if (x2 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate]! <= yinBuffer[x0]! ? tauEstimate : x0
  } else {
    const s0 = yinBuffer[x0]!
    const s1 = yinBuffer[tauEstimate]!
    const s2 = yinBuffer[x2]!
    betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0))
  }

  const yinAt = yinBuffer[tauEstimate]!
  const freq = sampleRate / betterTau
  if (freq < 55 || freq > 2100) return null // ignore rumble / very high noise
  return { hz: freq, clarity: Math.max(0, Math.min(1, 1 - yinAt)) }
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}

export function midiToPitchClass(midi: number): number {
  const n = Math.round(midi)
  return ((n % 12) + 12) % 12
}
