// The townsfolk's window: a portrait, what they say (chosen from how the hero stands, first match wins), what they
// show (the healer the hero's HP, the elder the quest's progress, the mystic the three fortunes, the dog its pets)
// and at most one button. Pure: the click layer reports whole gestures, this decides the game actions they make.
import type { Game, Rarity } from '../types'
import type { Action, Run } from './game'
import { ASK, BOSS_EVERY, FORTUNE_SAID, STANDING, apply, fortuneCost, gambleCost, questReward, tradeInOf } from './game'
import { MARK, hpTones, HP_EMPTY, NUM_INK, mark } from './hud'
import { NPC_ART } from './pixelart'
import { themeOf } from './map'
import type { Theme } from './map'
import { BUTTON_H, PORTRAIT, artLabel, barLabel, button, buttonBox, buttonW, flatBar, onCell, portrait } from './pieces'
import type { ButtonState } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { BG, canvas } from './canvas'
import { RARITY_NAME, SLOTS } from './items'
import { INK, SURFACE } from './ui/tokens'

/** Whoever has a window of talk: the townsfolk but the merchant, the smith and the stash. */
export type Speaker = 'healer' | 'elder' | 'mystic' | 'guard' | 'villager' | 'dog'
export const SPEAKERS: readonly Speaker[] = ['healer', 'elder', 'mystic', 'guard', 'villager', 'dog']
export const isSpeaker = (panel: Game['panel']): panel is Speaker => (SPEAKERS as readonly string[]).includes(panel)

const TITLE: Readonly<Record<Speaker, string>> = { healer: 'HEALER', elder: 'ELDER', mystic: 'MYSTIC', guard: 'GUARD', villager: 'VILLAGER', dog: 'DOG' }
const CHROME: Readonly<Record<Speaker, (g: Game) => Chrome>> = {
  healer: () => ({ title: TITLE.healer }),
  elder: () => ({ title: TITLE.elder }),
  mystic: g => ({ title: TITLE.mystic, gold: g.gold }),
  guard: () => ({ title: TITLE.guard }),
  villager: () => ({ title: TITLE.villager }),
  dog: () => ({ title: TITLE.dog }),
}

/** What each fortune does, exactly, for the mystic's window and the text one. */
export const FORTUNE_NAME: Readonly<Record<NonNullable<Game['fortune']>['kind'], string>> = { luck: 'Luck: +15 crit chance', riches: 'Riches: half again the gold of a kill', insight: 'Insight: half again the XP of a kill' }
const FORTUNES = ['luck', 'riches', 'insight'] as const

/** The tier a trade-in gives for three of a tier. */
const NEXT_TIER: Readonly<Partial<Record<Rarity, Rarity>>> = { common: 'uncommon', uncommon: 'rare', rare: 'epic' }

const said = (text: string): Run[] => [{ text, color: INK.text }]
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
  mystic: g => {
    // The three fortunes under her words, the one in force marked.
    const fortunes = FORTUNES.map(kind => (g.fortune?.kind === kind ? [{ text: '> ', color: INK.gold, bold: true }, { text: FORTUNE_NAME[kind], color: INK.gold }] : [{ text: '  ' }, { text: FORTUNE_NAME[kind], dim: true }]))
    const words = g.fortune !== null ? [said(`"${FORTUNE_SAID[g.fortune.kind]}, until you change depth."`), aside('One fortune at a time.')]
      : g.gold >= fortuneCost(g) ? [said('"The cards favor those who pay for them."'), aside(`A fortune costs ${fortuneCost(g)} gold and lasts until you change depth.`)]
      : [said('"Come back when your purse is heavier."'), aside(`A fortune costs ${fortuneCost(g)} gold and lasts until you change depth.`)]
    return [...words, ...fortunes]
  },
  guard: g => {
    const three = tradeInOf(g)
    const trade = aside(three.length === 3
      ? `Trade in your ${three.map(i => i.name).join(', ')} for one ${RARITY_NAME[NEXT_TIER[three[0]!.rarity]!]} or better.`
      : 'Three spare pieces of a tier trade for one of the next, up to Epic.')
    const deepest = aside(`Your deepest: depth ${g.deepest}. Times fallen: ${g.deaths}.`)
    const guardian = nextGuardian(g)
    if (guardian - g.depth <= 1) return [said(`"A guardian holds the stairs of depth ${guardian}. Go ready."`), deepest, trade]
    if (themeOf(g.depth + 1) !== themeOf(g.depth)) return [said(`"Past depth ${g.depth}, they say, the halls turn ${THEME_WORD[themeOf(g.depth + 1)]}."`), deepest, trade]
    if (g.deaths > 0) return [said('"Fell down there and came back? Mind the stairs this time."'), deepest, trade]
    return [said('"The dungeon is through the portal. Mind the stairs."'), deepest, trade]
  },
  villager: g => {
    const pack = aside(`A sealed pack: ${gambleCost(g)} gold for an item of Uncommon or better, rarely an Epic or a Legendary.`)
    return g.stashed.length === 0 ? [said('"Your stash by the square keeps things safe between trips."'), pack]
      : g.quest === null && g.questsDone === 0 ? [said('"The elder pays well for a job done. Go and ask."'), pack]
      : !hasWorked(g) ? [said('"The smith can temper what you wear. Worth the gold."'), pack]
      : g.fortune === null ? [said('"The mystic in blue reads fortunes: luck, riches or insight."'), pack]
      : [said('"A pack from the road, sealed. Care to try your luck?"'), pack]
  },
  dog: g =>
    g.petted === 0 ? [said('The dog wags its tail and looks at you hopefully.')]
    : g.petted < 10 ? [said('The dog leans into your hand, tail going.')]
    : [said('The dog rolls over for a belly rub. Old friends now.')],
}

/**
 * Whether doing `action` would change the game beyond what is said: the rules are fixed by the game's own roll, so a
 * press that would be refused (no room for a quest's pay, a pack or a trade-in's gift) is known before it is made.
 */
const wouldAct = (g: Game, action: Action) => {
  // What every action says, resets or brings up to date (its lines, its toast, the walk it made, the codex) is no
  // change a press makes.
  const { log: _a, fresh: _b, toast: _c, walked: _d, codex: _e, ...after } = apply(g, action)
  const { log: _f, fresh: _g, toast: _h, walked: _i, codex: _j, ...before } = g
  return JSON.stringify(after) !== JSON.stringify(before)
}

/** The button a window has, if any: its key, label, price, what it does, and whether it can act now. */
type Act = { key: string; label: string; cost?: number; canPay?: boolean; action: Action; state: ButtonState }
const ACT: Readonly<Record<Speaker, (g: Game) => Act | undefined>> = {
  healer: () => undefined,
  elder: g => (g.quest === null ? undefined : { key: 'A', label: 'CLAIM', action: { kind: 'claim' }, state: g.quest.have >= g.quest.need && wouldAct(g, { kind: 'claim' }) ? 'armed' : 'off' }),
  mystic: g => ({ key: 'F', label: 'FORTUNE', cost: fortuneCost(g), canPay: g.gold >= fortuneCost(g), action: { kind: 'fortune' }, state: g.fortune === null && g.gold >= fortuneCost(g) ? 'ready' : 'off' }),
  guard: g => {
    const n = tradeInOf(g).length
    return { key: 'T', label: 'TRADE IN', action: { kind: 'tradeIn' }, state: n === 3 && wouldAct(g, { kind: 'tradeIn' }) ? 'ready' : 'off' }
  },
  villager: g => ({ key: 'G', label: 'GAMBLE', cost: gambleCost(g), canPay: g.gold >= gambleCost(g), action: { kind: 'gamble' }, state: g.gold >= gambleCost(g) && wouldAct(g, { kind: 'gamble' }) ? 'ready' : 'off' }),
  dog: () => ({ key: 'P', label: 'PET', action: { kind: 'pet' }, state: 'ready' }),
}
export const talkAction = (g: Game, who: Speaker) => ACT[who](g)

const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const WORDS_W = WINDOW_W - SIDE_X - 2

/** Words wrapped to the box's width (two cells of frame and padding each side), each run keeping its look. */
export const wrap = (lines: Run[][], width: number): Run[][] =>
  lines.flatMap(line => line.reduce((n, run) => n + run.text.length, 0) <= width ? [line] : line.flatMap(run => {
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
  const top = WINDOW_TOP
  const lines = wrap(WORDS[who](g), WORDS_W - 4)
  const box: OverlayBox<'words'> = { role: 'words', x: SIDE_X, y: (top + 2) / 2, w: WORDS_W, h: lines.length + 2, border: SURFACE.frame, lines }
  const statusY = (box.y + box.h) * 2 + 3
  const hasStatus = who === 'healer' || who === 'dog' || (who === 'elder' && g.quest !== null)
  const act = ACT[who](g)
  const buttonY = onCell(statusY + (hasStatus ? 8 : 0))
  const buttonRect: Rect | undefined = act === undefined ? undefined : { x: SIDE_X, y: buttonY, w: buttonW(act.label, act.cost), h: BUTTON_H }
  const sideEnd = buttonRect !== undefined ? buttonRect.y + BUTTON_H : hasStatus ? statusY + 6 : (box.y + box.h) * 2
  const end = Math.max(top + 2 + PORTRAIT, sideEnd)
  // Even, so the window ends on a whole cell.
  const height = Math.ceil((end + 3) / 2) * 2
  return { top, box, statusY, act, buttonRect, height }
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
const QUEST_FILL = INK.xp
const QUEST_EMPTY = SURFACE.xpEmpty

/** The text boxes over the window: what they say, the numbers on their bar, the button's words. */
export const talkOverlay = (g: Game, who: Speaker): OverlayBox[] => {
  const l = layout(g, who)
  const b = barOf(g, who)
  const at = statusBar(l.statusY)
  return [
    l.box,
    ...(b === undefined ? [] : [barLabel(at.x, at.y, at.w, b.share, b.color, b.empty, b.text)]),
    // The dog's pets beside its heart, on the mark's middle rows.
    ...(who === 'dog' ? [artLabel(`x ${g.petted}`, SIDE_X + 7, onCell(l.statusY + 1), NUM_INK, BG)] : []),
    ...(l.act === undefined || l.buttonRect === undefined ? [] : [buttonBox(l.act.label, l.buttonRect.x, l.buttonRect.y, l.act.state, l.act.cost, l.act.canPay)]),
  ]
}

const STATUS: Readonly<Record<Speaker, (c: ReturnType<typeof canvas>, g: Game, y: number) => void>> = {
  healer: () => undefined,
  elder: () => undefined,
  mystic: () => undefined,
  guard: () => undefined,
  villager: () => undefined,
  dog: (c, _g, y) => mark(c, MARK.heart, SIDE_X, y),
}

/** The window's pixels: title bar, portrait, status, button, and the words' frame. */
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
  if (l.act !== undefined && l.buttonRect !== undefined) button(body, l.act.label, l.buttonRect.x, l.buttonRect.y - l.top, l.act.state, l.act.cost)
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

/** What a click acts on, in window pixels: the button while it can act. */
export const talkHot = (g: Game, who: Speaker): Rect[] => {
  const l = layout(g, who)
  return l.buttonRect !== undefined && l.act !== undefined && l.act.state !== 'off' ? [l.buttonRect] : []
}
