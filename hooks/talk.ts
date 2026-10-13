// The townsfolk's window: a portrait, what they say (chosen from how the hero stands, first match wins), what they
// show (the healer the hero's HP, the elder the quest's progress, the mystic the three fortunes, the dog its pets)
// and at most one button. Pure: the click layer reports whole gestures, this decides the game actions they make.
import type { Game } from '../types'
import type { Action, Run } from './game'
import { ASK, BOSS_EVERY, FORTUNE_SAID, STANDING, fortuneCost, questReward } from './game'
import { MARK, hpTones, HP_EMPTY, NUM_INK, mark } from './hud'
import { NPC_ART } from './pixelart'
import { themeOf } from './map'
import type { Theme } from './map'
import { BUTTON_H, CURSOR, GOLD_INK, PORTRAIT, barLabel, button, buttonW, flatBar, portrait } from './pieces'
import type { ButtonState } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { canvas, digits, fill, frame } from './canvas'
import { SLOTS } from './items'

/** Whoever has a window of talk: the townsfolk but the merchant, the smith and the stash. */
export type Speaker = 'healer' | 'elder' | 'mystic' | 'guard' | 'villager' | 'dog'
export const SPEAKERS: readonly Speaker[] = ['healer', 'elder', 'mystic', 'guard', 'villager', 'dog']
export const isSpeaker = (panel: Game['panel']): panel is Speaker => (SPEAKERS as readonly string[]).includes(panel)

const TITLE: Readonly<Record<Speaker, string>> = { healer: 'HEALER', elder: 'ELDER', mystic: 'MYSTIC', guard: 'GUARD', villager: 'VILLAGER', dog: 'DOG' }
const CHROME: Readonly<Record<Speaker, (g: Game) => Chrome>> = {
  healer: () => ({ title: TITLE.healer, labels: [] }),
  elder: () => ({ title: TITLE.elder, labels: [] }),
  mystic: g => ({ title: TITLE.mystic, gold: g.gold, labels: [] }),
  guard: () => ({ title: TITLE.guard, labels: [] }),
  villager: () => ({ title: TITLE.villager, labels: [] }),
  dog: () => ({ title: TITLE.dog, labels: [] }),
}

/** What each fortune does, exactly, for the mystic's window and the text one. */
export const FORTUNE_NAME: Readonly<Record<NonNullable<Game['fortune']>['kind'], string>> = { luck: 'Luck: +15 crit chance', riches: 'Riches: half again the gold of a kill', insight: 'Insight: half again the XP of a kill' }
const FORTUNES = ['luck', 'riches', 'insight'] as const
/** Each fortune's row in pixels: its name, and what it does in the pixel font's few signs. */
const FORTUNE_ROW: Readonly<Record<(typeof FORTUNES)[number], readonly [string, string]>> = { luck: ['LUCK', '+15 CRIT'], riches: ['RICHES', '+1/2 GOLD'], insight: ['INSIGHT', '+1/2 XP'] }

const SAY = '#e8e4dc'
const said = (text: string): Run[] => [{ text, color: SAY }]
const aside = (text: string): Run[] => [{ text, dim: true }]

/** The next boss depth not yet won, from the depth the hero left. */
const nextGuardian = (g: Game) => {
  const at = Math.max(BOSS_EVERY, Math.ceil(g.depth / BOSS_EVERY) * BOSS_EVERY)
  return at > g.bossSlain ? at : at + BOSS_EVERY
}
const THEME_WORD: Readonly<Record<Theme, string>> = { crypt: 'to old tombs', flooded: 'to flooded halls', fungal: 'to fungal caves', frozen: 'to halls of ice', forge: 'to forges and slag' }
const hasWorked = (g: Game) => g.reforges > 0 || SLOTS.some(s => (g.gear[s]?.temper ?? 0) > 0)

/** What each says, first match wins: their words, then a dim line of what it means. */
const WORDS: Readonly<Record<Speaker, (g: Game) => Run[][]>> = {
  healer: g =>
    g.mended === 0 ? [said('"Not a scratch on you. Off you go, then."'), aside('Healing is free in town.')]
    : g.mended * 2 >= g.maxHp ? [said('"You were barely standing! Lie still... there."'), aside(`+${g.mended} HP. Healing is free in town.`)]
    : [said('"Hold still. There, good as new."'), aside(`+${g.mended} HP. Healing is free in town.`)],
  elder: g => {
    const q = g.quest
    if (q === null) return [said('"Well done. Here is what I promised."'), aside(`Quests done: ${g.questsDone}.`)]
    const pays = aside(`Pays ${questReward(q)} gold and an item of Uncommon or better.`)
    if (q.have >= q.need) return [said('"Make room in your bag for your reward, then claim it."'), pays]
    return [said(`"${(q.have === 0 ? ASK : STANDING)[q.kind](q)}"`), pays]
  },
  mystic: g =>
    g.fortune !== null ? [said(`"${FORTUNE_SAID[g.fortune.kind]}, until you change depth."`), aside('One fortune at a time.')]
    : g.gold >= fortuneCost(g) ? [said('"The cards favor those who pay for them."'), aside(`A fortune costs ${fortuneCost(g)} gold and lasts until you change depth.`)]
    : [said('"Come back when your purse is heavier."'), aside(`A fortune costs ${fortuneCost(g)} gold and lasts until you change depth.`)],
  guard: g => {
    const deepest = aside(`Your deepest: depth ${g.deepest}. Times fallen: ${g.deaths}.`)
    const guardian = nextGuardian(g)
    if (guardian - g.depth <= 1) return [said(`"A guardian holds the stairs of depth ${guardian}. Go ready."`), deepest]
    if (themeOf(g.depth + 1) !== themeOf(g.depth)) return [said(`"Past depth ${g.depth}, they say, the halls turn ${THEME_WORD[themeOf(g.depth + 1)]}."`), deepest]
    if (g.deaths > 0) return [said('"Fell down there and came back? Mind the stairs this time."'), deepest]
    return [said('"The dungeon is through the portal. Mind the stairs."'), deepest]
  },
  villager: g =>
    g.stashed.length === 0 ? [said('"Your stash by the square keeps things safe between trips."')]
    : g.quest === null && g.questsDone === 0 ? [said('"The elder pays well for a job done. Go and ask."')]
    : !hasWorked(g) ? [said('"The smith can temper what you wear. Worth the gold."')]
    : g.fortune === null ? [said('"The mystic in blue reads fortunes: luck, riches or insight."')]
    : [said('"Fine day for it."')],
  dog: g =>
    g.petted === 0 ? [said('The dog wags its tail and looks at you hopefully.')]
    : g.petted < 10 ? [said('The dog leans into your hand, tail going.')]
    : [said('The dog rolls over for a belly rub. Old friends now.')],
}

/** The button a window has, if any: its key, label, price, what it does, and whether it can act now. */
type Act = { key: string; label: string; cost?: number; canPay?: boolean; action: Action; state: ButtonState }
const ACT: Readonly<Record<Speaker, (g: Game) => Act | undefined>> = {
  healer: () => undefined,
  elder: g => (g.quest === null ? undefined : { key: 'C', label: 'CLAIM', action: { kind: 'claim' }, state: g.quest.have >= g.quest.need ? 'armed' : 'off' }),
  mystic: g => ({ key: 'F', label: 'FORTUNE', cost: fortuneCost(g), canPay: g.gold >= fortuneCost(g), action: { kind: 'fortune' }, state: g.fortune === null && g.gold >= fortuneCost(g) ? 'ready' : 'off' }),
  guard: () => undefined,
  villager: () => undefined,
  dog: () => ({ key: 'P', label: 'PET', action: { kind: 'pet' }, state: 'ready' }),
}
export const talkAction = (g: Game, who: Speaker) => ACT[who](g)

const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const WORDS_W = WINDOW_W - SIDE_X - 2
const FORTUNE_ROW_H = 9

/** Words wrapped to the box's width (two cells of frame and padding each side), each run keeping its look. */
export const wrap = (lines: Run[][], width: number): Run[][] =>
  lines.flatMap(line => line.flatMap(run => {
    const out: Run[][] = []
    let rest = run.text
    while (rest.length > width) {
      const cut = rest.lastIndexOf(' ', width)
      const at = cut > 0 ? cut : width
      out.push([{ ...run, text: rest.slice(0, at) }])
      rest = rest.slice(at).trimStart()
    }
    out.push([{ ...run, text: rest }])
    return out
  }))

/** Where everything goes, in window pixels: the words' box, then the status and the button beside the portrait. */
const layout = (g: Game, who: Speaker) => {
  const top = bodyTop(CHROME[who](g))
  const lines = wrap(WORDS[who](g), WORDS_W - 4)
  const box: OverlayBox<'words'> = { role: 'words', x: SIDE_X, y: (top + 2) / 2, w: WORDS_W, h: lines.length + 2, border: '#6b6258', lines }
  const statusY = (box.y + box.h) * 2 + 3
  const hasStatus = who === 'healer' || who === 'dog' || (who === 'elder' && g.quest !== null)
  const act = ACT[who](g)
  const buttonY = statusY + (hasStatus ? 8 : 0)
  const buttonRect: Rect | undefined = act === undefined ? undefined : { x: SIDE_X, y: buttonY, w: buttonW(act.key, act.label, act.cost), h: BUTTON_H }
  const sideEnd = buttonRect !== undefined ? buttonRect.y + BUTTON_H : hasStatus ? statusY + 6 : (box.y + box.h) * 2
  const fortunesY = Math.max(top + 2 + PORTRAIT, sideEnd) + 4
  const end = who === 'mystic' ? fortunesY + FORTUNES.length * (FORTUNE_ROW_H + 1) : Math.max(top + 2 + PORTRAIT, sideEnd)
  // Even, so the window ends on a whole cell.
  const height = Math.ceil((end + 3) / 2) * 2
  return { top, box, statusY, act, buttonRect, fortunesY, height }
}

/** The window's height in pixels, for the pane to size its drawing. */
export const talkHeight = (g: Game, who: Speaker) => layout(g, who).height

/** A status bar beside its mark, in window pixels: on an odd row, its number on its middle, as wide as the words' box less the mark. */
const statusBar = (statusY: number) => ({ x: SIDE_X + 7, y: Math.floor((statusY + 2) / 2) * 2 + 1, w: WORDS_W - 7 })

/** What a speaker's bar shows, if they have one: the healer the hero's HP, the elder the quest's progress. */
const barOf = (g: Game, who: Speaker): { share: number; color: string; empty: string; text: string } | undefined => {
  if (who === 'healer') {
    const share = Math.max(0, g.hp) / g.maxHp
    return { share, color: hpTones(share)[1], empty: HP_EMPTY, text: `${Math.max(0, g.hp)}/${g.maxHp}` }
  }
  if (who === 'elder' && g.quest !== null) return { share: g.quest.have / g.quest.need, color: QUEST_FILL, empty: QUEST_EMPTY, text: `${g.quest.have}/${g.quest.need}` }
  return undefined
}
const QUEST_FILL = '#d9b54a'
const QUEST_EMPTY = '#2a2618'

/** The text boxes over the window: what they say, and the numbers on their bar. */
export const talkOverlay = (g: Game, who: Speaker): OverlayBox[] => {
  const l = layout(g, who)
  const b = barOf(g, who)
  if (b === undefined) return [l.box]
  const at = statusBar(l.statusY)
  return [l.box, barLabel(at.x, at.y, at.w, b.share, b.color, b.empty, b.text)]
}

const STATUS: Readonly<Record<Speaker, (c: ReturnType<typeof canvas>, g: Game, y: number) => void>> = {
  healer: () => undefined,
  elder: () => undefined,
  mystic: () => undefined,
  guard: () => undefined,
  villager: () => undefined,
  dog: (c, g, y) => {
    mark(c, MARK.heart, SIDE_X, y)
    word(c, `X ${g.petted}`, SIDE_X + 7, y, NUM_INK)
  },
}

const FORTUNE_EDGE = '#3a3644'
const FORTUNE_BG = '#15131b'
const FORTUNE_DIM = '#8a8494'

/** The mystic's three fortunes, a row each: name and what it does; the one in force framed white, its name in gold. */
const fortuneRows = (c: ReturnType<typeof canvas>, g: Game, y0: number) =>
  FORTUNES.forEach((kind, i) => {
    const y = y0 + i * (FORTUNE_ROW_H + 1)
    const isOn = g.fortune?.kind === kind
    fill(c, PAD, y, WINDOW_W - 2 * PAD, FORTUNE_ROW_H, FORTUNE_BG)
    frame(c, PAD, y, WINDOW_W - 2 * PAD, FORTUNE_ROW_H, isOn ? CURSOR : FORTUNE_EDGE)
    const [name, does] = FORTUNE_ROW[kind]
    word(c, name, PAD + 3, y + 2, isOn ? GOLD_INK : SAY)
    const doesW = does.length * 4 - 1
    word(c, does, WINDOW_W - PAD - 3 - doesW, y + 2, isOn ? SAY : FORTUNE_DIM)
  })

/** The window's pixels: title bar, portrait, status, button, the mystic's fortunes, and the words' frame. */
export const talkPixels = (g: Game, who: Speaker): string[][] => {
  const l = layout(g, who)
  const body = canvas(WINDOW_W, l.height - l.top)
  portrait(body, NPC_ART[who], PAD, 2)
  STATUS[who](body, g, l.statusY - l.top)
  const b = barOf(g, who)
  if (b !== undefined) {
    const at = statusBar(l.statusY)
    mark(body, who === 'healer' ? MARK.heart : MARK.xp, SIDE_X, at.y - l.top)
    flatBar(body, at.x, at.y - l.top, at.w, b.share, b.color, b.empty)
  }
  if (l.act !== undefined && l.buttonRect !== undefined) button(body, l.act.key, l.act.label, l.buttonRect.x, l.buttonRect.y - l.top, l.act.state, l.act.cost, l.act.canPay)
  if (who === 'mystic') fortuneRows(body, g, l.fortunesY - l.top)
  const c = windowPixels(CHROME[who](g), body.px)
  drawBox(c, l.box)
  return c.px
}

/** The game actions for one gesture: the button when it can act, the close box; anything else, nothing. */
export const talkGesture = (g: Game, who: Speaker, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const l = layout(g, who)
  const r = l.buttonRect
  if (r !== undefined && l.act !== undefined && l.act.state !== 'off' && isInside(at, r.x, r.y, r.w, r.h)) return [l.act.action]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: who }] : []
}
