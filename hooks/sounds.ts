// The game's sound effects: which one an action makes. The clips are built by tools/sounds.py into sounds/.
import type { Consumable, Game } from '../types'
import { KINDS, TIERS, nameOf } from './consumables'
import { MOD_NAME } from './game'
import { FRAMES_PER_TILE } from './pixels'
import type { Hit } from './pixels'

export type Sound =
  | 'death' | 'portal' | 'descend' | 'level' | 'nemesis' | 'boss' | 'rage' | 'bossDeath' | 'loot' | 'quest' | 'chest' | 'peak'
  | 'kill' | 'crit' | 'whiff' | 'hurt' | 'block' | 'windup' | 'foeHeal' | 'steal' | 'trap' | 'twist' | 'calm' | 'drink'
  | 'scroll' | 'heal' | 'anvil' | 'fortune' | 'questNew' | 'train' | 'buy' | 'sell' | 'equip' | 'unequip' | 'stash'
  | 'destroy' | 'potionUp' | 'herbUp' | 'scrollUp' | 'runeUp' | 'bombUp' | 'gearUp' | 'foe' | 'hit' | 'coin' | 'bark'
  | 'tick' | 'deny' | 'bump' | 'step1' | 'step2'

type Seen = { before: Game; next: Game; hits: readonly Hit[]; said: (test: (line: string) => boolean) => boolean }

/** Each consumable's pickup, by the form of its kind: potions clink, herbs rustle, scrolls flutter, runes ring, bombs clack. */
const PICKUP: Readonly<Record<Consumable, Sound>> = { health: 'potionUp', regen: 'herbUp', fury: 'scrollUp', ward: 'runeUp', smoke: 'bombUp' }
const KIND_OF_NAME = new Map(KINDS.flatMap(kind => TIERS.map(tier => [nameOf(kind, tier), kind] as const)))
const TWIST = new RegExp(`^(${Object.values(MOD_NAME).join('|')}): `)
const DENIED = /^(Your belt is full|Your bag is full|No room|Not enough gold|Your stash is full|Your belt has no room|Your belt holds no|Belt slot \d+ is empty|You have no |No stat points|Nothing worn there|There is no reforge|A Legendary is as it was made|The smith has nothing|The merchant has no|The portal will not open|You can't get there|No way on)|is locked: |is tempered as far as it will go/

/** A consumable picked up, by the line that tells it: the floor's potion, a drop, the lectern's scroll. */
const pickupOf = (line: string): Sound | undefined => {
  if (line === 'You find a Health Potion.') return 'potionUp'
  if (line.startsWith('You read at the lectern and copy out')) return 'scrollUp'
  const kind = KIND_OF_NAME.get(/^Loot: (.+)\.$/.exec(line)?.[1] ?? '')
  return kind === undefined ? undefined : PICKUP[kind]
}

/** Every sound and what makes it, the greatest first: an action's sound, when it has one, is the first that matches. */
const RULES: readonly [Sound, (s: Seen) => boolean][] = [
  ['death', s => s.said(l => l.startsWith('You were slain by '))],
  ['portal', s => s.next.where !== s.before.where],
  ['descend', s => s.said(l => / descend to depth \d+\.$/.test(l))],
  ['level', s => s.next.level > s.before.level],
  ['nemesis', s => s.said(l => l.endsWith(' has found you!'))],
  ['boss', s => s.said(l => l.endsWith(' rises to bar the way down!') || l.startsWith('The ground trembles. '))],
  ['rage', s => s.before.foe?.phase !== 2 && s.next.foe?.phase === 2],
  ['bossDeath', s => s.hits.some(h => h.kind === 'kill' && h.foe?.big !== undefined)],
  ['loot', s => s.hits.some(h => h.kind === 'loot')],
  ['quest', s => s.said(l => l.startsWith('Quest done'))],
  ['chest', s => s.said(l => l.startsWith('You open the '))],
  ['peak', s => s.said(l => l.startsWith('The air grows heavy.'))],
  ['kill', s => s.hits.some(h => h.kind === 'kill' && h.foe?.big === undefined)],
  ['crit', s => s.hits.some(h => h.kind === 'crit')],
  ['whiff', s => s.said(l => l.endsWith(' darts aside.') || l.endsWith('your blow passes through.') || l === 'You swing at the darkness.')],
  ['hurt', s => s.hits.some(h => h.kind === 'hurt')],
  ['block', s => s.said(l => l.endsWith(' shield turns your blow.') || l.startsWith('Your shield turns the ') || l.startsWith('Your ward absorbs the '))],
  ['windup', s => s.said(l => l.endsWith('...'))],
  ['foeHeal', s => s.said(l => / wounds knit\.| gulps a foul brew\.|^The tide mends | sinks into the mud and rises whole\.|pulls itself back together!$/.test(l))],
  ['steal', s => s.said(l => / snatches \d+ gold!$/.test(l))],
  ['trap', s => s.said(l => l.startsWith('A trap snaps'))],
  ['twist', s => s.said(l => TWIST.test(l))],
  ['calm', s => s.said(l => l === 'The dungeon falls quiet.')],
  ['drink', s => s.said(l => l.startsWith('You drink ') && !l.startsWith('You drink from the spring'))],
  ['scroll', s => s.said(l => /^(Fury fills you|A ward shimmers|You vanish in smoke|Warmth spreads)/.test(l))],
  ['heal', s => s.said(l => /^(The healer tends your wounds|You drink from the spring|You pray at the altar|A companion joins the fight|You catch your breath|You regenerate|You draw on the fallen)/.test(l))],
  ['anvil', s => s.said(l => /^The smith (tempers|reforges) /.test(l) || l.startsWith('The old anvil still rings'))],
  ['fortune', s => s.said(l => l.startsWith('The mystic reads your fortune'))],
  ['questNew', s => s.said(l => l.startsWith('A new quest: '))],
  ['train', s => s.said(l => l.startsWith('You train '))],
  ['buy', s => s.said(l => l.startsWith('You buy a '))],
  ['sell', s => s.said(l => l.startsWith('You sell ') || l.startsWith('You buy back '))],
  ['equip', s => s.said(l => l.startsWith('You equip the '))],
  ['unequip', s => s.said(l => l.startsWith('You take off the '))],
  ['stash', s => s.said(l => l.startsWith('You store the ') || l.endsWith(' from your stash.'))],
  ['destroy', s => s.said(l => l.startsWith('You destroy the '))],
  ...(['potionUp', 'herbUp', 'scrollUp', 'runeUp', 'bombUp'] as const).map(sound => [sound, (s: Seen) => s.said(l => pickupOf(l) === sound)] as [Sound, (s: Seen) => boolean]),
  ['gearUp', s => s.said(l => /^Loot: .+ \((Common|Uncommon)\)\.$/.test(l))],
  ['foe', s => s.said(l => l.endsWith(' emerges from the dark!'))],
  ['hit', s => s.hits.some(h => h.kind === 'hit')],
  ['coin', s => s.said(l => /^You pick up \d+ gold/.test(l))],
  ['bark', s => s.said(l => l.startsWith('The dog wags'))],
  ['tick', s => s.said(l => /^You (lock|unlock|mark) the /.test(l) || l.endsWith(' is no longer junk.'))],
  ['deny', s => s.said(l => DENIED.test(l))],
  ['bump', s => s.said(l => l === 'A wall.' || l === 'Solid rock.')],
]

/** Every sound an action makes, the greatest first; none when it came to nothing worth one. */
export const soundsFor = (before: Game, next: Game, hits: readonly Hit[]): Sound[] => {
  const lines = next.log.slice(next.log.length - next.fresh)
  const seen: Seen = { before, next, hits, said: test => lines.some(test) }
  return RULES.filter(([, test]) => test(seen)).map(([sound]) => sound)
}

/** The one sound an action makes, the greatest of what it came to. */
export const soundFor = (before: Game, next: Game, hits: readonly Hit[]): Sound | undefined => soundsFor(before, next, hits)[0]

/**
 * When in an action each sound falls, in frames: the deed itself; the foe's answer (its blow, a block, a heal, a
 * wind-up); the aftermath (what a kill leaves); the fanfare (a level, a peak, the calm). An action's sounds start on its
 * first frame, the earliest moment it has, each later one after it; two at one moment a few frames apart.
 */
const MOMENT: Partial<Record<Sound, number>> = {
  hurt: 1, block: 1, windup: 1, foeHeal: 1, steal: 1, rage: 1,
  potionUp: 2, herbUp: 2, scrollUp: 2, runeUp: 2, bombUp: 2, gearUp: 2, loot: 2,
  level: 3, nemesis: 3, peak: 3, calm: 3, twist: 3, quest: 3,
}
export const MOMENT_FRAMES = 6
const BESIDE_FRAMES = 3

/** An action's sounds as cues on its frames, in the order they happen. */
export const cuesFor = (sounds: readonly Sound[]): { sound: Sound; frame: number }[] => {
  const moments = sounds.map(sound => MOMENT[sound] ?? 0)
  const first = Math.min(...moments)
  const placed = sounds.map((sound, i) => ({ sound, moment: moments[i]! - first })).sort((a, b) => a.moment - b.moment)
  return placed.map((p, i) => ({ sound: p.sound, frame: p.moment * MOMENT_FRAMES + BESIDE_FRAMES * placed.slice(0, i).filter(q => q.moment === p.moment).length }))
}

/** Where a sound's clip lies in the plugin. */
export const soundAsset = (sound: Sound) => `sounds/${sound}.wav`

/** Tiles a footstep lasts: one every other tile, since each is a player process on the host. */
const TILES_A_STEP = 2

/** The footstep on a frame of a walk: one as every other tile begins, the two clips in turn. */
export const stepAt = (frame: number): Sound | undefined => {
  const every = TILES_A_STEP * FRAMES_PER_TILE
  if (frame < 1 || (frame - 1) % every !== 0) return undefined
  return Math.floor((frame - 1) / every) % 2 === 0 ? 'step1' : 'step2'
}

/** The town's tune, built by tools/sounds.py: it loops while the hero is in town. */
export const TOWN_TUNE = 'sounds/town.wav'

/** The music for where the hero is: the town's tune in town while the music is on; none in the dungeon. */
export const musicFor = (g: Pick<Game, 'where'>, isOn: boolean) => (isOn && g.where === 'town' ? TOWN_TUNE : undefined)

/**
 * The mix, as each comes out (its clip's peak times its gain): the music lowest, under the footsteps, the footsteps
 * under every other effect.
 */
export const MUSIC_GAIN = 0.3
const STEP_GAIN = 1.5
const EFFECT_GAIN = 1
export const gainOf = (sound: Sound) => (sound === 'step1' || sound === 'step2' ? STEP_GAIN : EFFECT_GAIN)

/** The host's places for one plugin's clips at once; each round of the town's tune keeps one while it plays. */
export const HOST_PLACES = 4

/** A player the mixer started: its sound and when it was asked for. It keeps its place until afplay exits. */
export type Player = { sound: Sound; at: number }

const isStep = (sound: Sound) => sound === 'step1' || sound === 'step2'

/**
 * What the mixer does with a sound, with `going` players holding their places of `places`: an effect plays over
 * whatever is sounding while there is a place, else waits for the next to free; nothing is cut. A footstep plays only
 * with a place to spare for an effect, and never waits: the walk asks for them faster than places free.
 */
export const mixFor = (going: number, places: number, sound: Sound): 'play' | 'wait' | 'skip' =>
  isStep(sound) ? (going < places - 1 ? 'play' : 'skip') : going < places ? 'play' : 'wait'
