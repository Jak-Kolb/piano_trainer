/** YIN pitch detector (monophonic). Returns Hz or null. */

export function yinPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.12,
): number | null {
  const size = buffer.length
  if (size < 64) return null

  const half = Math.floor(size / 2)
  const yinBuffer = new Float32Array(half)

  // Difference function
  for (let tau = 1; tau < half; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const delta = buffer[i]! - buffer[i + tau]!
      sum += delta * delta
    }
    yinBuffer[tau] = sum
  }

  // Cumulative mean normalized difference
  yinBuffer[0] = 1
  let runningSum = 0
  for (let tau = 1; tau < half; tau++) {
    runningSum += yinBuffer[tau]!
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau]! * tau) / runningSum
  }

  // Absolute threshold
  let tauEstimate = -1
  for (let tau = 2; tau < half; tau++) {
    if (yinBuffer[tau]! < threshold) {
      while (tau + 1 < half && yinBuffer[tau + 1]! < yinBuffer[tau]!) tau++
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate === -1) return null

  // Parabolic interpolation
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

  const freq = sampleRate / betterTau
  if (freq < 27 || freq > 4200) return null
  return freq
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}

export function midiToPitchClass(midi: number): number {
  const n = Math.round(midi)
  return ((n % 12) + 12) % 12
}
