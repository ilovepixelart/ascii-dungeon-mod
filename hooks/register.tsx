import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, ToolCallInput } from 'claude-code'

import type { Consumable, Game, HeroClass } from '../types'
import { TOWN_TALK } from './town'
import { SHOP_PRICES, STASH_SIZE, alongTheWay, keptChoice, apply, isOnlyAWalk, classAbout, fortuneCost, newGame, normalize, onToolStart, questLine, questReward, reforgeCost, threat } from './game'
import type { Action, Run } from './game'
import { BELT_SIZE, CONSUMABLES } from './consumables'
import { FRAME_MS, LATE_MS, createSamples, createTicker } from './frames'
import type { FrameSummary, TickStats } from './frames'
import { hudCells, hudHit, hudLayout } from './hud'
import { INV_H, INV_TOP, INV_W, beltLabel, inventoryScreenCells, itemCard } from './inventory'
import { BAG_UI_IDLE, bagGesture, bagOverlay } from './bagui'
import type { BagUi, Gesture } from './bagui'
import { SHOP_H, SHOP_UI_IDLE, nextWare, shopGesture, shopOverlay, shopPixels, whyNot } from './shop'
import type { ShopUi } from './shop'
import type { OverlayBox } from './window'
import { canvasCells } from './canvas'
import { FORGE_UI_IDLE, chosenSlot, forgeGesture, forgeHeight, forgeOverlay, forgePixels, nextWorn, whyNotReforge, whyNotTemper } from './forge'
import type { ForgeUi } from './forge'
import { CHEST_H, CHEST_UI_IDLE, chestGesture, chestOverlay, chestPixels, nextStored, whyNotStore, whyNotTake } from './chest'
import type { ChestUi } from './chest'
import { CLASSES as HEROES, begin, isUnderWay, startGesture, startHeight, startOverlay, startPixels } from './start'
import type { StartUi } from './start'
import { openingGame } from './save'
import { SHEET_H, sheetGesture, sheetOverlay, sheetPixels } from './sheet'
import { COMPACT_H, COMPACT_W, compactGesture, compactOverlay, compactPixels } from './compact'
import { FORTUNE_NAME, isSpeaker, talkAction, talkGesture, talkHeight, talkOverlay, talkPixels } from './talk'
import { CLASS_NAME, RARITY_COLOR, SLOTS, TEMPER_MAX, junkValue, temperCost, whyNotBuyBack } from './items'
import { MAP_H, MAP_W } from './map'
import { ATTRIBUTES, bagRows, foeRuns, logRuns, mapRows, statusRuns } from './panels'
import { PX } from './pixelart'
import { FRAMES_PER_TILE, STILL, walkState, benchRoute, clickToTile, hitFramesFor, hitsBetween, isStrideFrame, pixelMap, tileCamera, walkPosition, walkingGame } from './pixels'
import type { Ambient, Hit } from './pixels'
import { MUSIC_GAIN, channel, gainOf, musicFor, soundAsset, soundFor, stepAt } from './sounds'
import type { Channel, Sound } from './sounds'
import { CLIP_MS } from './clips'
import { PX as TILE_PX } from './pixelart'
import type { Pos } from './map'
import { TILE_H, zoomedRows } from './sprites'

const PANE = 'dungeon'
/** Docked, the pane asks to be wide enough for the pixel inventory window and the dashboard with its belt beside the bars. */
const OPEN = { id: PANE, title: 'Dungeon', columns: 112 }
const SAVE = 'save'
/** How long the bench walk is: long enough for the camera to scroll and the torch to move many times. */
const BENCH_TILES = 40
/** The bench's level: a fixed one, every tile explored, so each run crosses the same lit ground whatever the save holds. */
export const BENCH_SEED = 21
const GAME_REF = { plugin: 'ascii-dungeon', key: 'game' } as const
const game = atom(GAME_REF, newGame())

/**
 * The walk on screen: the tiles from where the hero stood, the frame it is on, the game as it began and the game now.
 * The ticker plays it a frame a tick, so the hero always moves the same few pixels a frame. The game now is kept here, each
 * action replacing it, rather than read back every frame: a read hands back a fresh copy, and what is drawn is kept
 * per game object.
 */
/** The walk playing: its path and frame, the game it set out from and is going to, and, where the walk can be cut into
 * tiles, the game on each tile and the last one shown. */
let walk: { path: Pos[]; frame: number; start: Game; game: Game; tiles: Game[] | null; shown: Game | null } | null = null
/** The runtime's fine clock where it has one, for timing a tick's work; the host's clock counts whole ms. */
const fineNow = () => (globalThis as { performance?: { now: () => number } }).performance?.now() ?? 0
const ticker = createTicker(fineNow)
/** How long the host takes to take a repainted map, and how long drawing the whole pane takes (on every change). */
const repaints = createSamples()
const redraws = createSamples()
/** The inventory screen's own state: an open menu, an item being dragged. */
let bagUi: BagUi = BAG_UI_IDLE
let shopUi: ShopUi = SHOP_UI_IDLE
let forgeUi: ForgeUi = FORGE_UI_IDLE
let chestUi: ChestUi = CHEST_UI_IDLE
let startUi: StartUi | null = null
/** The pixel map's mounted size, which a repaint must match. */
let mapSize: { columns: number; rows: number } | null = null
/** Where the camera looks, in world pixels, and in which place: it holds still while the hero stays mid-view. */
let camera: { at: Pos; place: string } | null = null
/** Whether the pane last drew the pixel dashboard, with no log under it: messages then come as toasts. */
let isPixelDash = false

/** The place the hero is in: the town, or a depth of the dungeon. */
const placeOf = (g: Game) => (g.where === 'town' ? 'town' : `depth ${g.depth}`)

/** The camera for this frame: recentered in a new place, else following the hero only out of the view's middle. */
const cameraFor = (g: Game, hero: Pos, columns: number, rows: number) => {
  const at = tileCamera(camera === null || camera.place !== placeOf(g) ? null : camera.at, hero, columns, rows * 2)
  camera = { at, place: placeOf(g) }
  return at
}
/** The pane's width, in columns, from which it draws the pixel strip. */
const HUD_COLUMNS = 80

/** What a pane too narrow for the pixel views is told: which need more room, and how much. */
export const widthNote = (columns: number) => {
  if (columns < HUD_COLUMNS) return `Widen the pane for the pixel strip and inventory (${HUD_COLUMNS} columns) and the full windows (${INV_W}); it is ${columns}.`
  if (columns < INV_W) return `Widen the pane for the full pixel windows, the town's and the character sheet (${INV_W} columns); it is ${columns}.`
  return undefined
}

/** The classes a new game can be, in the order the sheet offers them. */
const CLASSES: readonly HeroClass[] = ['knight', 'mage', 'rogue']

const tileCenter = (g: Game): Pos => ({ x: g.x * TILE_PX + TILE_PX / 2, y: g.y * TILE_PX + TILE_PX / 2 })

/** The character sheet's rows: its title, a row per attribute, a blank, the new-game row and a line per class. */
const SHEET_ROWS = 3 + ATTRIBUTES.length
/** The rows a panel under the dashboard takes: its title, a row per ware or worn slot, and its close row. */
const PANEL_ROWS: Partial<Record<Game['panel'], number>> = { sheet: SHEET_ROWS, shop: 3 + Object.keys(SHOP_PRICES).length, forge: 2 + SLOTS.length, stash: 3 + STASH_SIZE, healer: 3, elder: 5, mystic: 4, guard: 3, villager: 3, dog: 4 }

/** The townsfolk without work, by window: who they are, as their window's title says. */
const TALKER_NAME: Readonly<Record<'guard' | 'villager' | 'dog', string>> = { guard: 'The guard', villager: 'A villager', dog: 'The dog' }

/** The undo key's label: what it would buy back and for how much, or that there is nothing. */
const undoLabel = (g: Game) => {
  const sold = g.lastSold
  if (sold === null) return 'Undo sale'
  const what = sold.items.length === 1 ? sold.items[0]!.name : `${sold.items.length} items`
  return `Undo sale: ${what} (${sold.coins} gold)`
}

const VIEW_LABEL: Readonly<Record<Game['zoom'], string>> = { 1: 'view: map', 2: 'view: ASCII', 3: 'view: pixel' }

const stopWalk = () => {
  ticker.stop('walk')
  walk = null
}

/**
 * The game as drawn at a frame of the walk: as of the tile the drawn hero has reached (`walkState`), for map, strip
 * and log alike; a walk with no tiles of its own (the bench's) hides only what lies ahead of him.
 */
const drawnAt = (g: Game, frame: number) => {
  if (walk === null) return g
  return walk.tiles !== null ? walkState(walk.start, walk.tiles, frame) : walkingGame(g, walk.start, walk.path, frame)
}


/** Where the hero is drawn now and the game as drawn, while a walk plays; the hero undefined once it is over. */
const walkingAt = (g: Game) => {
  if (walk === null) return { heroAt: undefined, drawn: g }
  const at = walkPosition(walk.path, walk.frame)
  // Mid-walk the map is the walk's own game, as its frames draw it: the stored one has not taken the walk yet.
  return at.isDone ? { heroAt: undefined, drawn: g } : { heroAt: at, drawn: drawnAt(walk.game, walk.frame) }
}

/** One frame of the walk, repainted in place; the last one hands back to the ordinary drawing. Answers whether it goes on. */
/**
 * The map's cells last sent to the terminal, to leave out a frame that would show the same: a blow's number rises a
 * pixel every other frame and its first frame is held, so about half of a blow's frames repeat the one before.
 * Cleared whenever the pane draws the map itself.
 */
let lastMap: string | null = null
/** Sends the map's cells, unless they are what the terminal already shows; a send left out counts as painted. */
export const sendMap = async ($: EngineInterface, cells: string, size: { columns: number; rows: number }) => {
  if (cells === lastMap) {
    unsent += 1
    return { deny: undefined }
  }
  const painted = await $.ui.blit({ requestId: PANE, key: 'map', cells, ...size }).catch(() => ({ deny: 'failed' }))
  lastMap = painted.deny === undefined ? cells : null
  return painted
}
/** Frames left out as repeats, for the frames report. */
let unsent = 0
/** The map as the pane itself draws it: what the terminal shows from then on. */
const drawnMap = (cells: string) => {
  lastMap = cells
  return cells
}

const walkFrame = async ($: EngineInterface, frame: number) => {
  const w = walk
  if (w === null || mapSize === null) return false
  w.frame = frame
  const at = walkPosition(w.path, frame)
  // A tile reached: what happened on it shows now, the strip and log redrawn, its toast and sound played.
  const reached = frame % FRAMES_PER_TILE === 0 ? w.tiles?.[frame / FRAMES_PER_TILE - 1] : undefined
  if (reached !== undefined && reached !== w.game) {
    const shown = w.shown ?? w.start
    const { toast, sound } = tellOnTheWay(w, reached, pending?.byHand ?? false, !isPixelDash || reached.panel === 'bag')
    w.shown = reached
    if (toast !== null) $.ui.toast(toast)
    if (isSoundOn && sound !== undefined) void playEffect($, sound)
    if (reached.log !== shown.log) $.ui.invalidate('ui.render')
  }
  const step = isSoundOn && !at.isDone ? stepAt(frame) : undefined
  if (step !== undefined) void playEffect($, step)
  // Over, or a repaint refused (the pane closed, its size changed): a click it was walking for is carried out, and the
  // ordinary drawing takes over.
  const end = async () => {
    if (walk === w) walk = null
    await settle($)
    const after = hitsAfterWalk
    hitsAfterWalk = null
    if (after !== null && walk === null) playHits($, after.g, after.hits)
    $.ui.invalidate('ui.render')
    // A click that waited for this walk goes now.
    const waiting = queued
    queued = null
    if (waiting !== null) await act($, waiting.action, waiting.byHand)
    return false
  }
  if (at.isDone) return end()
  const view = cameraFor(w.game, at, mapSize.columns, mapSize.rows)
  const cells = pixelMap(drawnAt(w.game, frame), mapSize.columns, mapSize.rows, at, view, [], 0, isStrideFrame(frame))
  const t0 = fineNow()
  const painted = await sendMap($, cells, mapSize)
  repaints.add(fineNow() - t0)
  return painted.deny === undefined || (await end())
}

const startWalk = ($: EngineInterface, path: Pos[], start: Game, game: Game, tiles: Game[] | null = null) => {
  walk = { path, frame: 0, start, game, tiles, shown: null }
  ticker.start('walk', frame => walkFrame($, frame), () => $.clock.every(FRAME_MS, () => void $.clock.now().then(ticker.tick)))
}

const ms = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(1))
/**
 * The measure in words: how evenly ticks come, how long a tick takes, how much of that is the host taking the
 * repainted map, and how long a whole-pane redraw takes.
 */
export const framesReport = (s: TickStats, repaint: FrameSummary, redraw: FrameSummary) =>
  s.ticks === 0
    ? 'No frames played yet: walk somewhere first.'
    : `${s.ticks} ticks, ${s.late} late (over ${ms(LATE_MS)} ms after the last), ${s.skipped} skipped while a frame was drawing. ` +
      `Gap between ticks: p50 ${ms(s.interval.p50)}, p99 ${ms(s.interval.p99)}, max ${ms(s.interval.max)} ms. ` +
      `Drawing a tick: p50 ${ms(s.work.p50)}, p99 ${ms(s.work.p99)}, max ${ms(s.work.max)} ms (budget ${FRAME_MS}), ` +
      `of which the host taking the map: p50 ${ms(repaint.p50)}, p99 ${ms(repaint.p99)}, max ${ms(repaint.max)} ms. ` +
      `Whole-pane redraws: ${redraw.count}, p50 ${ms(redraw.p50)}, p99 ${ms(redraw.p99)}, max ${ms(redraw.max)} ms.`

/**
 * What to toast after an action: the game's own news first; with no log on screen, also what a click of the player's
 * came to, and a new foe with its threat.
 */
export const toastFor = (before: Game, next: Game, byHand: boolean, hasLog: boolean): string | null => {
  if (next.toast !== null) return next.toast
  if (hasLog) return null
  if (byHand && next.fresh > 0) return next.log.at(-1) ?? null
  const foe = next.foe
  if (foe !== null && (before.foe?.name !== foe.name || before.foe.maxHp !== foe.maxHp)) return `A ${foe.name} emerges: ${threat(next)}.`
  return null
}

/** A click the hero is walking to carry out: the rules take it when the walk ends, not when it is made. */
let pending: { action: Action; byHand: boolean; isOnlyAWalk?: boolean } | null = null

/** Whether a walk from `before` to `next` plays on screen: a pixel map, and the hero still in the same place. */
const isPlayed = (before: Game, next: Game) => next.walked.length > 0 && placeOf(next) === placeOf(before) && (next.zoom >= 3 || isPixelDash)

/**
 * What is new in `next` since `shown`, a state the same action's walk already showed: only the log lines after it and
 * a toast it had not; `next` as it is when nothing was shown.
 */
const since = (shown: Game | null, next: Game): Game =>
  shown === null ? next : { ...next, fresh: Math.max(0, next.fresh - shown.fresh), toast: next.toast === shown.toast ? null : next.toast }

/**
 * The toast and the sound for a step of the game: `next` against `from`, the game last shown, telling only what `next`
 * adds to `shown` when the same action's walk already showed some of it.
 */
export const announce = (shown: Game | null, from: Game, next: Game, byHand: boolean, hasLog: boolean, hits: readonly Hit[]) => {
  const told = since(shown, next)
  return { toast: toastFor(from, told, byHand, hasLog), sound: soundFor(from, told, hits) }
}

/** What a walk tells on reaching a tile: what is new against the tile it last told, or its start before the first. */
export const tellOnTheWay = (walked: { start: Game; shown: Game | null }, reached: Game, byHand: boolean, hasLog: boolean) =>
  announce(walked.shown, walked.shown ?? walked.start, reached, byHand, hasLog, [])

/** What an action tells once carried out: what its walk did not already tell on the way (`shown`, its last tile). */
export const tellAtTheEnd = (shown: Game | undefined, before: Game, next: Game, byHand: boolean, hasLog: boolean, hits: readonly Hit[]) =>
  announce(shown ?? null, shown ?? before, next, byHand, hasLog, hits)

/** Applies an action now; `isWalkShown` when its walk has already played, so it is not played again. */
const commit = async ($: EngineInterface, action: Action, byHand: boolean, isWalkShown: boolean, shown?: Game) => {
  const before = normalize(await read($, game))
  const next = normalize(await update($, game, g => apply(g, action)))
  if (!isWalkShown && isPlayed(before, next)) startWalk($, [{ x: before.x, y: before.y }, ...next.walked], before, next)
  else if (next.walked.length > 0) stopWalk()
  // What happens to the foe mid-walk, a tool call striking it, shows at once; the walk keeps drawing the click's plan.
  else if (walk !== null) walk = { ...walk, start: { ...walk.start, foe: next.foe }, game: pending === null ? next : walk.game }
  const hits = hitsBetween(before, next)
  // What the walk already showed on its way is not told again.
  const { toast, sound } = tellAtTheEnd(shown, before, next, byHand, !isPixelDash || next.panel === 'bag', hits)
  if (toast !== null) $.ui.toast(toast)
  syncMusic($, next)
  if (isSoundOn && sound !== undefined) await playEffect($, sound)
  if (hits.length === 0 || !isPixelDash || mapSize === null) return
  if (walk === null) playHits($, next, hits)
  else hitsAfterWalk = { g: next, hits }
}

/** Blows landed while a walk plays, shown once it ends. */
let hitsAfterWalk: { g: Game; hits: readonly Hit[] } | null = null

/**
 * A blow played out on the map: the struck foe flashing, then the numbers rising over 18 frames, a frame a tick;
 * a walk starting meanwhile takes the map over, and the ordinary drawing takes over at the end.
 */
const playHits = ($: EngineInterface, g: Game, hits: readonly Hit[]) => {
  isHitPlaying = true
  ticker.start('hits', async frame => {
    if (walk !== null || mapSize === null || frame >= hitFramesFor(hits)) {
      isHitPlaying = false
      if (frame >= hitFramesFor(hits)) $.ui.invalidate('ui.render')
      return false
    }
    const view = cameraFor(g, tileCenter(g), mapSize.columns, mapSize.rows)
    const painted = await sendMap($, pixelMap(g, mapSize.columns, mapSize.rows, undefined, view, hits, frame), mapSize)
    return painted.deny === undefined
  }, () => $.clock.every(FRAME_MS, () => void $.clock.now().then(ticker.tick)))
}

/** Carries out the click the hero is walking to, now: at the walk's end, or cut short by what cannot wait. */
/** A click that came during a charge, carried out once the charge's walk is over. */
let queued: { action: Action; byHand: boolean } | null = null

/**
 * Makes way for a new action that moves the hero, the drawn hero being the truth: a walk under way that is only a walk
 * is cut where he is drawn, the rules walking him only the tiles he has visibly walked, so nothing ahead is taken. One
 * that ends in more (a blow, a visit, the stairs) is not cut, its end being the point: a tool call carries it out, a
 * click waits for it. Answers whether the new action has to wait.
 */
const interrupt = async ($: EngineInterface, isClick: boolean): Promise<boolean> => {
  const p = pending
  const w = walk
  if (p === null) return false
  const reached = w === null ? 0 : Math.min(Math.floor(w.frame / FRAMES_PER_TILE), w.path.length - 1)
  const isOver = w === null || reached >= w.path.length - 1
  const isCuttable = p.isOnlyAWalk === true
  if (isOver || !isCuttable || w === null) {
    if (isClick && !isOver) return true
    await settle($)
    return false
  }
  pending = null
  const shown = w.shown ?? undefined
  stopWalk()
  if (reached > 0) await commit($, { kind: 'trail', path: w.path.slice(1, reached + 1) }, p.byHand, true, shown)
  return false
}

const settle = async ($: EngineInterface) => {
  const p = pending
  if (p === null) return
  pending = null
  const shown = walk?.shown ?? undefined
  stopWalk()
  await commit($, p.action, p.byHand, true, shown)
}

/**
 * Applies an action; `byHand` when the player's own click or press made it. A click that walks plays its walk first,
 * from the game as it is, and is carried out on arrival: the blow, the visit, the pickups land when the hero gets
 * there. A new click, or anything that would move the hero, carries out a click still walking first; anything else
 * happens alongside the walk.
 */
/** How long the hero stands with nothing happening before the idle bob starts. */
export const IDLE_BEFORE_BOB_MS = 10_000
/** The bob's phases and the shimmer's, each held this many frames. */
const BOB_FRAMES = 12
const SHIMMER_FRAMES = 10

/** The idle motion at `now`: the bob once idle since `lastActive` long enough, lifted first; the shimmer while in town. */
export const ambientAt = (now: number, lastActive: number, isTown: boolean): Ambient => {
  const idle = now - lastActive - IDLE_BEFORE_BOB_MS
  return { bob: idle >= 0 && Math.floor(idle / (BOB_FRAMES * FRAME_MS)) % 2 === 0, shimmer: isTown && Math.floor(now / (SHIMMER_FRAMES * FRAME_MS)) % 2 === 1 }
}

/** When something last happened (an action, a walk or a blow playing), and the idle motion last painted. */
let lastActive = 0
let shown: Ambient = STILL
let isHitPlaying = false

/** Paints the idle motion when a phase flips, on a slow timer of its own; walks and blows keep it waiting. */
const ambientTick = async ($: EngineInterface) => {
  if (mapSize === null) return
  const now = await $.clock.now()
  if (walk !== null || isHitPlaying) {
    lastActive = now
    return
  }
  const g = normalize(await read($, game))
  const next = ambientAt(now, lastActive, g.where === 'town')
  if (next.bob === shown.bob && next.shimmer === shown.shimmer) return
  shown = next
  const size = mapSize
  const view = cameraFor(g, tileCenter(g), size.columns, size.rows)
  await sendMap($, pixelMap(g, size.columns, size.rows, undefined, view, [], 0, false, shown), size)
}

/** The time, for the idle motion's bookkeeping; a host without a clock leaves the last known time standing. */
const nowOr = ($: EngineInterface, known: number) => $.clock.now().catch(() => known)

/** The idle motion's timer, started once, by the session's start or the first action, whichever comes first. */
let ambientTimer: { cancel: () => void } | null = null
const startAmbient = ($: EngineInterface) => {
  ambientTimer ??= $.clock.every(2 * FRAME_MS, () => void ambientTick($).catch(() => undefined))
}

const act = async ($: EngineInterface, action: Action, byHand = false) => {
  lastActive = await nowOr($, lastActive)
  startAmbient($)
  shown = { ...shown, bob: false }
  const before = normalize(await read($, game))
  const planned = apply(before, action)
  const moves = action.kind === 'goto' || planned.x !== before.x || planned.y !== before.y || placeOf(planned) !== placeOf(before)
  // A click that comes during a charge into a blow waits for the blow, then goes.
  if (moves && (await interrupt($, byHand && action.kind === 'goto'))) {
    queued = { action, byHand }
    return
  }
  // Any action that walks (a click, an explore, a charge at a foe) is carried out when the hero gets there, so what
  // lies on the way is picked up when he reaches it, not when the walk begins.
  const now = normalize(await read($, game))
  const plan = apply(now, action)
  // Only while the map is on screen: a walk nobody can see would hold the action back for nothing.
  if (isPlayed(now, plan) && mapSize !== null) {
    pending = { action, byHand, isOnlyAWalk: isOnlyAWalk(now, plan) }
    startWalk($, [{ x: now.x, y: now.y }, ...plan.walked], now, plan, alongTheWay(now, plan))
    return
  }
  await commit($, action, byHand, false)
}

const targetOf = (e: ToolCallInput) => {
  if (e.tool === 'Bash') return e.command
  if (e.tool === 'Edit' || e.tool === 'Write') return e.file_path
  if (e.tool === 'NotebookEdit') return e.notebook_path
  return undefined
}

/** Whether the game plays its sounds and its music: the `sound` and `music` options, each on unless turned off. */
let isSoundOn = true
let isMusicOn = true

/** The effect sounding on the one effects channel, and how to cut it. */
let effect: { now: Channel; stop: () => void } = { now: null, stop: () => undefined }

/** Plays an effect on the channel: cutting a lesser one still sounding, or dropped while a greater one sounds. */
const playEffect = async ($: EngineInterface, sound: Sound) => {
  const at = await nowOr($, lastActive)
  const { play, cut } = channel(effect.now, sound, at)
  if (!play) return
  if (cut) effect.stop()
  const sounding = new AbortController()
  effect = { now: { sound, endsAt: at + CLIP_MS[sound] }, stop: () => sounding.abort() }
  void $.audio.play({ asset: soundAsset(sound) }, { signal: sounding.signal, gain: gainOf(sound) }).catch(() => undefined)
}

/** The tune looping now, and how to stop it. */
let music: { stop: () => void } | null = null

/** Starts the town's tune on coming into town and stops it on leaving; the host loops it until stopped. */
const syncMusic = ($: EngineInterface, g: Game) => {
  const tune = musicFor(g, isMusicOn)
  if (tune !== undefined && music === null) {
    const playing = new AbortController()
    music = { stop: () => playing.abort() }
    void $.audio.play({ asset: tune }, { shouldLoop: true, signal: playing.signal, gain: MUSIC_GAIN }).catch(() => undefined)
  } else if (tune === undefined && music !== null) {
    music.stop()
    music = null
  }
}

export const register: Register = (on, options) => {
  isSoundOn = options.sound !== false
  isMusicOn = options.music !== false
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dungeon',
      description: 'Open the ASCII dungeon your coding session crawls through',
    })
    await $.command.register({
      name: 'dungeon-bench',
      description: 'Walk the hero a fixed long route in the dungeon pane, to measure its frames with /dungeon-frames',
    })
    await $.command.register({
      name: 'dungeon-frames',
      description: 'How evenly the dungeon pane plays its frames, and how long they take to draw',
    })
    lastActive = await nowOr($, lastActive)
    startAmbient($)
    const { version } = await $.state.get(GAME_REF)
    const saved = (await $.store.get(SAVE)) as Game | undefined
    const opening = openingGame(await read($, game), version, saved)
    if (opening !== undefined) await update($, game, () => opening)
    void $.ui.open(OPEN)

    return next(e)
  })

  on('command.run', { command: 'dungeon' }, async $ => {
    await $.ui.open(OPEN)

    return { text: 'The dungeon pane is open. Click the map to walk and fight, the hero to explore, the portrait for the bag, the level for the character sheet.' }
  })

  // Plays the bench walk on screen only (the rules never move), after forgetting what was measured before.
  on('command.run', { command: 'dungeon-bench' }, async $ => {
    if (mapSize === null || !isPixelDash) return { text: 'Open the dungeon pane on the pixel map, then run /dungeon-bench again.' }
    await settle($)
    const bench = normalize({ ...newGame(BENCH_SEED), seen: '1'.repeat(MAP_W * MAP_H) })
    ticker.reset()
    repaints.reset()
    redraws.reset()
    startWalk($, benchRoute(bench, BENCH_TILES), bench, bench)
    return { text: `Bench walk started: ${BENCH_TILES} tiles, about ${Math.ceil((BENCH_TILES * FRAMES_PER_TILE * FRAME_MS) / 1000)} s. Run /dungeon-frames once the hero stops.` }
  })

  on('command.run', { command: 'dungeon-frames' }, async () => ({ text: framesReport(ticker.stats(), repaints.summary(), redraws.summary()) }))

  on('prompt.submit', async ($, e, next) => {
    await act($, { kind: 'quest', text: e.text })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await act($, onToolStart(String(e.tool), targetOf(e)))
    const ran = await next(e)
    const ok = ran.deny === undefined && ran.isError !== true
    await act($, { kind: 'outcome', ok, what: String(e.tool) })

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      await act($, { kind: 'descend' })
      await $.store.set(SAVE, await read($, game))
    }

    return next(e)
  })

  // A click on the pixel map: the hero goes to the tile under it. A click on the strip: the portrait opens the
  // inventory, a belt slot is used.
  on('ui.message', async ($, e, next) => {
    const click = e.data as { x: number; y: number; columns: number; rows: number }
    if (e.element === 'map-clicks') {
      const g = normalize(await read($, game))
      await act($, { kind: 'goto', ...clickToTile(g, click, camera?.place === placeOf(g) ? camera.at : undefined) }, true)
      return {}
    }
    if (e.element === 'bag-clicks') {
      const outcome = bagGesture(normalize(await read($, game)), bagUi, e.data as Gesture)
      bagUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'shop-clicks') {
      const outcome = shopGesture(normalize(await read($, game)), shopUi, e.data as Gesture)
      shopUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'cbag-clicks') {
      const outcome = compactGesture(normalize(await read($, game)), bagUi, e.data as Gesture)
      bagUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'sheet-clicks') {
      const g = normalize(await read($, game))
      for (const action of sheetGesture(g, e.data as Gesture)) await act($, action, true)
      return {}
    }
    if (e.element === 'start-clicks') {
      const g = normalize(await read($, game))
      const outcome = startGesture(g, startUi ?? { cls: g.cls }, e.data as Gesture)
      startUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'forge-clicks') {
      const outcome = forgeGesture(normalize(await read($, game)), forgeUi, e.data as Gesture)
      forgeUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'chest-clicks') {
      const outcome = chestGesture(normalize(await read($, game)), chestUi, e.data as Gesture)
      chestUi = outcome.ui
      for (const action of outcome.actions) await act($, action, true)
      $.ui.invalidate('ui.render')
      return {}
    }
    if (e.element === 'talk-clicks') {
      const g = normalize(await read($, game))
      if (isSpeaker(g.panel)) for (const action of talkGesture(g, g.panel, e.data as Gesture)) await act($, action, true)
      return {}
    }
    if (e.element === 'hud-clicks') {
      const hit = hudHit(click.columns, click)
      if (hit !== undefined) await act($, hit, true)
      return {}
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const drawnFrom = fineNow()
    const { Box, Text, Button } = $.ui.resolve(e)
    const Raster = e.surface === 'terminal' ? $.ui.resolve(e).Raster : undefined
    const Client = e.surface === 'terminal' ? $.ui.resolve(e).Client : undefined
    const g = normalize(await read($, game))
    if (g.panel !== 'bag') bagUi = BAG_UI_IDLE
    if (g.panel !== 'shop') shopUi = SHOP_UI_IDLE
    if (g.panel !== 'forge') forgeUi = FORGE_UI_IDLE
    if (g.panel !== 'stash') chestUi = CHEST_UI_IDLE
    if (g.panel !== 'start') startUi = null
    const press = (action: Action) => () => act($, action, true)
    const line = (runs: Run[]) => (
      <Text wrap="truncate-end">
        {runs.map(run => (
          <Text color={run.color} backgroundColor={run.bg} bold={run.bold} inverse={run.inverse} dimColor={run.dim}>
            {run.text}
          </Text>
        ))}
      </Text>
    )
    const isWide = e.props.bodyColumns >= 44
    // No frame around the map: it takes the pane's full width.
    const mapWidth = Math.max(10, e.props.bodyColumns)
    const isPixelBag = g.panel === 'bag' && Raster !== undefined && e.props.bodyColumns >= INV_W
    const isCompactBag = g.panel === 'bag' && Raster !== undefined && !isPixelBag && e.props.bodyColumns >= COMPACT_W
    // While the bag is open the map gives up the rows the bag needs, down to a strip.
    const hasHud = Raster !== undefined && e.props.bodyColumns >= HUD_COLUMNS
    const hudRows = hudLayout(e.props.bodyColumns).height / 2
    isPixelDash = hasHud
    // The dashboard's rows: the pixel strip alone, or five text rows and a 5-line log; the character sheet's when open.
    const dashRows = (hasHud ? hudRows : 14) + (PANEL_ROWS[g.panel] ?? 0)
    // The pixel inventory opens as a window over the map, so the map keeps its rows; the text bag sits inline below.
    const mapRoom = e.props.scroll.bodyRows - dashRows - (g.panel === 'bag' && !isPixelBag && !isCompactBag ? 12 : 0)
    // With the pixel dashboard there is no view key: the map is always pixels.
    const isPixelView = Raster !== undefined && (hasHud || g.zoom === 3)
    const pixelRows = isPixelView ? Math.max(PX / 2, Math.min((MAP_H * PX) / 2, mapRoom)) : undefined
    const card = itemCard(g).map(line)
    if (pixelRows !== undefined) mapSize = { columns: mapWidth, rows: pixelRows }
    const { heroAt, drawn } = pixelRows !== undefined ? walkingAt(g) : { heroAt: undefined, drawn: g }
    // The strip, the status and the log as the walk stands: what lies ahead not yet taken.
    const told = walk?.tiles != null ? walkState(walk.start, walk.tiles, walk.frame) : g
    const view = pixelRows !== undefined ? cameraFor(g, heroAt ?? tileCenter(g), mapWidth, pixelRows) : undefined

    const bagActions = (
      <Box columnGap={2}>
        <Button key="cycle" label="Next" hotkey="n" plain onPress={press({ kind: 'cycle' })} />
        <Button key="equip" label="Equip" hotkey="e" plain onPress={press({ kind: 'equip' })} />
        <Button key="sell" label="Sell" hotkey="s" plain onPress={press({ kind: 'sell' })} />
        <Button key="junk" label="Junk" hotkey="j" plain onPress={press({ kind: 'junk' })} />
        <Button key="lock" label="Lock" hotkey="g" plain onPress={press({ kind: 'lock' })} />
        <Button key="sellJunk" label="Sell junk" hotkey="x" plain onPress={press({ kind: 'sellJunk' })} />
        <Button key="arrange" label="Arrange" hotkey="o" plain onPress={press({ kind: 'arrange' })} />
      </Box>
    )

    // The pixel inventory takes the whole pane while it is open: the bag, the item card and the controls, nothing else.
    if (isPixelBag && Raster !== undefined) {
      const rows = (INV_TOP + INV_H) / 2
      const popovers = bagOverlay(g, bagUi)
      const destroyKey = () => {
        const id = g.cursor
        if (id === null) return
        if (bagUi.menu?.id === id && bagUi.menu.confirm) {
          bagUi = BAG_UI_IDLE
          void act($, { kind: 'destroy' })
        } else {
          bagUi = { ...bagUi, menu: { id, confirm: true } }
          $.ui.invalidate('ui.render')
        }
      }
      redraws.add(fineNow() - drawnFrom)
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" alignItems="center">
            <Box>
              <Raster key="bag" columns={INV_W} rows={rows} cells={inventoryScreenCells(g, bagUi.drag ?? undefined, popovers)} />
              {Client !== undefined && (
                <Box position="absolute" top={0} left={0}>
                  <Client key="bag-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows, boxes: popovers }} width={INV_W} height={rows} />
                </Box>
              )}
            </Box>
          </Box>
          {g.cursor === null && <Box flexDirection="column" marginTop={1}>{card}</Box>}
          <Box marginTop={1} columnGap={2}>
            {bagActions}
            <Button key="destroy" label={bagUi.menu?.confirm === true ? 'Destroy? again' : 'Destroy'} hotkey="d" plain onPress={destroyKey} />
            <Button key="bag" label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'bag' })} />
          </Box>
          <Text dimColor>Click an item to compare it, again (or right-click) for its menu. Drag to move it, onto its slot to wear it.</Text>
          <Box flexDirection="column" marginTop={1}>
            {logRuns(g).slice(-2).map(entry => (
              <Text dimColor wrap="truncate-end">
                {'> '}
                {entry.text}
              </Text>
            ))}
          </Box>
        </Box>
      )
    }

    // The merchant's window takes the whole pane while it is open, like the inventory.
    if (g.panel === 'shop' && Raster !== undefined && e.props.bodyColumns >= INV_W) {
      const rows = SHOP_H / 2
      const boxes = shopOverlay(g, shopUi)
      const redraw = (ui: ShopUi) => () => {
        shopUi = ui
        $.ui.invalidate('ui.render')
      }
      const buyKey = async () => {
        if (shopUi.ware === null) {
          shopUi = { ware: 'health', menu: false }
          $.ui.invalidate('ui.render')
        } else await act($, { kind: 'buy', ware: shopUi.ware }, true)
      }
      const onItem = (action: Action) => async () => {
        shopUi = SHOP_UI_IDLE
        await act($, action, true)
      }
      const chosen = shopUi.ware
      const junk = junkValue(g)
      redraws.add(fineNow() - drawnFrom)
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" alignItems="center">
            <Box>
              <Raster key="shop" columns={INV_W} rows={rows} cells={canvasCells({ w: INV_W, h: SHOP_H, px: shopPixels(g, shopUi, boxes) })} />
              {Client !== undefined && (
                <Box position="absolute" top={0} left={0}>
                  <Client key="shop-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows, boxes }} width={INV_W} height={rows} />
                </Box>
              )}
            </Box>
          </Box>
          <Box marginTop={1} columnGap={2}>
            <Button key="shop-buy" label={chosen === null ? 'Buy' : `Buy ${CONSUMABLES[chosen].name}`} hotkey="b" plain dimColor={chosen !== null && whyNot(g, chosen) !== undefined} onPress={buyKey} />
            <Button key="shop-ware" label="Next ware" hotkey="w" plain onPress={redraw(nextWare(shopUi))} />
            <Button key="shop-sell" label="Sell" hotkey="s" plain dimColor={g.cursor === null || chosen !== null} onPress={onItem({ kind: 'sell' })} />
            <Button key="shop-junk" label={junk.count === 0 ? 'Sell junk' : `Sell junk (${junk.count}, ${junk.coins} gold)`} hotkey="x" plain dimColor={junk.count === 0} onPress={onItem({ kind: 'sellJunk' })} />
            <Button key="shop-undo" label={undoLabel(g)} hotkey="u" plain dimColor={whyNotBuyBack(g) !== undefined} onPress={onItem({ kind: 'buyBack' })} />
            <Button key="shop-next" label="Next item" hotkey="n" plain onPress={onItem({ kind: 'cycle' })} />
            <Button key="shop-equip" label="Equip" hotkey="e" plain dimColor={g.cursor === null || chosen !== null} onPress={onItem({ kind: 'equip' })} />
            <Button key="shop-close" label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'shop' })} />
          </Box>
          <Text dimColor>Click a ware or an item to see it, again (or right-click) for its menu.</Text>
          <Box flexDirection="column" marginTop={1}>
            {logRuns(g).slice(-2).map(entry => (
              <Text dimColor wrap="truncate-end">
                {'> '}
                {entry.text}
              </Text>
            ))}
          </Box>
        </Box>
      )
    }

    /** A pixel window over the whole pane: its raster and click layer, the keys under it, the last two log lines. */
    const pixelWindow = (key: string, height: number, px: string[][], boxes: readonly OverlayBox[], keys: RenderChildren, hint?: string) => (
      <Box flexDirection="column">
        <Box flexDirection="column" alignItems="center">
          <Box>
            {Raster !== undefined && <Raster key={key} columns={INV_W} rows={height / 2} cells={canvasCells({ w: INV_W, h: height, px })} />}
            {Client !== undefined && (
              <Box position="absolute" top={0} left={0}>
                <Client key={`${key}-clicks`} module="./windowclient.ts" props={{ columns: INV_W, rows: height / 2, boxes }} width={INV_W} height={height / 2} />
              </Box>
            )}
          </Box>
        </Box>
        <Box marginTop={1} columnGap={2}>{keys}</Box>
        {hint !== undefined && <Text dimColor>{hint}</Text>}
        <Box flexDirection="column" marginTop={1}>
          {logRuns(g).slice(-2).map(entry => (
            <Text dimColor wrap="truncate-end">
              {'> '}
              {entry.text}
            </Text>
          ))}
        </Box>
      </Box>
    )

    if (g.panel === 'start') {
      const ui = startUi ?? { cls: g.cls }
      const choose = (cls: HeroClass) => () => {
        startUi = { cls }
        $.ui.invalidate('ui.render')
      }
      const keys = [
        ...HEROES.map((cls, i) => <Button key={`start-${cls}`} label={cls === ui.cls ? `[${CLASS_NAME[cls]}]` : CLASS_NAME[cls]} hotkey={String(i + 1)} plain dimColor={cls !== ui.cls} onPress={choose(cls)} />),
        <Text dimColor>|</Text>,
        <Button key="start-go" label={`Start as ${CLASS_NAME[ui.cls]}`} hotkey="s" plain onPress={press(begin(ui.cls))} />,
        ...(isUnderWay(g) ? [<Button key="start-back" label="Back to your game" hotkey="b" plain onPress={press({ kind: 'panel', panel: 'start' })} />] : []),
      ]
      redraws.add(fineNow() - drawnFrom)
      if (Raster !== undefined && e.props.bodyColumns >= INV_W) {
        const boxes = startOverlay(ui)
        return pixelWindow('start', startHeight(ui), startPixels(g, ui), boxes, keys, 'Click a hero to choose, again (or Start) to begin.')
      }
      return (
        <Box flexDirection="column">
          <Text bold>New game: choose your hero</Text>
          <Box columnGap={2} flexWrap="wrap">{keys}</Box>
          <Text wrap="wrap">{classAbout(ui.cls)}</Text>
        </Box>
      )
    }

    // Too narrow for the full inventory, wide enough for this: the bag and the belt in pixels, what is worn as a list.
    if (isCompactBag) {
      const boxes = compactOverlay(g, bagUi)
      redraws.add(fineNow() - drawnFrom)
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" alignItems="center">
            <Box>
              <Raster key="cbag" columns={COMPACT_W} rows={COMPACT_H / 2} cells={canvasCells({ w: COMPACT_W, h: COMPACT_H, px: compactPixels(g, boxes) })} />
              {Client !== undefined && (
                <Box position="absolute" top={0} left={0}>
                  <Client key="cbag-clicks" module="./windowclient.ts" props={{ columns: COMPACT_W, rows: COMPACT_H / 2, boxes }} width={COMPACT_W} height={COMPACT_H / 2} />
                </Box>
              )}
            </Box>
          </Box>
          <Box marginTop={1} columnGap={2} flexWrap="wrap">
            {bagActions}
            <Button key="bag" label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'bag' })} />
          </Box>
          <Text dimColor>Click an item to compare it, again for its menu; drag it to move it. Click what you wear to take it off.</Text>
        </Box>
      )
    }

    if (g.panel === 'sheet' && Raster !== undefined && e.props.bodyColumns >= INV_W) {
      redraws.add(fineNow() - drawnFrom)
      return pixelWindow('sheet', SHEET_H, sheetPixels(g), sheetOverlay(g), [
        ...ATTRIBUTES.map((a, i) => <Button key={`train-${a.stat}`} label={`+${a.label.trim()}`} hotkey={String(i + 1)} plain dimColor={g.points === 0} onPress={press({ kind: 'train', stat: a.stat })} />),
        <Button key="sheet-new" label="New game..." hotkey="n" plain onPress={press({ kind: 'panel', panel: 'start' })} />,
        <Button key="sheet-close" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />,
      ], g.points > 0 ? 'Click a + (or press its number) to spend a point.' : undefined)
    }

    if (g.panel === 'forge' && Raster !== undefined && e.props.bodyColumns >= INV_W) {
      const slot = chosenSlot(g, forgeUi)
      const item = slot === undefined ? undefined : g.gear[slot]
      const height = forgeHeight(g, forgeUi)
      redraws.add(fineNow() - drawnFrom)
      return pixelWindow('forge', height, forgePixels(g, forgeUi), forgeOverlay(g, forgeUi), [
        <Button key="forge-temper" label="Temper" hotkey="t" plain dimColor={item === undefined || whyNotTemper(g, item) !== undefined} onPress={press(slot === undefined ? { kind: 'temper', slot: 'weapon' } : { kind: 'temper', slot })} />,
        <Button key="forge-reforge" label="Reforge" hotkey="r" plain dimColor={item === undefined || whyNotReforge(g, item) !== undefined} onPress={press(slot === undefined ? { kind: 'reforge', slot: 'weapon' } : { kind: 'reforge', slot })} />,
        <Button key="forge-keep" label="Keep old" hotkey="k" plain dimColor={keptChoice(g) === undefined} onPress={press({ kind: 'keepOld' })} />,
        <Button key="forge-next" label="Next piece" hotkey="w" plain onPress={() => {
          forgeUi = nextWorn(g, forgeUi)
          $.ui.invalidate('ui.render')
        }} />,
        <Button key="forge-close" label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'forge' })} />,
      ], 'Click a piece you wear to choose it, then a job.')
    }

    if (g.panel === 'stash' && Raster !== undefined && e.props.bodyColumns >= INV_W) {
      const boxes = chestOverlay(g, chestUi)
      const stored = g.stashed.find(i => i.id === chestUi.stored)
      const take = async () => {
        if (stored === undefined) return
        chestUi = CHEST_UI_IDLE
        await act($, { kind: 'retrieve', id: stored.id }, true)
      }
      const onBag = (action: Action) => async () => {
        chestUi = CHEST_UI_IDLE
        await act($, action, true)
      }
      redraws.add(fineNow() - drawnFrom)
      return pixelWindow('chest', CHEST_H, chestPixels(g, chestUi, boxes), boxes, [
        <Button key="chest-store" label="Store" hotkey="s" plain dimColor={g.cursor === null || chestUi.stored !== null || whyNotStore(g) !== undefined} onPress={onBag({ kind: 'store' })} />,
        <Button key="chest-take" label="Take" hotkey="t" plain dimColor={stored === undefined || whyNotTake(g, stored) !== undefined} onPress={take} />,
        <Button key="chest-next" label="Next in the chest" hotkey="w" plain onPress={() => {
          chestUi = nextStored(g, chestUi)
          $.ui.invalidate('ui.render')
        }} />,
        <Button key="chest-bag" label="Next item" hotkey="n" plain onPress={onBag({ kind: 'cycle' })} />,
        <Button key="stash-close" label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'stash' })} />,
      ], 'Click a chest row or a bag item to see it, again (or right-click) to move it.')
    }

    // A townsperson's window takes the whole pane while it is open, like the merchant's.
    if (isSpeaker(g.panel) && Raster !== undefined && e.props.bodyColumns >= INV_W) {
      const who = g.panel
      const height = talkHeight(g, who)
      const boxes = talkOverlay(g, who)
      const deed = talkAction(g, who)
      redraws.add(fineNow() - drawnFrom)
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" alignItems="center">
            <Box>
              <Raster key="talk" columns={INV_W} rows={height / 2} cells={canvasCells({ w: INV_W, h: height, px: talkPixels(g, who) })} />
              {Client !== undefined && (
                <Box position="absolute" top={0} left={0}>
                  <Client key="talk-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows: height / 2, boxes }} width={INV_W} height={height / 2} />
                </Box>
              )}
            </Box>
          </Box>
          <Box marginTop={1} columnGap={2}>
            {deed !== undefined && <Button key="talk-act" label={deed.label[0] + deed.label.slice(1).toLowerCase()} hotkey={deed.key.toLowerCase()} plain dimColor={deed.state === 'off'} onPress={press(deed.action)} />}
            <Button key={`${who}-close`} label="Close" hotkey="i" plain onPress={press({ kind: 'panel', panel: who })} />
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {logRuns(g).slice(-2).map(entry => (
              <Text dimColor wrap="truncate-end">
                {'> '}
                {entry.text}
              </Text>
            ))}
          </Box>
        </Box>
      )
    }

    const textBag = (
      <Box flexDirection={isWide ? 'row' : 'column'}>
        <Box flexDirection="column" marginRight={2}>
          {bagRows(g).map(line)}
        </Box>
        <Box flexDirection="column">
          {SLOTS.map(slot => {
            const worn = g.gear[slot]
            return (
              <Button key={`gear-${slot}`} plain dimColor={worn === undefined} onPress={press({ kind: 'unequip', slot })}>
                {slot.padEnd(8)}{' '}
                {worn === undefined ? <Text dimColor>-</Text> : <Text color={RARITY_COLOR[worn.rarity]}>{worn.name}</Text>}
              </Button>
            )
          })}
        </Box>
      </Box>
    )

    const bag = (
      <Box flexDirection="column">
        {textBag}
        {card}
        {bagActions}
      </Box>
    )

    const belt = (
      <Box columnGap={2}>
        {Array.from({ length: BELT_SIZE }, (_, i) => (
          <Button key={`belt-${i + 1}`} label={beltLabel(g, i)} hotkey={String(i + 1)} plain dimColor={g.belt[i] === null} onPress={press({ kind: 'use', slot: i })} />
        ))}
      </Box>
    )

    const sheet = (
      <Box flexDirection="column">
        <Text bold>
          Level {g.level} adventurer, {g.points} unspent point{g.points === 1 ? '' : 's'}
        </Text>
        {ATTRIBUTES.map((a, i) => (
          <Box>
            <Button key={`train-${a.stat}`} label="+" hotkey={String(i + 1)} plain dimColor={g.points === 0} onPress={press({ kind: 'train', stat: a.stat })} />
            <Text>
              {' '}
              {a.label} {String(g.stats[a.stat]).padStart(2)}{'  '}
            </Text>
            <Text dimColor>{a.effect(g)}</Text>
          </Box>
        ))}
        <Box marginTop={1} columnGap={2}>
          <Button key="sheet-new" label="New game..." plain onPress={press({ kind: 'panel', panel: 'start' })} />
          <Text dimColor>|</Text>
          <Button key="sheet-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />
        </Box>
      </Box>
    )

    const shop = (
      <Box flexDirection="column">
        <Text>
          <Text bold>The merchant</Text>
          <Text color="#ffd34d">{`  Gold ${g.gold}`}</Text>
        </Text>
        {(Object.keys(SHOP_PRICES) as Consumable[]).map(ware => (
          <Button key={`buy-${ware}`} label={`Buy ${CONSUMABLES[ware].name}: ${SHOP_PRICES[ware]} gold`} plain dimColor={g.gold < SHOP_PRICES[ware]} onPress={press({ kind: 'buy', ware })} />
        ))}
        <Button key="shop-undo" label={undoLabel(g)} plain dimColor={whyNotBuyBack(g) !== undefined} onPress={press({ kind: 'buyBack' })} />
        <Button key="shop-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'shop' })} />
      </Box>
    )

    const worn = SLOTS.flatMap(slot => {
      const item = g.gear[slot]
      return item === undefined ? [] : [{ slot, item }]
    })
    const forge = (
      <Box flexDirection="column">
        <Text>
          <Text bold>The smith</Text>
          <Text dimColor>{`  Temper: +1 to the main stat, up to ${TEMPER_MAX} times. Reforge: new affixes, ${reforgeCost(g)} gold`}</Text>
          <Text color="#ffd34d">{`  Gold ${g.gold}`}</Text>
        </Text>
        {worn.length === 0 && <Text dimColor>You wear nothing for the smith to work on.</Text>}
        {worn.map(({ slot, item }) => {
          const tempered = item.temper ?? 0
          const isReforgeable = item.rarity !== 'common' && item.rarity !== 'legendary'
          return (
            <Box key={`forge-${slot}`} flexDirection="row">
              <Text color={RARITY_COLOR[item.rarity]}>{item.name}</Text>
              <Text dimColor>{`  +${tempered}/${TEMPER_MAX}  `}</Text>
              {tempered < TEMPER_MAX
                ? <Button key={`temper-${slot}`} label={`Temper: ${temperCost(item)} gold`} plain dimColor={g.gold < temperCost(item)} onPress={press({ kind: 'temper', slot })} />
                : <Text dimColor>Fully tempered</Text>}
              {isReforgeable && <Text>{'  '}</Text>}
              {isReforgeable && <Button key={`reforge-${slot}`} label="Reforge" plain dimColor={g.gold < reforgeCost(g)} onPress={press({ kind: 'reforge', slot })} />}
            </Box>
          )
        })}
        <Button key="forge-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'forge' })} />
      </Box>
    )

    const closer = (panel: Game['panel']) => <Button key={`${panel}-close`} label="Close" plain onPress={press({ kind: 'panel', panel })} />
    const healer = (
      <Box flexDirection="column">
        <Text bold>The healer</Text>
        <Text>{`HP ${g.hp}/${g.maxHp}`}<Text dimColor>{'  Free, whenever you come back to town.'}</Text></Text>
        {closer('healer')}
      </Box>
    )
    const quest = g.quest
    const elderWindow = (
      <Box flexDirection="column">
        <Text>
          <Text bold>The elder</Text>
          <Text dimColor>{`  Quests done: ${g.questsDone}`}</Text>
        </Text>
        <Text>{quest === null ? 'No quest in hand. Visit again for one.' : questLine(quest)}</Text>
        <Text dimColor>{quest === null ? ' ' : quest.have >= quest.need ? 'Done: make room in your bag, then claim your pay.' : `Pays ${questReward(quest)} gold and an item of Uncommon or better.`}</Text>
        {quest !== null && quest.have >= quest.need && <Button key="claim" label="Claim" hotkey="c" plain onPress={press({ kind: 'claim' })} />}
        {closer('elder')}
      </Box>
    )
    const mysticWindow = (
      <Box flexDirection="column">
        <Text>
          <Text bold>The mystic</Text>
          <Text color="#ffd34d">{`  Gold ${g.gold}`}</Text>
        </Text>
        <Text>{g.fortune === null ? 'No fortune in force.' : `${FORTUNE_NAME[g.fortune.kind]}, until you change depth.`}</Text>
        {g.fortune === null
          ? <Button key="fortune" label={`Read my fortune: ${fortuneCost(g)} gold`} plain dimColor={g.gold < fortuneCost(g)} onPress={press({ kind: 'fortune' })} />
          : <Text dimColor>One fortune at a time.</Text>}
        {closer('mystic')}
      </Box>
    )
    const talker = (who: 'guard' | 'villager' | 'dog') => (
      <Box flexDirection="column">
        <Text bold>{TALKER_NAME[who]}</Text>
        <Text>{TOWN_TALK[who]}</Text>
        {who === 'dog' && <Button key="pet" label={`Pet the dog (${g.petted} so far)`} hotkey="p" plain onPress={press({ kind: 'pet' })} />}
        {closer(who)}
      </Box>
    )

    const picked = g.bag.find(item => item.id === g.cursor)
    const vault = (
      <Box flexDirection="column">
        <Text>
          <Text bold>Your stash</Text>
          <Text dimColor>{`  ${g.stashed.length} of ${STASH_SIZE} items, kept in town`}</Text>
        </Text>
        <Box flexDirection="row">
          {picked === undefined
            ? <Text dimColor>Your bag is empty.</Text>
            : <Button key="store" plain dimColor={g.stashed.length >= STASH_SIZE} onPress={press({ kind: 'store' })}>{'Store '}<Text color={RARITY_COLOR[picked.rarity]}>{picked.name}</Text></Button>}
          {g.bag.length > 1 && <Text>{'  '}</Text>}
          {g.bag.length > 1 && <Button key="stash-next" label="Next bag item" plain onPress={press({ kind: 'cycle' })} />}
        </Box>
        {g.stashed.length === 0 && <Text dimColor>Nothing stored yet.</Text>}
        {g.stashed.map(item => (
          <Button key={`retrieve-${item.id}`} plain onPress={press({ kind: 'retrieve', id: item.id })}>
            {'Take '}
            <Text color={RARITY_COLOR[item.rarity]}>{item.name}</Text>
          </Button>
        ))}
        <Button key="stash-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'stash' })} />
      </Box>
    )

    redraws.add(fineNow() - drawnFrom)
    return (
      <Box flexDirection="column" position="relative">
        <Box flexDirection="column">
          {Raster === undefined || pixelRows === undefined
            ? (g.zoom === 1
                ? mapRows(g, mapWidth, Math.max(7, Math.min(MAP_H, mapRoom)))
                : zoomedRows(g, mapWidth, Math.max(4 * TILE_H, Math.min(MAP_H * TILE_H, mapRoom)))
              ).map(line)
            : (
              <Box>
                <Raster key="map" columns={mapWidth} rows={pixelRows} cells={drawnMap(pixelMap(drawn, mapWidth, pixelRows, heroAt, view, [], 0, heroAt !== undefined && walk !== null && isStrideFrame(walk.frame), heroAt === undefined ? shown : STILL))} />
                {Client !== undefined && (
                  <Box position="absolute" top={0} left={0}>
                    <Client key="map-clicks" module="./clicks.ts" props={{ columns: mapWidth, rows: pixelRows }} width={mapWidth} height={pixelRows} />
                  </Box>
                )}
              </Box>
            )}
        </Box>
        {Raster !== undefined && widthNote(e.props.bodyColumns) !== undefined && <Text dimColor>{widthNote(e.props.bodyColumns)}</Text>}
        {e.surface === 'terminal' && e.viewport?.isFullscreen === false && isPixelView && (
          <Text dimColor>
            {hasHud ? 'Playing by mouse needs the fullscreen layout: type /tui fullscreen.' : 'Clicking the map needs the fullscreen layout: type /tui fullscreen. Keys work everywhere.'}
          </Text>
        )}
        {hasHud && Raster !== undefined ? (
          <Box flexDirection="column">
            <Box>
              <Raster key="hud" columns={e.props.bodyColumns} rows={hudRows} cells={hudCells(told, e.props.bodyColumns)} />
              {Client !== undefined && (
                <Box position="absolute" top={0} left={0}>
                  <Client key="hud-clicks" module="./clicks.ts" props={{ columns: e.props.bodyColumns, rows: hudRows }} width={e.props.bodyColumns} height={hudRows} />
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {line(statusRuns(told))}
            {line(foeRuns(g))}
          </Box>
        )}
        {!hasHud && (
        <Box columnGap={2} flexWrap="wrap">
          <Button key="bag" hotkey="i" plain onPress={press({ kind: 'panel', panel: 'bag' })}>
            <Text bold>Inventory</Text>
          </Button>
          <Button key="sheet" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'sheet' })}>
            Character{g.points > 0 ? <Text color="#e0b84a"> ({g.points})</Text> : ''}
          </Button>
          <Text dimColor>|</Text>
          <Button key="attack" label="attack" hotkey="a" plain onPress={press({ kind: 'attack' })} />
          <Button key="potion" label="potion" hotkey="p" plain onPress={press({ kind: 'potion' })} />
          <Button key="walk" label="explore" hotkey="w" plain onPress={press({ kind: 'walk' })} />
          <Button key="stairs" label="descend" hotkey="d" plain onPress={press({ kind: 'stairs' })} />
          <Button key="portal" label={g.where === 'town' ? 'leave town' : 'portal'} hotkey="t" plain onPress={press({ kind: 'portal' })} />
          <Button key="west" label="left" hotkey="h" plain onPress={press({ kind: 'move', dx: -1, dy: 0 })} />
          <Button key="south" label="down" hotkey="j" plain onPress={press({ kind: 'move', dx: 0, dy: 1 })} />
          <Button key="north" label="up" hotkey="k" plain onPress={press({ kind: 'move', dx: 0, dy: -1 })} />
          <Button key="east" label="right" hotkey="l" plain onPress={press({ kind: 'move', dx: 1, dy: 0 })} />
          <Button key="zoom" label={VIEW_LABEL[g.zoom]} hotkey="z" plain onPress={press({ kind: 'zoom' })} />
          <Button key="restart" label="new game" hotkey="r" plain onPress={press({ kind: 'panel', panel: 'start' })} />
        </Box>
        )}
        {!hasHud && g.panel !== 'sheet' && belt}
        {g.panel === 'bag' && !isPixelBag && !isCompactBag && bag}
        {g.panel === 'sheet' && sheet}
        {g.panel === 'shop' && shop}
        {g.panel === 'forge' && forge}
        {g.panel === 'stash' && vault}
        {g.panel === 'healer' && healer}
        {g.panel === 'elder' && elderWindow}
        {g.panel === 'mystic' && mysticWindow}
        {(g.panel === 'guard' || g.panel === 'villager' || g.panel === 'dog') && talker(g.panel)}
        {!hasHud && logRuns(told).map(entry => (
          <Text dimColor={entry.dim} wrap="truncate-end">
            {'> '}
            {entry.text}
          </Text>
        ))}
      </Box>
    )
  })
}
