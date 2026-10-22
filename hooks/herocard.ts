// The hero card: the hero as a picture and as a few lines of text, for the player to share where they like. The
// picture is the portrait in what they wear, who they are and how deep they went, the worn pieces, the codex's counts
// and the talents taken; written as an SVG, since a plugin writes text, not bytes. Pure: the pane writes the file and
// copies the text.
import type { Game } from '../types'
import { BIG_BOSSES, UNIQUES, firstCodex } from './game'
import { CLASS_NAME, LEGENDARIES, RARITY_NAME, SLOTS } from './items'
import { TALENTS } from './talents'
import { MARKS, markOf, roman, tierOf } from './deep'
import { heroArt } from './pixelart'
import { PORTRAIT, drawItem, portrait } from './pieces'
import { canvas, fill, frame } from './canvas'
import { word } from './window'
import { INK, SURFACE } from './ui/tokens'
import { countText } from './names'

export const CARD_W = 200
const PAD = 6
const LINE = 8
const SIDE_X = PAD + PORTRAIT + 6
const BOX_W = 13
const BOX_H = 23
const BOX_STEP = 14
const BG = SURFACE.print
const EDGE = SURFACE.cardEdge
/** Talent names a card line holds. */
const TALENTS_A_LINE = 3
/** The scale the SVG is drawn at: a card pixel this many across. */
export const CARD_SCALE = 4

const codexOf = (g: Game) => g.codex ?? firstCodex(g)
const legendariesFound = (g: Game) => codexOf(g).legendaries.filter(n => LEGENDARIES.some(l => l.name === n)).length

/** Where the deepest depth was, and its tier's mark past depth 50. */
const deepest = (g: Game) => {
  const tier = tierOf(g.deepest)
  return tier === 0 ? `${g.deepest}` : `${g.deepest}  TIER ${roman(tier)}`
}

/** The talents taken, upper case, a line each TALENTS_A_LINE; none yet, said. */
const talentLines = (g: Game) => {
  const names = (g.talents ?? []).map(t => TALENTS[t].name.toUpperCase())
  if (names.length === 0) return ['NO TALENTS YET']
  const lines = []
  for (let i = 0; i < names.length; i += TALENTS_A_LINE) lines.push(names.slice(i, i + TALENTS_A_LINE).join('  '))
  return [`TALENTS ${lines[0]}`, ...lines.slice(1)]
}

/** What the card says beside the portrait, a line each: who, how deep, the kills and deaths, the heroes retired if any. */
export const cardHead = (g: Game) => {
  const c = codexOf(g)
  const retired = c.retired ?? 0
  return [
    { text: `LEVEL ${g.level} ${CLASS_NAME[g.cls].toUpperCase()}`, ink: INK.gold },
    { text: `DEEPEST ${deepest(g)}`, ink: INK.text },
    { text: `KILLS ${countText(c.kills)}  DEATHS ${countText(c.deaths)}`, ink: INK.dim },
    ...(retired > 0 ? [{ text: `${retired} ${retired === 1 ? 'HERO' : 'HEROES'} RETIRED`, ink: INK.dim }] : []),
  ]
}

/** The card's pixels. */
export const cardPixels = (g: Game): string[][] => {
  const c = codexOf(g)
  const talents = talentLines(g)
  const height = PAD + PORTRAIT + 4 + BOX_H + 5 + 4 + 2 * LINE + 2 + talents.length * LINE + 2 + LINE
  const body = canvas(CARD_W, height)
  fill(body, 0, 0, CARD_W, height, BG)
  portrait(body, heroArt(g), PAD, PAD)
  cardHead(g).forEach((l, i) => word(body, l.text, SIDE_X, PAD + 1 + i * LINE, l.ink))
  let y = PAD + PORTRAIT + 4
  SLOTS.forEach((slot, i) => {
    const item = g.gear[slot]
    const x = PAD + i * BOX_STEP
    if (item === undefined) frame(body, x, y, BOX_W, BOX_H, EDGE)
    else drawItem(body, g, item, x, y, BOX_W, BOX_H)
  })
  y += BOX_H + 5
  fill(body, PAD, y, CARD_W - 2 * PAD, 1, SURFACE.line)
  y += 4
  word(body, `UNIQUES ${c.uniques.length} OF ${Object.keys(UNIQUES).length}   BIG BOSSES ${c.bigs.length} OF ${Object.keys(BIG_BOSSES).length}`, PAD, y, INK.text)
  word(body, `LEGENDARIES ${legendariesFound(g)} OF ${LEGENDARIES.length}   GOLD FOUND ${countText(c.gold)}`, PAD, y + LINE, INK.text)
  y += 2 * LINE + 2
  talents.forEach((t, i) => word(body, t, PAD, y + i * LINE, INK.dim))
  y += talents.length * LINE + 2
  word(body, 'ASCII DUNGEON', PAD, y, EDGE)
  frame(body, 0, 0, CARD_W, height, EDGE)
  return body.px
}

/** The card as text, to paste: who, how deep, the records, the codex's counts, what is worn and the talents. */
export const cardText = (g: Game): string => {
  const c = codexOf(g)
  const tier = tierOf(g.deepest)
  const where = tier === 0 ? '' : ` (tier ${roman(tier)}, ${MARKS[markOf(g, tier)].name})`
  const worn = SLOTS.flatMap(slot => (g.gear[slot] === undefined ? [] : [`${g.gear[slot]!.name} (${RARITY_NAME[g.gear[slot]!.rarity]})`]))
  const talents = (g.talents ?? []).map(t => TALENTS[t].name)
  return [
    `ASCII Dungeon: Level ${g.level} ${CLASS_NAME[g.cls]}, deepest depth ${g.deepest}${where}`,
    `Kills ${countText(c.kills)}, deaths ${countText(c.deaths)}, gold found ${countText(c.gold)}${(c.retired ?? 0) > 0 ? `, heroes retired ${c.retired}` : ''}`,
    `Uniques ${c.uniques.length} of ${Object.keys(UNIQUES).length}, big bosses ${c.bigs.length} of ${Object.keys(BIG_BOSSES).length}, Legendaries ${legendariesFound(g)} of ${LEGENDARIES.length}`,
    `Wearing: ${worn.join(', ') || 'nothing'}`,
    `Talents: ${talents.join(', ') || 'none yet'}`,
  ].join('\n')
}

/** Pixels as an SVG, a run of one color along a row a rectangle, each pixel `scale` across. */
export const svgOf = (px: readonly (readonly string[])[], scale = CARD_SCALE): string => {
  const h = px.length
  const w = px[0]?.length ?? 0
  const rects: string[] = []
  px.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ink = row[x]!
      let end = x + 1
      while (end < row.length && row[end] === ink) end += 1
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${ink}"/>`)
      x = end
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`
}
