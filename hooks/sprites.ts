import type { Game } from '../types'
import { levelOf, runsOf } from './game'
import type { Run } from './game'
import { MAP_H, MAP_W } from './map'
import { CANVAS } from './palette'
import { tileAt, townRows, visibleSet, windowStart } from './panels'
import type { Tile } from './panels'

export const TILE_W = 6
export const TILE_H = 3

/** How one cell of a sprite is painted; a sprite with no `bg` lets the ground show through. */
export type Style = { fg?: string; bg?: string; bold?: true }

/**
 * A creature in one tile: `art` the characters, `paint` a style key per cell ('.' draws in the occupant's
 * own ink over the ground). The solid body is background color, the glyphs on it are the detail.
 */
export type Sprite = { art: readonly string[]; paint: readonly string[] }

export const STYLES: Readonly<Record<string, Style>> = {
  // the hero
  H: { fg: '#f2f4f8', bg: '#5c6370', bold: true }, // steel helm, the face showing through
  O: { fg: '#fff4c8', bg: '#5b3a1f', bold: true }, // leather hood
  T: { fg: '#cfe0ff', bg: '#2a4d8f' }, // tunic
  S: { fg: '#f0c8a0' }, // hands
  L: { fg: '#c9c9c9' }, // legs
  B: { fg: '#ffffff', bold: true }, // blade
  G: { fg: '#ffd34d', bold: true }, // hilt
  // goblin
  g: { fg: '#ffe066', bg: '#3f7d2a', bold: true },
  e: { fg: '#7fd65a' },
  r: { fg: '#e6d2ae', bg: '#5a4632' },
  k: { fg: '#c0c0c0' }, // a blade or spear
  // kobold
  K: { fg: '#ffb27a', bold: true },
  c: { fg: '#ffd0a8', bg: '#7a3f1f' },
  // orc
  o: { fg: '#ff8a7a', bg: '#2f5a2a', bold: true },
  p: { fg: '#d5d9df', bg: '#4a4f57', bold: true }, // iron pauldrons
  b: { fg: '#e6d2ae', bg: '#4a3424' },
  // skeleton
  s: { fg: '#1a1a1a', bg: '#e8e2d0', bold: true },
  w: { fg: '#e8e2d0' }, // bone
  u: { fg: '#d98b55' }, // rust
  // troll
  t: { fg: '#ffffff', bg: '#556b4a', bold: true },
  m: { fg: '#dbe6cc', bg: '#465a3c' },
  a: { fg: '#a9c29a' }, // long arms and legs
  // wraith
  h: { fg: '#7fe3ff', bg: '#2a1f3d', bold: true },
  v: { fg: '#c9a8ff', bg: '#2a1f3d' },
  x: { fg: '#b896f0' }, // ragged hem
  // rat
  R: { fg: '#ff9485', bold: true },
  f: { fg: '#c4b3a0' },
  // dragon
  W: { fg: '#ff8a4d' }, // wings and tail
  D: { fg: '#ffd34d', bg: '#7a1f1f', bold: true },
}

const sprite = (art: readonly string[], paint: readonly string[]): Sprite => ({ art, paint })

/** Front-facing, one per monster letter; the letter stays on the head so the 1x map and this view agree. */
export const SPRITES: Readonly<Record<string, Sprite>> = {
  r: sprite(['      ', '      ', '~(__r>'], ['......', '......', 'ffffRf']),
  g: sprite(['  <g> ', ' ((#)-', '  d b '], ['..ege.', '.rrrrk', '..e.e.']),
  k: sprite([' <k  |', ' (#)-+', ' d b |'], ['.KKK.k', '.cccKk', '.K.K.k']),
  o: sprite([' _{o}_', '(O##O)', ' |  | '], ['.pooop', 'epbbpe', '.e..e.']),
  s: sprite([' {s}  ', ' |==|/', '  /\\  '], ['.sss..', '.wwwwu', '..ww..']),
  T: sprite(['  (T) ', '(####)', '| || |'], ['..ttt.', 'ammmma', 'a.aa.a']),
  W: sprite([' /W\\  ', '( :: )', '^v^v^v'], ['.hhh..', 'vvvvvv', 'xxxxxx']),
  D: sprite(['/\\  /\\', '<(D)~~', ' /  \\ '], ['WW..WW', 'WDDDWW', '.W..W.']),
}

const UNKNOWN = sprite([' (?)  ', ' [~]  ', '  /\\  '], ['......', '......', '......'])

const THINGS: Readonly<Record<string, readonly string[]>> = {
  $: ['      ', '  $$  ', ' $$$$ '],
  '!': ['  _   ', ' ( )  ', ' (!)  '],
  '^': ['      ', '      ', ' ^^^^ '],
  '>': ['  ____', ' _|>> ', '_|>>  '],
}

/** Ground patterns: staggered brick for walls, an arch for doors, a sparse tile for floors. */
const TEXTURES: Readonly<Record<string, readonly string[]>> = {
  floor: ['.     ', '   .  ', '      '],
  door: ['/----\\', '|    |', '|    |'],
}

const BLANK = ['      ', '      ', '      ']

/** Brick courses alternate by screen row, so they stay staggered where one tile meets the next. */
const BRICK = ['___|__', '_|____']

/** A knight: a hood, or a steel helm while one is worn, with @ for a face; a tunic between two hands; the sword raised while a weapon is worn; two legs. */
export const heroSprite = (g: Pick<Game, 'gear'>): Sprite => {
  const isArmed = g.gear.weapon !== undefined
  const head = g.gear.helm === undefined || g.gear.helm.base === 'hood' ? '(@)' : '[@]'
  return sprite(
    [` ${head} ${isArmed ? '|' : ' '}`, isArmed ? 'd[#]-+' : 'd[#]b ', ' | |  '],
    [`.${g.gear.helm === undefined ? 'OOO' : 'HHH'}.${isArmed ? 'B' : '.'}`, isArmed ? 'STTTSG' : 'STTTS.', '.L.L..'],
  )
}

const spriteOf = (g: Game, tile: Tile): Sprite | undefined => {
  const o = tile.occupant
  if (o === undefined) return undefined
  if (o.kind === 'hero') return heroSprite(g)
  if (o.kind === 'foe') return SPRITES[o.glyph] ?? UNKNOWN
  const art = THINGS[o.glyph]
  return art === undefined ? undefined : sprite(art, art.map(row => '.'.repeat(row.length)))
}

/** A creature in sight is painted in its own colors; one only sensed, or a thing remembered, in the occupant's single ink. */
const spriteCell = (tile: Tile, ch: string, key: string): Run => {
  const bg = tile.ground.bg
  const o = tile.occupant
  const style = o?.kind === 'thing' || !tile.isVisible ? undefined : STYLES[key]
  if (style === undefined) return ch === ' ' ? { text: ' ', bg } : { text: ch, color: o?.color, bold: o?.bold, bg }
  return { text: ch, color: style.fg, bold: style.bold, bg: style.bg ?? bg }
}

/** One row of a tile's block: a sprite's characters over the ground, or the ground's own pattern. */
const blockRow = (g: Game, tile: Tile, row: number, screenRow: number): Run[] => {
  const sprite = spriteOf(g, tile)
  const bg = tile.ground.bg
  if (sprite !== undefined) {
    const paint = sprite.paint[row] ?? ''
    return [...(sprite.art[row] ?? '')].map((ch, i) => spriteCell(tile, ch, paint[i] ?? '.'))
  }
  const empty = ' '.repeat(TILE_W)
  if (tile.surface === 'wall') return [{ text: BRICK[screenRow % 2] ?? empty, color: tile.ground.color, bg }]
  const pattern = TEXTURES[tile.surface] ?? BLANK
  return [{ text: tile.surface === 'unseen' ? empty : (pattern[row] ?? empty), color: tile.ground.color, bg }]
}

/** The map zoomed in, each cell a TILE_W by TILE_H block, `columns` by `rows`, the window following the hero. */
export const zoomedRows = (g: Game, columns: number, rows: number): Run[][] => {
  // The town has no sprite blocks: the ASCII view shows its character map.
  if (g.where === 'town') return townRows(g, columns, rows)
  const level = levelOf(g)
  const visible = visibleSet(g, level)
  const across = Math.min(MAP_W, Math.ceil(columns / TILE_W))
  const down = Math.min(MAP_H, Math.ceil(rows / TILE_H))
  const left = windowStart(g.x, across, MAP_W)
  const top = windowStart(g.y, down, MAP_H)
  const out: Run[][] = []
  for (let ty = 0; ty < down; ty += 1) {
    const tiles = Array.from({ length: across }, (_, tx) => tileAt(g, level, visible, { x: left + tx, y: top + ty }))
    for (let row = 0; row < TILE_H; row += 1) out.push(fit(tiles.flatMap(tile => blockRow(g, tile, row, ty * TILE_H + row)), columns))
  }
  return out.slice(0, rows).concat(Array.from({ length: Math.max(0, rows - out.length) }, () => [{ text: ' '.repeat(columns), bg: CANVAS }]))
}

/** Cuts or pads a row of runs to exactly `columns` cells. */
const fit = (runs: Run[], columns: number): Run[] => {
  const out: Run[] = []
  let used = 0
  for (const run of runs) {
    if (used >= columns) break
    const text = run.text.slice(0, columns - used)
    out.push({ ...run, text })
    used += text.length
  }
  if (used < columns) out.push({ text: ' '.repeat(columns - used), bg: CANVAS })
  return runsOf(out)
}
