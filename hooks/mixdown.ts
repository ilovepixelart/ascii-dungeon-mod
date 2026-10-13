// The game's own mixer: an animation's sounds laid into one clip, each at its frame, for the host to play as one.
// The host plays a clip a process, at most 4 at once, each holding its place until its player exits a second or so
// after the clip; one clip an animation keeps a walk's footsteps, and what it picks up, on their frames.
// Pure: clips in as 16-bit samples, a clip out as WAV bytes.
import { FRAME_MS } from './frames'
import { FRAMES_PER_TILE } from './pixels'
import { cuesFor, gainOf, stepAt } from './sounds'
import type { Sound } from './sounds'

/** The clips' format, as tools/sounds.py writes them: 22 kHz mono 16-bit. */
export const RATE = 22050

/** A sound laid into a mix: which, and on which frame of the animation, from its start. */
export type Cue = { sound: Sound; frame: number }

/** The samples of a 16-bit mono WAV at RATE, read from its `data` chunk; undefined for any other shape. */
export const readWav = (bytes: Uint8Array): Int16Array | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return undefined
  let at = 12
  let isFit = false
  while (at + 8 <= bytes.length) {
    const size = view.getUint32(at + 4, true)
    if (tag(at) === 'fmt ') isFit = view.getUint16(at + 8, true) === 1 && view.getUint16(at + 10, true) === 1 && view.getUint32(at + 12, true) === RATE && view.getUint16(at + 22, true) === 16
    if (tag(at) === 'data') {
      if (!isFit) return undefined
      const n = Math.floor(Math.min(size, bytes.length - at - 8) / 2)
      return Int16Array.from({ length: n }, (_, i) => view.getInt16(at + 8 + 2 * i, true))
    }
    at += 8 + size + (size % 2)
  }
  return undefined
}

/** A 16-bit mono WAV at RATE holding `samples`. */
export const wavOf = (samples: Int16Array): Uint8Array => {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const tag = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  tag(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  tag(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => view.setInt16(44 + 2 * i, s, true))
  return bytes
}

/** The sample a frame of an animation starts on. */
export const sampleOf = (frame: number) => Math.round((frame * FRAME_MS * RATE) / 1000)

/**
 * The cues laid into one clip, each clip at its frame and its gain in the mix (`gainOf`), summed; the whole scaled
 * down when the sum would clip, never clipped. Cues whose clip is not loaded are left out.
 */
export const mixdown = (cues: readonly Cue[], clips: ReadonlyMap<Sound, Int16Array>): Int16Array => {
  const placed = cues.flatMap(c => {
    const pcm = clips.get(c.sound)
    return pcm === undefined ? [] : [{ pcm, start: sampleOf(c.frame), gain: gainOf(c.sound) }]
  })
  const length = Math.max(0, ...placed.map(p => p.start + p.pcm.length))
  const sum = new Float64Array(length)
  for (const p of placed) p.pcm.forEach((s, i) => (sum[p.start + i]! += s * p.gain))
  // A loop, not a spread: a long walk's clip has more samples than a call takes arguments.
  let peak = 1
  for (const s of sum) peak = Math.max(peak, Math.abs(s))
  const scale = peak > 32767 ? 32767 / peak : 1
  return Int16Array.from(sum, s => Math.round(s * scale))
}

/** Bytes as base64, in slices so a long clip never overflows the call. */
export const base64Of = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** Base64 as bytes. */
export const bytesOf = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0))

/**
 * A walk's cues: its footsteps on the frames the walk plays them (`stepAt`, none on the frame it ends), and what each
 * tile it reaches comes to (`tileSounds[i]` for tile i + 1, from that tile's last frame, in the order they happen).
 */
export const walkCues = (tiles: number, tileSounds: readonly (readonly Sound[])[] = []): Cue[] => {
  const last = tiles * FRAMES_PER_TILE
  const steps = Array.from({ length: last - 1 }, (_, i) => i + 1).flatMap(frame => {
    const sound = stepAt(frame)
    return sound === undefined ? [] : [{ sound, frame }]
  })
  const reached = tileSounds.flatMap((sounds, i) => cuesFor(sounds).map(c => ({ sound: c.sound, frame: (i + 1) * FRAMES_PER_TILE + c.frame })))
  return [...steps, ...reached].sort((a, b) => a.frame - b.frame)
}
