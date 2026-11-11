/**
 * TACTICAL AUDIO SYNTHESIZER — PUSSIBERAD C2 COMMAND & CONTROL
 * Sintesis Audio Taktis Berbasis Web Audio API Asli.
 * 
 * Keunggulan:
 * - 0ms Latency: Langsung berbunyi seketika tombol diklik tanpa jeda jaringan.
 * - Zero Dependency: Tanpa file MP3/WAV eksternal yang rawan 404 atau network lag.
 * - Milspec Acoustic Calibration: Frekuensi harmonis yang renyah, modern, dan seimbang (tidak menusuk telinga).
 */

let cachedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    if (!cachedAudioCtx || cachedAudioCtx.state === 'closed') {
      cachedAudioCtx = new AudioCtx()
    }
    if (cachedAudioCtx.state === 'suspended') {
      cachedAudioCtx.resume().catch(() => {})
    }
    return cachedAudioCtx
  } catch {
    return null
  }
}

/**
 * Efek Suara Taktis: Berita Disematkan (Pin Affirmation Chime)
 * Nada harmonik C6 / F#5 -> A#5 dengan transient digital click dan resonansi kristal cyber.
 */
export function playTacticalPinChime() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime

    // 1. Digital Confirmation Click / Chirp (Transient tactile micro-click: 0 to 35ms)
    const clickOsc = ctx.createOscillator()
    const clickGain = ctx.createGain()
    clickOsc.type = 'sine'
    clickOsc.frequency.setValueAtTime(1400, now)
    clickOsc.frequency.exponentialRampToValueAtTime(2200, now + 0.03)
    clickGain.gain.setValueAtTime(0.0001, now)
    clickGain.gain.exponentialRampToValueAtTime(0.09, now + 0.005)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)

    clickOsc.connect(clickGain)
    clickGain.connect(ctx.destination)
    clickOsc.start(now)
    clickOsc.stop(now + 0.04)

    // 2. Harmonic Resonant Chime (Root F#5 -> A#5 & Overtone C#6)
    const oscRoot = ctx.createOscillator()
    const oscThird = ctx.createOscillator()
    const chordGain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    oscRoot.type = 'sine'
    oscRoot.frequency.setValueAtTime(739.99, now + 0.015) // F#5
    oscRoot.frequency.exponentialRampToValueAtTime(932.33, now + 0.07) // A#5

    oscThird.type = 'triangle'
    oscThird.frequency.setValueAtTime(1108.73, now + 0.015) // C#6
    oscThird.frequency.exponentialRampToValueAtTime(1479.98, now + 0.07) // F#6

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3600, now + 0.015)
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.28)

    chordGain.gain.setValueAtTime(0.0001, now + 0.015)
    chordGain.gain.exponentialRampToValueAtTime(0.12, now + 0.04)
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

    oscRoot.connect(filter)
    oscThird.connect(filter)
    filter.connect(chordGain)
    chordGain.connect(ctx.destination)

    oscRoot.start(now + 0.015)
    oscThird.start(now + 0.015)
    oscRoot.stop(now + 0.3)
    oscThird.stop(now + 0.3)
  } catch {
    // Silent fallback on browser policy restriction
  }
}

/**
 * Efek Suara Taktis: Lepas Sematan (Unpin Soft Release Blip)
 * Nada turun lembut yang mengindikasikan pelepasan pin.
 */
export function playTacticalUnpinChime() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now) // A5
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.12) // D5

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.15)
  } catch {
    // Silent fallback
  }
}
