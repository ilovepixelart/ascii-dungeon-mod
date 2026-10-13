import { describe, expect, test } from 'claude-code/testing'

import { CLIP_MS, TUNE_MS } from './clips'
import { FRAME_MS } from './frames'
import { isLeftUnseen } from './register'
import { HOST_PLACES, mixFor, stepAt } from './sounds'
import type { Sound } from './sounds'

/**
 * How long a player holds its place with the host, as measured: launched within about 170 ms, then its clip, then
 * afplay going on about a second more until the sound has reached the speaker, when it exits.
 */
const holds = (sound: Sound) => 170 + CLIP_MS[sound as keyof typeof CLIP_MS] + 1200

type Asked = { at: number; sound: Sound }

/**
 * The sounds asked for, through the mixer as the pane runs it (a waiting effect started as a place frees), against
 * the host's own rule: at most HOST_PLACES clips going, the tune's `rounds` holding theirs. What sounded and when,
 * what was skipped, and what the host would have refused.
 */
const replay = (asked: readonly Asked[], rounds = 0) => {
  let going: { sound: Sound; until: number }[] = []
  const waiting: Asked[] = []
  const sounded: { sound: Sound; asked: number; at: number }[] = []
  const skipped: Sound[] = []
  let refused = 0
  const start = (a: Asked, at: number) => {
    if (going.length + rounds >= HOST_PLACES) refused += 1
    going.push({ sound: a.sound, until: at + holds(a.sound) })
    sounded.push({ sound: a.sound, asked: a.at, at })
  }
  const events = [...asked].sort((x, y) => x.at - y.at)
  for (let t = 0; t <= (events.at(-1)?.at ?? 0) + 5000; t += 1) {
    for (const p of going.filter(q => q.until === t)) {
      going = going.filter(q => q !== p)
      const next = waiting.shift()
      if (next !== undefined) start(next, t)
    }
    for (const a of events.filter(e => e.at === t)) {
      const fate = mixFor(going.length, HOST_PLACES - rounds, a.sound)
      if (fate === 'play') start(a, t)
      else if (fate === 'wait') waiting.push(a)
      else skipped.push(a.sound)
    }
  }
  return { sounded, skipped, refused }
}

/** A walk of `tiles` tiles from `t0`: its footsteps as the walk plays them. */
const walk = (t0: number, tiles: number): Asked[] =>
  Array.from({ length: tiles * 4 }, (_, i) => i + 1).flatMap(frame => {
    const step = stepAt(frame)
    return step === undefined ? [] : [{ at: t0 + frame * FRAME_MS, sound: step }]
  })

const effects = (s: { sound: Sound }[]) => s.map(x => x.sound).filter(x => !x.startsWith('step'))

describe('the mixer against the host', () => {
  test('an effect plays over whatever sounds while there is a place, else waits; a footstep takes a place only with one to spare', async () => {
    expect([0, 1, 2, 3, 4].map(n => mixFor(n, 4, 'hit'))).toEqual(['play', 'play', 'play', 'play', 'wait'])
    expect([0, 1, 2, 3, 4].map(n => mixFor(n, 4, 'step1'))).toEqual(['play', 'play', 'play', 'skip', 'skip'])
  })

  test('a walk with gold on the way and a fight after: every effect plays, in order, and the host refuses nothing, in town or out', async () => {
    const fight: Asked[] = (['hit', 'hurt', 'hit', 'crit', 'kill'] as const).map((sound, i) => ({ at: 3000 + i * 450, sound }))
    const asked = [...walk(0, 12), { at: 12 * FRAME_MS + 2, sound: 'coin' as const }, { at: 36 * FRAME_MS + 2, sound: 'coin' as const }, ...fight]
    for (const rounds of [0, 1]) {
      const { sounded, skipped, refused } = replay(asked, rounds)
      expect(refused).toBe(0)
      expect(effects(sounded)).toEqual(['coin', 'coin', 'hit', 'hurt', 'hit', 'crit', 'kill'])
      expect(skipped.every(s => s.startsWith('step'))).toBe(true)
    }
  })

  test('gold picked up mid-walk sounds as it is picked up: the footsteps leave it a place', async () => {
    const { sounded } = replay([...walk(0, 30), { at: 60 * FRAME_MS + 2, sound: 'coin' }])
    const coin = sounded.find(s => s.sound === 'coin')!
    expect(coin.at).toBe(coin.asked)
  })

  test('a burst with every place taken: each effect waits for the next place, then plays, nothing dropped', async () => {
    const burst: Asked[] = ['hit', 'hurt', 'crit', 'kill', 'coin', 'level'].map((sound, i) => ({ at: i, sound: sound as Sound }))
    const { sounded, refused } = replay(burst, 1)
    expect(refused).toBe(0)
    expect(effects(sounded)).toEqual(['hit', 'hurt', 'crit', 'kill', 'coin', 'level'])
  })
})

describe('the town tune', () => {
  test('a round is its 8 bars of 4 beats at 76 a minute, so the next round starts as the last ends', async () => {
    expect(TUNE_MS).toBe(Math.round((8 * 4 * 60 * 1000) / 76))
  })
})

describe('pausing with the pane', () => {
  test('closing the pane pauses the game only when no dungeon pane is left open: reopened by /dungeon, it plays on', async () => {
    expect(isLeftUnseen('dungeon', [])).toBe(true)
    expect(isLeftUnseen('dungeon', [{ id: 'dungeon' }])).toBe(false)
    expect(isLeftUnseen('other', [])).toBe(false)
  })
})
