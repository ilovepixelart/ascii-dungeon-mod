import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { alongTheWay, apply, newGame } from './game'
import { announce } from './register'
import { MUSIC_GAIN, channel, gainOf, musicFor, soundFor, stepAt } from './sounds'
import type { Sound } from './sounds'
import { CLIP_MS, CLIP_PEAK } from './clips'
import type { Hit } from './pixels'

const said = (g: Game, ...lines: string[]): Game => ({ ...g, log: [...g.log, ...lines], fresh: lines.length })
const at = { x: 1, y: 1 }
const hit = (kind: Hit['kind']): Hit => ({ at, amount: 3, kind })

describe('which sound an action makes', () => {
  const g = newGame(4)
  test('one sound an action, the biggest event first: a level-up, a chest, a kill, a crit, a blow taken, a hit, gold', async () => {
    expect(soundFor(g, { ...said(g, 'You open the iron chest: 20 gold.'), level: 2 }, [hit('kill')])).toBe('level')
    expect(soundFor(g, said(g, 'You open the iron chest: 20 gold.'), [hit('kill')])).toBe('chest')
    expect(soundFor(g, g, [hit('hurt'), hit('kill')])).toBe('kill')
    expect(soundFor(g, g, [hit('hurt'), hit('crit')])).toBe('crit')
    expect(soundFor(g, g, [hit('hit'), hit('hurt')])).toBe('hurt')
    expect(soundFor(g, g, [hit('hit')])).toBe('hit')
    expect(soundFor(g, said(g, 'You pick up 7 gold.'), [])).toBe('coin')
  })
  test('the pacing and the loot have their own: a nemesis over a beam, a beam over a chest, a peak over a kill, a calm under a blow taken', async () => {
    const loot: Hit = { at, amount: 0, kind: 'loot', tier: 'epic' }
    expect(soundFor(g, said(g, 'You feel watched. Grak the Butcher has found you!'), [loot])).toBe('nemesis')
    expect(soundFor(g, said(g, 'You open the iron chest: 20 gold.'), [hit('kill'), loot])).toBe('loot')
    expect(soundFor(g, said(g, 'The air grows heavy. Something strong is near.'), [hit('kill')])).toBe('peak')
    expect(soundFor(g, said(g, 'The dungeon falls quiet.'), [hit('hurt')])).toBe('hurt')
    expect(soundFor(g, said(g, 'The dungeon falls quiet.', 'You catch your breath. +4 HP'), [])).toBe('calm')
    expect(soundFor(g, said(g, 'The dungeon falls quiet.'), [hit('hit')])).toBe('calm')
  })

  test('every effect has its clip, a peak and a length', async () => {
    for (const sound of ['nemesis', 'loot', 'peak', 'calm'] as const) {
      expect(CLIP_MS[sound]).toBeGreaterThan(200)
      expect(CLIP_PEAK[sound]).toBeGreaterThan(0)
    }
  })

  test('stepping through the portal, either way, plays the portal', async () => {
    const town = { ...g, where: 'town' as const }
    expect(soundFor(g, town, [])).toBe('portal')
    expect(soundFor(town, g, [])).toBe('portal')
    expect(soundFor(town, town, [])).toBeUndefined()
  })

  test('nothing for an action that comes to none of those', async () => {
    expect(soundFor(g, said(g, 'You walk on.'), [])).toBeUndefined()
    // A line from an earlier action does not sound again.
    expect(soundFor(g, { ...said(g, 'You pick up 7 gold.'), fresh: 0 }, [])).toBeUndefined()
  })
})

describe('footsteps', () => {
  test('a step on the first frame of every other tile, the two clips in turn; none on the frames between', async () => {
    const steps = Array.from({ length: 25 }, (_, i) => [i + 1, stepAt(i + 1)] as const).filter(([, s]) => s !== undefined)
    expect(steps).toEqual([[1, 'step1'], [9, 'step2'], [17, 'step1'], [25, 'step2']])
    expect(stepAt(0)).toBeUndefined()
  })
})

describe('the town music', () => {
  test('plays in town while the music is on; never in the dungeon', async () => {
    const town = { ...newGame(4), where: 'town' as const }
    expect(musicFor(town, true)).toBe('sounds/town.wav')
    expect(musicFor(town, false)).toBeUndefined()
    expect(musicFor(newGame(4), true)).toBeUndefined()
  })
})

describe('the effects channel', () => {
  const playing = (sound: Sound, startedAt: number) => ({ sound, endsAt: startedAt + CLIP_MS[sound] })

  test('an empty channel, or one whose effect has ended, plays whatever comes', async () => {
    expect(channel(null, 'step1', 0)).toEqual({ play: true, cut: false })
    expect(channel(playing('kill', 0), 'step1', CLIP_MS.kill)).toEqual({ play: true, cut: false })
  })

  test('a greater effect cuts a lesser one still sounding; a lesser one is dropped; a like one takes over', async () => {
    expect(channel(playing('step1', 0), 'kill', 10)).toEqual({ play: true, cut: true })
    expect(channel(playing('kill', 0), 'step1', 10)).toEqual({ play: false, cut: false })
    expect(channel(playing('hit', 0), 'hit', 10)).toEqual({ play: true, cut: true })
  })

  test('the ranks, greatest first: portal, level-up, chest, kill, crit, a blow taken, hit, gold, footsteps', async () => {
    const order: Sound[] = ['portal', 'level', 'chest', 'kill', 'crit', 'hurt', 'hit', 'coin', 'step1']
    for (let i = 0; i + 1 < order.length; i += 1) expect(channel(playing(order[i + 1]!, 0), order[i]!, 1).cut).toBe(true)
    expect(channel(playing('step1', 0), 'step2', 1).cut).toBe(true)
  })

  test('the mix, as loud as each comes out (its peak times its gain): the music under the footsteps, the footsteps under every other effect', async () => {
    const out = (s: Sound) => CLIP_PEAK[s] * gainOf(s)
    const music = CLIP_PEAK.town * MUSIC_GAIN
    expect(music).toBeLessThan(out('step1'))
    expect(out('step2')).toBe(out('step1'))
    for (const s of ['portal', 'level', 'chest', 'kill', 'crit', 'hurt', 'hit', 'coin'] as const) expect(out(s)).toBeGreaterThan(out('step1'))
  })
})

describe('telling a walk tile by tile', () => {
  // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51: a walk east over both.
  const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
  const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
  const tiles = alongTheWay(g, plan)!

  test('the coin rings on the tile with the gold, and not again on the tiles after it nor at the end', async () => {
    let shown: Game | null = null
    const sounds = tiles.map(t => {
      const { sound } = announce(shown, shown ?? g, t, false, false, [])
      shown = t
      return sound
    })
    expect(sounds).toEqual([undefined, 'coin', undefined, undefined, undefined, undefined, undefined])
  })

  test('with nothing shown on the way, the end tells it all', async () => {
    expect(announce(null, g, plan, false, false, []).sound).toBe('coin')
  })
})
