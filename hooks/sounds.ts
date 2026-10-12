// The game's sound effects: which one an action makes. The clips are built by tools/sounds.py into sounds/.
import type { Game } from '../types'
import { FRAMES_PER_TILE } from './pixels'
import type { Hit } from './pixels'

export type Sound = 'portal' | 'level' | 'nemesis' | 'loot' | 'chest' | 'peak' | 'kill' | 'crit' | 'hurt' | 'calm' | 'hit' | 'coin' | 'step1' | 'step2'

/** The one sound an action makes, the biggest of what it came to; none when it came to nothing worth one. */
export const soundFor = (before: Game, next: Game, hits: readonly Hit[]): Sound | undefined => {
  const lines = next.log.slice(next.log.length - next.fresh)
  if (next.where !== before.where) return 'portal'
  if (next.level > before.level) return 'level'
  if (lines.some(l => l.endsWith(' has found you!'))) return 'nemesis'
  if (hits.some(h => h.kind === 'loot')) return 'loot'
  if (lines.some(l => l.startsWith('You open the '))) return 'chest'
  if (lines.some(l => l.startsWith('The air grows heavy.'))) return 'peak'
  for (const kind of ['kill', 'crit', 'hurt'] as const) if (hits.some(h => h.kind === kind)) return kind
  if (lines.some(l => l === 'The dungeon falls quiet.')) return 'calm'
  if (hits.some(h => h.kind === 'hit')) return 'hit'
  if (lines.some(l => /^You pick up \d+ gold/.test(l))) return 'coin'
  return undefined
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

/** Each effect's rank on the one effects channel, greatest first. */
const RANK: readonly Sound[] = ['portal', 'level', 'nemesis', 'loot', 'chest', 'peak', 'kill', 'crit', 'hurt', 'calm', 'hit', 'coin', 'step1']
const rankOf = (sound: Sound) => RANK.indexOf(sound === 'step2' ? 'step1' : sound)

/** What the one effects channel is sounding: which effect, and when it ends. */
export type Channel = { sound: Sound; endsAt: number } | null

/**
 * One effects channel, as old consoles kept it: an effect plays on a quiet channel; one as great or greater cuts the
 * effect still sounding; a lesser one is dropped while a greater one sounds. Effects never pile up.
 */
export const channel = (now: Channel, next: Sound, at: number): { play: boolean; cut: boolean } => {
  if (now === null || at >= now.endsAt) return { play: true, cut: false }
  return rankOf(next) <= rankOf(now.sound) ? { play: true, cut: true } : { play: false, cut: false }
}
