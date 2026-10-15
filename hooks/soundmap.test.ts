import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { newGame } from './game'
import { CLIP_MS } from './clips'
import { cuesFor, soundFor, soundsFor } from './sounds'
import type { Sound } from './sounds'
import type { Hit } from './pixels'

const g = newGame(4)
const said = (...lines: string[]): Game => ({ ...g, log: [...g.log, ...lines], fresh: lines.length })

describe('every event has its sound', () => {
  const LINES: readonly [string, Sound][] = [
    ['Your shield turns the goblin\'s blow.', 'block'],
    ['Your ward absorbs the goblin\'s blow.', 'block'],
    ['The goblin\'s shield turns your blow.', 'block'],
    ['The rat darts aside.', 'whiff'],
    ['The wraith fades into the dark; your blow passes through.', 'whiff'],
    ['You swing at the darkness.', 'whiff'],
    ['The Bone King raises his greatsword...', 'windup'],
    ['The Furnace Wyrm draws a deep breath...', 'windup'],
    ['The air freezes around you...', 'windup'],
    ['The troll\'s wounds knit. +3 HP', 'foeHeal'],
    ['The kobold gulps a foul brew. +9 HP', 'foeHeal'],
    ['The tide mends the Drowned Queen. +20 HP', 'foeHeal'],
    ['You hit the Old Bones for 5. It clatters apart... and pulls itself back together!', 'foeHeal'],
    ['The goblin snatches 12 gold!', 'steal'],
    ['You find a Health Potion.', 'potionUp'],
    ['Loot: Elixir.', 'potionUp'],
    ['Loot: Troll Moss.', 'herbUp'],
    ['Loot: Scroll of Fury.', 'scrollUp'],
    ['You read at the lectern and copy out a Scroll of the Berserker.', 'scrollUp'],
    ['Loot: Aegis Rune.', 'runeUp'],
    ['Loot: Smoke Bomb.', 'bombUp'],
    ['Loot: Short Sword (Common).', 'gearUp'],
    ['Loot: Hearty Tunic (Uncommon).', 'gearUp'],
    ['You sell the Mace for 12 gold.', 'sell'],
    ['You buy back the Mace for 12 gold.', 'sell'],
    ['You take off the Hood.', 'unequip'],
    ['You destroy the Hood.', 'destroy'],
    ['You store the Hood in your stash.', 'stash'],
    ['You take the Hood from your stash.', 'stash'],
    ['You lock the Hood: it is kept whatever happens.', 'tick'],
    ['You mark the Hood as junk.', 'tick'],
    ['The Hood is no longer junk.', 'tick'],
    ['Your belt is full; the potion stays behind.', 'deny'],
    ['Not enough gold: a Elixir costs 80.', 'deny'],
    ['The Hood is locked: unlock it to sell it.', 'deny'],
    ['Your Mace is tempered as far as it will go.', 'deny'],
    ['You train might: now 3.', 'train'],
    ['The healer tends your wounds. HP full.', 'heal'],
    ['You drink from the spring. HP full.', 'heal'],
    ['You pray at the altar. +5 HP', 'heal'],
    ['You catch your breath. +2 HP', 'heal'],
    ['You regenerate 3 HP.', 'heal'],
    ['You kneel at a shrine: your work is kept. Full HP; you will wake on depth 13.', 'heal'],
    ['The loop comes round: +3 HP.', 'heal'],
    ['Your work goes out, and a cache opens.', 'loot'],
    ['Your pull request opens a hoard.', 'loot'],
    ['The dog wags its tail and leans into your hand.', 'bark'],
    ['The mystic reads your fortune for 30 gold: luck until you change depth.', 'fortune'],
    ['A new quest: "fix the build"', 'questNew'],
    ['Gloom: foes hit a fifth harder, and kills pay half again the gold.', 'twist'],
    ["Champions' den: one foe in four is a champion.", 'twist'],
    ['The ground trembles. Mother Mire is here!', 'boss'],
    ['A wall.', 'bump'],
    ['Solid rock.', 'bump'],
    ['The old anvil still rings: your Mace is tempered, +1 attack.', 'anvil'],
    ['You drink a Health Potion. +7 HP', 'drink'],
  ]
  for (const [line, sound] of LINES) test(`"${line}" sounds ${sound}`, async () => {
    expect(soundsFor(g, said(line), [])).toEqual([sound])
  })

  test('a big boss slain bursts; any other foe slain dies its own death', async () => {
    const foe = { glyph: '&', name: 'Bone King', hp: 0, maxHp: 1, atk: 1, xp: 1, x: 0, y: 0, big: 'king' as const }
    const kill = (f: typeof foe | Omit<typeof foe, 'big'>): Hit => ({ at: { x: 0, y: 0 }, amount: 1, kind: 'kill', foe: f })
    expect(soundFor(g, g, [kill(foe)])).toBe('bossDeath')
    const { big: _, ...plain } = foe
    expect(soundFor(g, g, [kill(plain)])).toBe('kill')
  })

  test('a big boss entering its rage roars, once', async () => {
    const foe = { glyph: '&', name: 'Bone King', hp: 40, maxHp: 100, atk: 1, xp: 1, x: 0, y: 0, big: 'king' as const }
    expect(soundsFor({ ...g, foe }, { ...g, foe: { ...foe, phase: 2 } }, [])).toEqual(['rage'])
    expect(soundsFor({ ...g, foe: { ...foe, phase: 2 } }, { ...g, foe: { ...foe, phase: 2 } }, [])).toEqual([])
  })

  test('every sound has its clip', async () => {
    const clips = Object.keys(CLIP_MS)
    for (const [, sound] of LINES) expect(clips).toContain(sound)
    for (const sound of ['rage', 'bossDeath'] as const) expect(clips).toContain(sound)
  })
})

describe('an action\'s sounds in the order they happen', () => {
  test('a kill, its drop and a level: the death at once, the drop 12 frames on, the fanfare at 18', async () => {
    expect(cuesFor(['level', 'kill', 'scrollUp'])).toEqual([{ sound: 'kill', frame: 0 }, { sound: 'scrollUp', frame: 12 }, { sound: 'level', frame: 18 }])
  })

  test('your blow and the answer: the hit at once, the blow taken 6 frames on', async () => {
    expect(cuesFor(['hurt', 'hit'])).toEqual([{ sound: 'hit', frame: 0 }, { sound: 'hurt', frame: 6 }])
  })

  test('a sound alone starts at once, whatever its moment: a level-up, a drop', async () => {
    expect(cuesFor(['level'])).toEqual([{ sound: 'level', frame: 0 }])
    expect(cuesFor(['potionUp', 'level'])).toEqual([{ sound: 'potionUp', frame: 0 }, { sound: 'level', frame: 6 }])
  })

  test('two at one moment, a few frames apart: two drops', async () => {
    expect(cuesFor(['kill', 'potionUp', 'gearUp'])).toEqual([{ sound: 'kill', frame: 0 }, { sound: 'potionUp', frame: 12 }, { sound: 'gearUp', frame: 15 }])
  })
})
