import { describe, expect, test } from 'claude-code/testing'

import { RATE, base64Of, bytesOf, mixdown, readWav, sampleOf, walkCues, wavOf } from './mixdown'
import type { Sound } from './sounds'

describe('clips in and out', () => {
  test('a clip written as WAV reads back sample for sample, through base64 too', async () => {
    const pcm = Int16Array.from([0, 1, -1, 32767, -32768, 1234])
    expect(Array.from(readWav(wavOf(pcm))!)).toEqual(Array.from(pcm))
    expect(Array.from(readWav(bytesOf(base64Of(wavOf(pcm))))!)).toEqual(Array.from(pcm))
  })

  test('a WAV of another shape is not read: stereo, another rate, not a WAV at all', async () => {
    const bytes = wavOf(Int16Array.from([1, 2]))
    const stereo = bytes.slice()
    new DataView(stereo.buffer).setUint16(22, 2, true)
    const faster = bytes.slice()
    new DataView(faster.buffer).setUint32(24, 44100, true)
    expect([readWav(stereo), readWav(faster), readWav(new Uint8Array(40))]).toEqual([undefined, undefined, undefined])
  })
})

describe('the mix', () => {
  const clips = new Map<Sound, Int16Array>([['hit', Int16Array.from([1000, 2000])], ['coin', Int16Array.from([100])], ['step1', Int16Array.from([1000])]])

  test('each clip starts on its frame\'s sample, 33 ms a frame at 22050 a second: frame 1 is sample 728', async () => {
    expect(sampleOf(1)).toBe(728)
    const out = mixdown([{ sound: 'hit', frame: 0 }, { sound: 'coin', frame: 1 }], clips)
    expect(out.length).toBe(729)
    expect([out[0], out[1], out[2], out[728]]).toEqual([1000, 2000, 0, 100])
  })

  test('each clip at its gain in the mix: a footstep half again as loud', async () => {
    expect(mixdown([{ sound: 'step1', frame: 0 }], clips)[0]).toBe(1500)
  })

  test('sounds on one frame sum; a sum that would clip is scaled down whole, never clipped', async () => {
    const loud = new Map<Sound, Int16Array>([['hit', Int16Array.from([30000, 15000])], ['crit', Int16Array.from([30000, -15000])]])
    const out = mixdown([{ sound: 'hit', frame: 0 }, { sound: 'crit', frame: 0 }], loud)
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(0)
    const unscaled = mixdown([{ sound: 'hit', frame: 0 }], loud)
    expect(Array.from(unscaled)).toEqual([30000, 15000])
  })

  test('a mix longer than the engine takes arguments for a call (a walk across the map is about 20 s) still mixes', async () => {
    const long = new Map<Sound, Int16Array>([['hit', new Int16Array(1_200_000).fill(100)]])
    const out = mixdown([{ sound: 'hit', frame: 0 }], long)
    expect([out.length, out[0], out[1_199_999]]).toEqual([1_200_000, 100, 100])
  })

  test('a cue whose clip is not loaded is left out', async () => {
    expect(Array.from(mixdown([{ sound: 'kill', frame: 0 }], clips))).toEqual([])
  })

  test('the rate is the clips\' own', async () => {
    expect(RATE).toBe(22050)
  })
})

describe('a walk\'s cues', () => {
  test('a footstep every other tile from the first frame, and gold on tile 2 as tile 2 is reached', async () => {
    expect(walkCues(4, [[], ['coin']])).toEqual([{ sound: 'step1', frame: 1 }, { sound: 'coin', frame: 8 }, { sound: 'step2', frame: 9 }])
  })

  test('no footstep on the frame the walk ends', async () => {
    expect(walkCues(2).map(c => c.frame)).toEqual([1])
  })
})
