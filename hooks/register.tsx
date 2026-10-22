import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, RenderElement, RenderInput, ToolCallInput } from 'claude-code'

import type { Game, HeroClass, Talent } from '../types'
import { TOWN_TALK, isTownWalkable, townSpotAt } from './town'
import { BIG_BOSSES, LOG_KEPT, STASH_SIZE, UNIQUES, alongTheWay, apply, canRetire, classAbout, firstCodex, fortuneCost, gambleCost, isOnlyAWalk, keptChoice, newGame, normalize, onToolStart, priceOfWare, questLine, questReward, reforgeCost, threat, tradeInOf, whyNotRetire } from './game'
import type { Action, Run } from './game'
import { BELT_SIZE, nameOf, wareOf } from './consumables'
import { FRAME_MS, LATE_MS, createSamples, createTicker, summarize } from './frames'
import type { FrameSummary, TickStats } from './frames'
import { beltMenuBox, hudBoxes, hudGesture, hudHot, hudLayout, hudPixels } from './hud'
import type { BeltMenu } from './hud'
import { deathGesture, deathHeight, deathHot, deathOverlay, deathPixels, killerName } from './death'
import { recapGesture, recapHeight, recapHot, recapOverlay, recapPixels } from './recapwindow'
import { CODEX_UI, codexGesture, codexHeight, codexHot, codexOverlay, codexPixels } from './codexwindow'
import type { CodexUi } from './codexwindow'
import { cardPixels, cardText, svgOf } from './herocard'
import { retireGesture, retireHeight, retireHot, retireOverlay, retirePixels } from './retirewindow'
import { TALENT_UI, talentGesture, talentHeight, talentHot, talentOverlay, talentPixels } from './talentwindow'
import type { TalentUi } from './talentwindow'
import { TALENTS, TALENT_EVERY, offer, owed } from './talents'
import { deepGesture, deepHeight, deepHot, deepOverlay, deepPixels } from './deepwindow'
import { DEEP_FROM, MARKS, forkTier, isForkOpen, markOf, pairOf, roman, tierOf } from './deep'
import type { RetireUi } from './retirewindow'
import { SETTINGS_H, SETTINGS_UI, VOLUME_STEPS, nextSound, orderWord, settingsGesture, settingsHot, settingsOverlay, settingsPixels, soundFrom, volumeShare } from './settings'
import type { SettingsUi } from './settings'
import { HELP_ROWS, helpGesture, helpHeight, helpOverlay, helpPixels } from './helpwindow'
import { logGesture, logHeight, logOverlay, logPixels } from './logwindow'
import type { SoundSettings } from './settings'
import { INV_H, INV_TOP, INV_W, beltLabel, inventoryScreenPixels, itemCard } from './inventory'
import { BAG_UI_IDLE, bagGesture, bagOverlay, inventoryHot } from './bagui'
import type { BagUi, Gesture } from './bagui'
import { SHOP_H, SHOP_UI_IDLE, WARES, nextWare, shopGesture, shopHot, shopOverlay, shopPixels, whyNot } from './shop'
import type { ShopUi } from './shop'
import { chromeBoxes, closeBoxOf, onPixels, pixel } from './window'
import type { OverlayBox, Rect } from './window'
import { hoveredRect, lightUp } from './ui/kit'
import { heroTabsHot } from './herotabs'
import { canvasCells } from './canvas'
import { FORGE_UI_IDLE, chosenSlot, forgeGesture, forgeHeight, forgeHot, forgeOverlay, forgePixels, nextWorn, whyNotReforge, whyNotTemper } from './forge'
import type { ForgeUi } from './forge'
import { CHEST_H, CHEST_UI_IDLE, chestGesture, chestHot, chestOverlay, chestPixels, nextStored, whyNotStore, whyNotTake } from './chest'
import type { ChestUi } from './chest'
import { HINT_ROWS, UNDER_WINDOW, fitNote, sizeNote } from './panesize'
import { CLASSES as HEROES, STATS_LINE, begin, isUnderWay, startGesture, startHeight, startHot, startOverlay, startPixels } from './start'
import type { StartUi } from './start'
import { isFromLater, isReadable, openingGame, savable } from './save'
import { SHEET_H, sheetGesture, sheetHot, sheetOverlay, sheetPixels } from './sheet'
import { COMPACT_H, COMPACT_W, compactGesture, compactHot, compactOverlay, compactPixels } from './compact'
import { FORTUNE_NAME, isSpeaker, talkAction, talkGesture, talkHeight, talkHot, talkOverlay, talkPixels } from './talk'
import type { Speaker } from './talk'
import { CLASS_NAME, LEGENDARIES, RARITY_COLOR, SLOTS, TEMPER_MAX, junkValue, temperCost, whyNotBuyBack } from './items'
import { MAP_H, MAP_W, cellId, isFloor, same } from './map'
import { levelOf } from './world'
import { ATTRIBUTES, bagRows, foeRuns, logRuns, lyingLabel, mapRows, statusRuns } from './panels'
import { PX } from './pixelart'
import { INK } from './ui/tokens'
import { FRAMES_PER_TILE, STILL, layerBuildCount, stampCells, walkState, benchRoute, clickToTile, labelGrounds, labelRowAt, mapLabelAt, pixelMapFrame, tileRect, tileToCell, deathScene, hitFramesFor, hitsBetween, isStrideFrame, pixelMap, tileCamera, walkPosition, walkingGame } from './pixels'
import type { Ambient, Hit, PixelRect } from './pixels'
import { base64Of, bytesOf, mixdown, readWav, walkCues, wavOf } from './mixdown'
import { workOf } from './work'
import type { GitOperation } from './work'
import { HOST_PLACES, MUSIC_GAIN, cuesFor, gainOf, mixFor, musicFor, soundAsset, soundsFor, stepAt } from './sounds'
import type { Player, Sound } from './sounds'
import { CLIP_MS, TUNE_MS } from './clips'
import { PX as TILE_PX } from './pixelart'
import type { Pos } from './map'
import { TILE_H, zoomedRows } from './sprites'

const PANE = 'dungeon'
/** Docked, the pane asks to be wide enough for the pixel inventory window and the dashboard with its belt beside the bars. */
const OPEN = { id: PANE, title: 'Dungeon', columns: 112 }
const SAVE = 'save'
/** Where a save that could not be read is kept, once a new game takes its place. */
const UNREADABLE = 'save-unreadable'
/** The sound as set in settings, kept across sessions and reloads. */
const SOUND = 'sound'
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
type Walk = { path: Pos[]; frame: number; start: Game; game: Game; tiles: Game[] | null; shown: Game | null; isMixed: boolean }
let walk: Walk | null = null
/** The walk's own clip, its footsteps and what it picks up mixed on their frames, while it plays. */
let walkMix: { stop: () => void } | null = null
/** The runtime's fine clock where it has one, for timing a tick's work; the host's clock counts whole ms. */
const fineNow = () => (globalThis as { performance?: { now: () => number } }).performance?.now() ?? 0
const ticker = createTicker(fineNow)
/** How long the host takes to take a repainted map, and how long drawing the whole pane takes (on every change). */
const repaints = createSamples()
const redraws = createSamples()
/** Drawing a walk frame's map: with the ground layer kept, and with it drawn afresh. */
const keptMaps = createSamples()
const builtMaps = createSamples()
/** The inventory screen's own state: an open menu, an item being dragged. */
let bagUi: BagUi = BAG_UI_IDLE
/** The belt slot whose menu of tiers is open on the strip. */
let beltMenu: BeltMenu = null
/** The strip's width in cells, as last drawn: what its clicks are read against. */
let hudWidth = 0
let shopUi: ShopUi = SHOP_UI_IDLE
let forgeUi: ForgeUi = FORGE_UI_IDLE
/** The piece the retire window has chosen to pass down. */
let retireUi: RetireUi = FORGE_UI_IDLE
let chestUi: ChestUi = CHEST_UI_IDLE
let startUi: StartUi | null = null
/** The card chosen in the talent window, while it is open. */
let talentUi: TalentUi = TALENT_UI
/** The codex's page. */
let codexUi: CodexUi = CODEX_UI
/** The settings window's page. */
let settingsUi: SettingsUi = SETTINGS_UI
/** The how-it-plays window, open over whatever the pane shows: it closes back to that. */
let isHelpOpen = false
/** The log window: the pane's own, as the help is, opened over whatever is open and closed back to it. */
let isLogOpen = false
/** The pointer over a window, in its pixels, by the window's key; and what each window drawn last can be clicked on. */
let hover: { key: string; at: Pos } | null = null
const hotOf = new Map<string, readonly Rect[]>()
/** What the hover lights in the window `key`: the clickable place under the pointer, if any. */
const litIn = (key: string) => (hover?.key === key ? hoveredRect(hotOf.get(key) ?? [], hover.at) : undefined)
const sameRect = (a: Rect | undefined, b: Rect | undefined) => a?.x === b?.x && a?.y === b?.y && a?.w === b?.w && a?.h === b?.h

/** The pointer moved over a window (or left it): drawn again only when what it lights changes. */
const onHover = ($: EngineInterface, element: string, at: Pos | null) => {
  const key = element.replace(/-clicks$/, '')
  const before = litIn(key)
  hover = at === null ? null : { key, at: pixel(at) }
  if (!sameRect(before, litIn(key))) $.ui.invalidate('ui.render')
}

/** The strip as Raster cells, what the pointer is over lit. */
const stripCells = (g: Game, width: number, boxes: readonly OverlayBox[]) => {
  const c = hudPixels(g, width, boxes)
  return canvasCells({ ...c, px: litWindow('hud', c.px, hudHot(g, width, boxes), width, false) })
}

/** A window's clickable places with its close box (the strip has none); and its pixels with the one under the pointer lit. */
const litWindow = (key: string, px: string[][], hot: readonly Rect[], width = INV_W, hasClose = true) => {
  const [x, y, w, h] = closeBoxOf(width)
  hotOf.set(key, hasClose ? [...hot, { x, y, w, h }] : hot)
  const lit = litIn(key)
  return lit === undefined ? px : lightUp(px, lit)
}
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
const PANEL_ROWS: Partial<Record<Game['panel'], number>> = { sheet: SHEET_ROWS, shop: 3 + WARES.length, forge: 2 + SLOTS.length, stash: 3 + STASH_SIZE, healer: 3, elder: 5, mystic: 4, guard: 3, villager: 3, dog: 4 }

/** The how-it-plays window's rows as text: its head, a line a rule, where things are, the close key. */
const HELP_TEXT_ROWS = HELP_ROWS.length + 3
/** The log as text: its head, every line kept, and Close. */
const LOG_TEXT_ROWS = LOG_KEPT + 3

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
  // A walk cut short takes its footsteps with it; one played out (walk already null) leaves its last sounds to finish.
  if (walk !== null) walkMix?.stop()
  walkMix = null
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
/** Whether the walk playing is the bench's, whose frames are stamped with their number. */
let isBenching = false
/** The map as the pane itself draws it: what the terminal shows from then on. */
const drawnMap = (cells: string) => {
  lastMap = cells
  return cells
}

/**
 * The walk's frames go to the host without waiting for it to take each: a host busy (drawing the chat beside the pane)
 * would otherwise hold every tick and slow the hero. One blit is in flight at a time; a frame drawn meanwhile waits in
 * its place, a newer one replacing it, so the host always gets the latest and the walk keeps its pace.
 */
let mapInFlight: Promise<void> | null = null
let mapWaiting: { cells: string; size: { columns: number; rows: number } } | null = null
/** A walk frame the host refused: the walk gives way to the ordinary drawing on its next frame. */
let isMapRefused = false
const sendLatest = ($: EngineInterface, cells: string, size: { columns: number; rows: number }) => {
  if (mapInFlight !== null) {
    mapWaiting = { cells, size }
    return
  }
  const t0 = fineNow()
  mapInFlight = sendMap($, cells, size).then(painted => {
    repaints.add(fineNow() - t0)
    mapInFlight = null
    if (painted.deny !== undefined) isMapRefused = true
    const next = mapWaiting
    mapWaiting = null
    if (next !== null && !isMapRefused) sendLatest($, next.cells, next.size)
  })
}
/** Lets the walk's frames still on their way land before anything else draws the map; a waiting one is dropped. */
const drainMap = async () => {
  mapWaiting = null
  while (mapInFlight !== null) await mapInFlight
}

/** A tile reached: what happened on it shows now, the strip and log redrawn, its toast and (walk not mixed) its sound played. */
const tellTile = ($: EngineInterface, w: Walk, frame: number) => {
  const reached = frame % FRAMES_PER_TILE === 0 ? w.tiles?.[frame / FRAMES_PER_TILE - 1] : undefined
  if (reached === undefined || reached === w.game) return
  const shown = w.shown ?? w.start
  const { toast, sound } = tellOnTheWay(w, reached, pending?.byHand ?? false, !isPixelDash || reached.panel === 'bag')
  w.shown = reached
  if (toast !== null) $.ui.toast(toast)
  if (soundSettings.effects && sound !== undefined && !w.isMixed) void playEffect($, sound)
  if (reached.log !== shown.log) $.ui.invalidate('ui.render')
}

/**
 * The walk over, or a repaint refused (the pane closed, its size changed): the click it was walking for carried out,
 * a blow struck meanwhile shown with its sounds, the ordinary drawing taking over, and a click that waited for it gone.
 */
const endWalk = async ($: EngineInterface, w: Walk) => {
  if (walk === w) walk = null
  isBenching = false
  await drainMap()
  isMapRefused = false
  await settle($)
  const after = hitsAfterWalk
  hitsAfterWalk = null
  if (after !== null && walk === null) {
    void playSounds($, after.sounds)
    playHits($, after.g, after.hits)
  }
  $.ui.invalidate('ui.render')
  const waiting = queued
  queued = null
  if (waiting !== null) await act($, waiting.action, waiting.byHand)
  return false
}

/** One frame of the walk drawn and sent, timed; the camera following the game as drawn (a walk to the portal is drawn in town, though it ends in the dungeon). */
const drawWalk = ($: EngineInterface, w: Walk, frame: number, at: ReturnType<typeof walkPosition>, size: { columns: number; rows: number }) => {
  const drawnGame = drawnAt(w.game, frame)
  const view = cameraFor(drawnGame, at, size.columns, size.rows)
  const builds = layerBuildCount()
  const drawFrom = fineNow()
  const drawn = pixelMap(drawnGame, size.columns, size.rows, at, view, [], 0, isStrideFrame(frame))
  ;(layerBuildCount() === builds ? keptMaps : builtMaps).add(fineNow() - drawFrom)
  // The bench walk's frames carry their number, so a measure reads which arrived: skipped, repeated, late.
  sendLatest($, isBenching ? stampCells(drawn, frame) : drawn, size)
}

const walkFrame = async ($: EngineInterface, frame: number) => {
  const w = walk
  if (w === null || mapSize === null) return false
  w.frame = frame
  const at = walkPosition(w.path, frame)
  tellTile($, w, frame)
  const step = soundSettings.effects && !at.isDone && !w.isMixed ? stepAt(frame) : undefined
  if (step !== undefined) void playEffect($, step)
  if (at.isDone || isMapRefused) return endWalk($, w)
  drawWalk($, w, frame, at, mapSize)
  return true
}

const startWalk = ($: EngineInterface, path: Pos[], start: Game, game: Game, tiles: Game[] | null = null) => {
  if (walk !== null) walkMix?.stop()
  walkMix = null
  walk = { path, frame: 0, start, game, tiles, shown: null, isMixed: false }
  const mix = soundSettings.effects && !isPaused ? walkClip(start, game, path.length - 1, tiles) : undefined
  if (mix !== undefined && players.length < placesNow()) {
    walk.isMixed = true
    walkMix = startPlayer($, { clip: { base64: mix, mime: 'audio/wav' }, label: 'walk', gain: 1 }, 0)
  }
  ticker.start('walk', frame => walkFrame($, frame), () => $.clock.every(FRAME_MS, () => void $.clock.now().then(ticker.tick)))
}

const ms = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(1))
/**
 * The measure in words: how evenly ticks come, how long a tick takes, how much of that is the host taking the
 * repainted map, how long a whole-pane redraw takes, and how long a walk frame's map takes to draw with its ground layer
 * kept and with it drawn afresh.
 */
export const framesReport = (s: TickStats, repaint: FrameSummary, redraw: FrameSummary, kept: FrameSummary = summarize([]), built: FrameSummary = summarize([])) =>
  s.ticks === 0
    ? 'No frames played yet: walk somewhere first.'
    : `${s.ticks} ticks, ${s.late} late (over ${ms(LATE_MS)} ms after the last), ${s.skipped} skipped while a frame was drawing. ` +
      `Gap between ticks: p50 ${ms(s.interval.p50)}, p99 ${ms(s.interval.p99)}, max ${ms(s.interval.max)} ms. ` +
      `Drawing a tick: p50 ${ms(s.work.p50)}, p99 ${ms(s.work.p99)}, max ${ms(s.work.max)} ms (budget ${FRAME_MS}), ` +
      `of which the host taking the map: p50 ${ms(repaint.p50)}, p99 ${ms(repaint.p99)}, max ${ms(repaint.max)} ms. ` +
      `Whole-pane redraws: ${redraw.count}, p50 ${ms(redraw.p50)}, p99 ${ms(redraw.p99)}, max ${ms(redraw.max)} ms. ` +
      `Drawing the map: ${kept.count} with the ground kept, p50 ${ms(kept.p50)}, p99 ${ms(kept.p99)} ms; ${built.count} drawn afresh, p50 ${ms(built.p50)}, p99 ${ms(built.p99)}, max ${ms(built.max)} ms.`

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

/**
 * A walk that ends by changing place, walked where it began and only its end elsewhere: through town to the portal,
 * or to the stairs and down them.
 */
const isWalkThrough = (before: Game, next: Game) =>
  (before.where === 'town' && next.where === 'dungeon') ||
  (before.where === 'dungeon' && next.where === 'dungeon' && next.depth === before.depth + 1 && same(next.walked.at(-1) ?? before, levelOf(before).stairs))
/** Whether a walk from `before` to `next` plays on screen: a pixel map, and the hero still in the same place, or a walk through. */
const isPlayed = (before: Game, next: Game) => next.walked.length > 0 && (placeOf(next) === placeOf(before) || isWalkThrough(before, next)) && (next.zoom >= 3 || isPixelDash)

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
  const sounds = soundsFor(from, told, hits)
  return { toast: toastFor(from, told, byHand, hasLog), sound: sounds[0], sounds }
}

/** What a walk tells on reaching a tile: what is new against the tile it last told, or its start before the first. */
export const tellOnTheWay = (walked: { start: Game; shown: Game | null }, reached: Game, byHand: boolean, hasLog: boolean) =>
  announce(walked.shown, walked.shown ?? walked.start, reached, byHand, hasLog, [])

/** What an action tells once carried out: what its walk did not already tell on the way (`shown`, its last tile). */
export const tellAtTheEnd = (shown: Game | undefined, before: Game, next: Game, byHand: boolean, hasLog: boolean, hits: readonly Hit[]) =>
  announce(shown ?? null, shown ?? before, next, byHand, hasLog, hits)

/** Applies an action now; `isWalkShown` when its walk has already played, so it is not played again. */
/**
 * The walk on screen after an action: one it walked played, unless already shown; one it walked unseen stopped; else
 * the walk under way keeps drawing the click's plan, what happened to the foe (a tool call striking it) shown at once.
 */
const followWalk = ($: EngineInterface, before: Game, next: Game, isWalkShown: boolean) => {
  if (!isWalkShown && isPlayed(before, next)) startWalk($, [{ x: before.x, y: before.y }, ...next.walked], before, next)
  else if (next.walked.length > 0) stopWalk()
  else if (walk !== null) walk = { ...walk, start: { ...walk.start, foe: next.foe }, game: pending === null ? next : walk.game }
}

/** The saves under way, one after another, so a later game never lands before an earlier one. */
let saving: Promise<unknown> = Promise.resolve()

/** Whether the store holds a save from a newer version of the mod: it is left as it is, the game played unsaved. */
let isSaveHeld = false

/** Keeps the game across sessions as it stands after every change: what is done by hand between turns is not lost. */
const save = ($: EngineInterface, g: Game) => {
  if (isSaveHeld) return
  saving = saving.then(() => $.store.set(SAVE, savable(g))).catch(() => undefined)
}

const commit = async ($: EngineInterface, action: Action, byHand: boolean, isWalkShown: boolean, shown?: Game) => {
  const before = normalize(await read($, game))
  const next = normalize(await update($, game, g => apply(g, action)))
  if (next !== before) save($, next)
  followWalk($, before, next, isWalkShown)
  const hits = hitsBetween(before, next)
  // A death plays on the level the hero fell on, not the one they woke on.
  const scene = deathScene(before, next) ?? next
  // What the walk already showed on its way is not told again.
  const { toast, sounds } = tellAtTheEnd(shown, before, next, byHand, !isPixelDash || next.panel === 'bag', hits)
  if (toast !== null) $.ui.toast(toast)
  syncMusic($, next)
  const isDrawn = hits.length > 0 && isPixelDash && mapSize !== null
  // A blow struck mid-walk is drawn when the walk ends: its sounds wait for it, so they come with its flash.
  if (!isDrawn || walk === null) await playSounds($, sounds)
  if (!isDrawn) return
  // A fall waiting on a walk still holds the death window back.
  if (hits.some(h => h.kind === 'death')) isFalling = true
  if (walk === null) playHits($, scene, hits)
  else hitsAfterWalk = { g: scene, hits, sounds }
}

/** Blows landed while a walk plays, shown once it ends. */
let hitsAfterWalk: { g: Game; hits: readonly Hit[]; sounds: readonly Sound[] } | null = null

/**
 * A blow played out on the map: the struck foe flashing, then the numbers rising over 18 frames, a frame a tick;
 * a walk starting meanwhile takes the map over, and the ordinary drawing takes over at the end.
 */
const playHits = ($: EngineInterface, g: Game, hits: readonly Hit[]) => {
  isHitPlaying = true
  isFalling = hits.some(h => h.kind === 'death')
  ticker.start('hits', async frame => {
    if (walk !== null || mapSize === null || frame >= hitFramesFor(hits)) {
      isHitPlaying = false
      isFalling = false
      if (frame >= hitFramesFor(hits)) await endHits($)
      return false
    }
    const view = cameraFor(g, tileCenter(g), mapSize.columns, mapSize.rows)
    const painted = await sendMap($, pixelMap(g, mapSize.columns, mapSize.rows, undefined, view, hits, frame), mapSize)
    if (painted.deny === undefined) return true
    // A map the host will not take (a window over it, the pane resized) ends the blow: the idle motion and the death
    // window wait on it no longer.
    isHitPlaying = false
    isFalling = false
    $.ui.invalidate('ui.render')
    return false
  }, () => $.clock.every(FRAME_MS, () => void $.clock.now().then(ticker.tick)))
}

/**
 * A blow's frames over: the ordinary map sent as the pane now draws it, then the pane redrawn. The pane's own map may
 * already hold those cells from before the blow, and a host need not repaint a map whose cells it already had, so
 * without the frame the terminal would keep the blow's last one, its number still up.
 */
const endHits = async ($: EngineInterface) => {
  const size = mapSize
  if (size !== null) {
    const g = normalize(await read($, game))
    const view = cameraFor(g, tileCenter(g), size.columns, size.rows)
    await sendMap($, pixelMap(g, size.columns, size.rows, undefined, view, [], 0, false, shown, mapHoverOf(g).lit), size)
  }
  $.ui.invalidate('ui.render')
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
/** The hero's fall is playing: the death window waits for it to end. */
let isFalling = false

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
  await sendMap($, pixelMap(g, size.columns, size.rows, undefined, view, [], 0, false, shown, mapHoverOf(g).lit), size)
}

/** The time, for the idle motion's bookkeeping; a host without a clock leaves the last known time standing. */
const nowOr = ($: EngineInterface, known: number) => $.clock.now().catch(() => known)

/** The idle motion's timer, started once, by the session's start or the first action, whichever comes first. */
let ambientTimer: { cancel: () => void } | null = null
const startAmbient = ($: EngineInterface) => {
  ambientTimer ??= $.clock.every(2 * FRAME_MS, () => void ambientTick($).catch(() => undefined))
}

const act = async ($: EngineInterface, action: Action, byHand = false) => {
  // Paused, the coding goes on without the game: nothing it does moves the hero.
  if (isPaused) return
  // A click or a key is a look at the pane: when enough happened unseen, the recap opens instead of what was asked.
  if (byHand && (await isRecapShown($))) return
  void loadClips($)
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

/** The work a successful shell call came to: the git work the host reports on its record, or a test run. */
const workDone = (e: ToolCallInput, result: unknown) =>
  e.tool === 'Bash' ? workOf(e.command, (result as { gitOperation?: GitOperation } | undefined)?.gitOperation) : undefined

/** The sound as set in settings, started from the `sound` and `music` options, each on unless turned off. */
let soundSettings: SoundSettings = { effects: true, music: true, volume: VOLUME_STEPS }

/**
 * Whether the game is paused: the pane closed and not drawn since. Paused, nothing moves it (tool calls, prompts and
 * turns pass it by), no timer runs, nothing sounds; drawing the pane again takes it up where it stood.
 */
let isPaused = false

/** What the pane closing does: the game paused, its tune and effect stopped, its walk, blow and idle motion too. */
/** Taken up again where it stood, the pane being in front of the player: drawn, opened by /dungeon, or clicked. */
const resume = async ($: EngineInterface) => {
  if (!isPaused) return
  isPaused = false
  startAmbient($)
  syncMusic($, normalize(await read($, game)))
  $.ui.invalidate('ui.render')
}

/** Whether closing the pane `closed` leaves the game unseen: its pane, with none of its panes still open. */
export const isLeftUnseen = (closed: string, open: readonly { id: string }[]) => closed === PANE && !open.some(p => p.id === PANE)

const pause = async ($: EngineInterface) => {
  isPaused = true
  // A walk under way ends as a new action would end it: cut where the hero is drawn, or carried out; nothing it held
  // back (a click that waited for it, its blows) is left to go off once the pane is drawn again.
  await interrupt($, false).catch(() => undefined)
  queued = null
  hitsAfterWalk = null
  music?.stop()
  music = null
  for (const p of players) p.stop()
  players = []
  waiting = []
  stopWalk()
  ticker.stop('hits')
  isHitPlaying = false
  isFalling = false
  ambientTimer?.cancel()
  ambientTimer = null
}

/** A clip to play: the game's own or one it mixed, its name, and its gain in the mix. */
type Play = { clip: { asset: string } | { base64: string; mime: string }; label: string; gain: number }
/** The clips going, each with its stop; and those waiting for a place, oldest first. */
let players: { sound: string; at: number; stop: () => void }[] = []
let waiting: Play[] = []
const placesNow = () => HOST_PLACES - rounds

/** Plays an effect over whatever is sounding, or once a place comes free (`mixFor`); a footstep with none to spare is let go. */
const playEffect = async ($: EngineInterface, clip: Sound) => {
  if (isPaused) return
  const at = await nowOr($, lastActive)
  const fate = mixFor(players.length, placesNow(), clip)
  const play: Play = { clip: { asset: soundAsset(clip) }, label: clip, gain: gainOf(clip) }
  if (fate === 'wait') waiting.push(play)
  else if (fate === 'play') startPlayer($, play, at)
}

/**
 * An action's sounds: one alone as its own clip; several mixed into one, each on its frame (`cuesFor`): the deed, the
 * answer, the aftermath, the fanfare. While the clips are not loaded yet, the greatest alone.
 */
const playSounds = async ($: EngineInterface, sounds: readonly Sound[]) => {
  if (!soundSettings.effects || isPaused || sounds.length === 0) return
  const pcm = sounds.length > 1 && clips !== null ? mixdown(cuesFor(sounds), clips) : undefined
  if (pcm === undefined || pcm.length === 0) return playEffect($, sounds[0]!)
  const at = await nowOr($, lastActive)
  const play: Play = { clip: { base64: base64Of(wavOf(pcm)), mime: 'audio/wav' }, label: sounds.join('+'), gain: 1 }
  if (players.length < placesNow()) startPlayer($, play, at)
  else waiting.push(play)
}

/**
 * Plays a clip, the game's own or one it mixed, at `gain` in the mix and the volume set. Never stopped from here but
 * by a walk cut short or the pane closing: afplay plays the clip through to the speaker and only then exits, and
 * stopping it sooner loses what is still on its way. It holds its place with the host until then, as the host counts
 * it; then a waiting effect goes.
 */
const startPlayer = ($: EngineInterface, play: Play, at: number) => {
  const sounding = new AbortController()
  const player = { sound: play.label, at, stop: () => sounding.abort() }
  players.push(player)
  void $.audio.play(play.clip, { signal: sounding.signal, gain: play.gain * volumeShare(soundSettings) })
    .catch(() => undefined)
    .finally(() => {
      players = players.filter(p => p !== player)
      const next = waiting.shift()
      if (next !== undefined) void nowOr($, at).then(now => startPlayer($, next, now))
    })
  return player
}

/** The game's clips as samples, for its own mixes: read once from its sounds, in the background. */
let clips: Map<Sound, Int16Array> | null = null
let clipsLoading = false
const loadClips = async ($: EngineInterface) => {
  if (clips !== null || clipsLoading) return
  clipsLoading = true
  try {
    const loaded = new Map<Sound, Int16Array>()
    for (const sound of Object.keys(CLIP_MS) as Sound[]) {
      const pcm = readWav(bytesOf((await $.fs.read(`${$.plugin.root}/${soundAsset(sound)}`, { as: 'bytes' })).base64))
      if (pcm !== undefined) loaded.set(sound, pcm)
    }
    clips = loaded
  } catch {
    // Unread, the game sounds clip by clip.
  } finally {
    clipsLoading = false
  }
}

/**
 * A walk's own clip, as base64 WAV: its footsteps and what each tile it reaches comes to, each on its frame; none
 * while the clips are not loaded yet, when the walk sounds clip by clip as before.
 */
const walkClip = (start: Game, game: Game, tileCount: number, tiles: Game[] | null) => {
  if (clips === null) return undefined
  const tileSounds = (tiles ?? []).map((reached, i) => (reached === game ? [] : announce(i === 0 ? null : tiles![i - 1]!, i === 0 ? start : tiles![i - 1]!, reached, false, true, []).sounds))
  const pcm = mixdown(walkCues(tileCount, tileSounds), clips)
  return pcm.length === 0 ? undefined : base64Of(wavOf(pcm))
}

/** Sets the sound; music turned on or off, or a new volume, restarts the tune at its level. */
const setSound = ($: EngineInterface, g: Game, next: SoundSettings) => {
  const isTuneChanged = next.music !== soundSettings.music || next.volume !== soundSettings.volume
  soundSettings = next
  void $.store.set(SOUND, next).catch(() => undefined)
  if (!isTuneChanged) return
  music?.stop()
  music = null
  syncMusic($, g)
}

/** The tune's rounds going (each holds one of the host's places), the tune playing now, and how to stop it. */
let rounds = 0
let music: { stop: () => void } | null = null

/** Starts the town's tune on coming into town and stops it on leaving; the host loops it until stopped. */
const syncMusic = ($: EngineInterface, g: Game) => {
  const tune = isPaused ? undefined : musicFor(g, soundSettings.music)
  if (tune !== undefined && music === null) {
    // Each round started on time by the pane: the host's own loop waits for afplay to exit, about a second after the
    // tune ends, so it fell silent that long every round. The round before is stopped once its last notes have sounded.
    // A round left to play out: it holds its place until afplay exits, a second or so after the next has begun.
    let playing = new AbortController()
    const round = () => {
      rounds += 1
      void $.audio.play({ asset: tune }, { signal: playing.signal, gain: MUSIC_GAIN * volumeShare(soundSettings) })
        .catch(() => undefined)
        .finally(() => (rounds -= 1))
    }
    round()
    const timer = $.clock.every(TUNE_MS, () => {
      playing = new AbortController()
      round()
    })
    music = {
      stop: () => {
        timer.cancel()
        playing.abort()
      },
    }
  } else if (tune === undefined && music !== null) {
    music.stop()
    music = null
  }
}

/** Each action in turn, as the player's own. */
/** Looks at the pane, when tool calls have been counted since the last look: whether the recap opened. */
const isRecapShown = async ($: EngineInterface) => {
  const g = await current($)
  if (g.recap === undefined || g.panel === 'recap') return false
  await act($, { kind: 'look' })
  return (await current($)).panel === 'recap'
}

const actAll = async ($: EngineInterface, actions: readonly Action[]) => {
  for (const action of actions) await act($, action, true)
}
const current = async ($: EngineInterface) => normalize(await read($, game))

/** Each click layer's gestures, to its window: what the window makes of a gesture, its own state kept, and the pane
 * redrawn where the window's look depends on that state. A click on the pixel map walks the hero to the tile under it;
 * one on the strip opens the inventory or uses a belt slot. */
/** The names the map's click layer writes over a tile, in its cells: the tile they lie on, each row's item (none on the
 * row counting the rest), the row the pointer is on. */
type MapLabel = { x: number; y: number; tile: Pos; lines: { text: string; color: string; id?: number }[]; row?: number }
/** Where the pointer rests over the map, in its cells, with the map's size; null off it. */
let mapPointer: { x: number; y: number; columns: number; rows: number } | null = null
/** The tile whose label the pointer moved onto from it: the label stays while the pointer is on it, though the tiles
 * under it are others, so a row can be chosen. */
let pinned: Pos | null = null

/** Whether a click on `tile` acts: in the dungeon a seen floor tile, in town open ground or a townsperson's spot. */
const isClickable = (g: Game, tile: Pos) => {
  if (g.where === 'town') return isTownWalkable(tile) || townSpotAt(tile) !== undefined
  return tile.x >= 0 && tile.y >= 0 && tile.x < MAP_W && tile.y < MAP_H && g.seen[cellId(tile)] === '1' && isFloor(levelOf(g).tiles, tile)
}

/**
 * What the hover shows on the map for the game as it is now, the pointer where it rests: the tile lit while a click
 * there would act, and the name of an item seen lying there. Worked out on every draw, so a step, a pickup or a new
 * depth never leaves a stale one.
 */
const mapHoverOf = (g: Game, pointer = mapPointer): { lit?: PixelRect; label: MapLabel | null } => {
  if (pointer === null) return { label: null }
  const size = { columns: pointer.columns, rows: pointer.rows }
  const view = camera?.place === placeOf(g) ? camera.at : undefined
  const litAt = (tile: Pos) => (isClickable(g, tile) ? tileRect(g, tile, size, view) : undefined)
  const held = pinned === null ? null : labelFor(g, pinned, size, view)
  const row = held === null ? undefined : labelRowAt({ ...held, lines: held.lines.map(l => l.text) }, { x: Math.floor(pointer.x), y: Math.floor(pointer.y) })
  if (held !== null && row !== undefined) return { lit: litAt(held.tile), label: { ...held, row } }
  const tile = clickToTile(g, pointer, view)
  return { lit: litAt(tile), label: labelFor(g, tile, size, view) }
}

/** The label of what lies on a seen tile, in the map's cells; null with nothing there. */
const labelFor = (g: Game, tile: Pos, size: { columns: number; rows: number }, view: Pos | undefined): MapLabel | null => {
  const lying = g.where === 'dungeon' && g.seen[cellId(tile)] === '1' ? (g.floor ?? []).filter(f => f.x === tile.x && f.y === tile.y).map(f => f.item) : []
  if (lying.length === 0) return null
  const { lines } = lyingLabel(lying)
  const at = mapLabelAt(tileToCell(g, tile, size, view), lines.map(l => l.text), size)
  return { x: at.x, y: at.y, tile, lines: at.lines.map((text, i) => ({ text, color: lines[i]!.color ?? INK.dim, id: lines[i]!.id })) }
}

/** What the map's click layer writes for the hover: the label with each cell's ground from the map drawn under it, the
 * row the pointer is on lit as the hover lights a tile. */
const labelOnMap = (label: MapLabel | null, frame: Uint32Array, columns: number) =>
  label === null ? null : { ...label, grounds: labelGrounds(frame, columns, { ...label, lines: label.lines.map(l => l.text) }, label.row) }

/** The pointer over the map (or off it): where it rests kept, the map drawn again when what the hover shows changes. */
const onMapHover = async ($: EngineInterface, data: { x?: number; y?: number; columns?: number; rows?: number }) => {
  const g = await current($)
  const before = JSON.stringify(mapHoverOf(g))
  mapPointer = data.x !== undefined && data.y !== undefined && data.columns !== undefined && data.rows !== undefined ? { x: data.x, y: data.y, columns: data.columns, rows: data.rows } : null
  const hover = mapHoverOf(g)
  pinned = hover.label?.tile ?? null
  if (JSON.stringify(mapHoverOf(g)) !== before) $.ui.invalidate('ui.render')
}

/** A click on the map: on a label's row, that item picked from its tile (the row counting the rest walks there); else
 * the hero walks to the tile under it. */
const onMapClick = async ($: EngineInterface, data: unknown) => {
  await resume($)
  const g = await current($)
  const click = data as { x: number; y: number; columns: number; rows: number }
  const { label } = mapHoverOf(g, click)
  const id = label?.row === undefined ? undefined : label.lines[label.row]?.id
  if (label?.row !== undefined) await act($, id === undefined ? { kind: 'goto', ...label.tile } : { kind: 'pick', ...label.tile, id }, true)
  else await act($, { kind: 'goto', ...clickToTile(g, click, camera?.place === placeOf(g) ? camera.at : undefined) }, true)
}

const onBagClick = async ($: EngineInterface, data: unknown) => {
  const outcome = bagGesture(await current($), bagUi, data as Gesture)
  bagUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onShopClick = async ($: EngineInterface, data: unknown) => {
  const outcome = shopGesture(await current($), shopUi, data as Gesture)
  shopUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onCbagClick = async ($: EngineInterface, data: unknown) => {
  const outcome = compactGesture(await current($), bagUi, data as Gesture)
  bagUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onSheetClick = async ($: EngineInterface, data: unknown) => actAll($, sheetGesture(await current($), data as Gesture))

const onStartClick = async ($: EngineInterface, data: unknown) => {
  const g = await current($)
  const outcome = startGesture(g, startUi ?? { cls: g.cls }, data as Gesture)
  startUi = outcome.ui
  if (outcome.isHelp === true) isHelpOpen = true
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onForgeClick = async ($: EngineInterface, data: unknown) => {
  const outcome = forgeGesture(await current($), forgeUi, data as Gesture)
  forgeUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onTalentClick = async ($: EngineInterface, data: unknown) => {
  const outcome = talentGesture(await current($), talentUi, data as Gesture)
  talentUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}
const onDeepClick = async ($: EngineInterface, data: unknown) => actAll($, deepGesture(await current($), data as Gesture))

const onRetireClick = async ($: EngineInterface, data: unknown) => {
  const outcome = retireGesture(await current($), retireUi, data as Gesture)
  retireUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onChestClick = async ($: EngineInterface, data: unknown) => {
  const outcome = chestGesture(await current($), chestUi, data as Gesture)
  chestUi = outcome.ui
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onTalkClick = async ($: EngineInterface, data: unknown) => {
  const g = await current($)
  if (isSpeaker(g.panel)) await actAll($, talkGesture(g, g.panel, data as Gesture))
}

const onHudClick = async ($: EngineInterface, data: unknown) => {
  const outcome = hudGesture(await current($), beltMenu, data as Gesture, hudWidth)
  beltMenu = outcome.menu
  if (outcome.isLog === true) isLogOpen = true
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

const onDeathClick = async ($: EngineInterface, data: unknown) => actAll($, deathGesture(await current($), data as Gesture))

const onRecapClick = async ($: EngineInterface, data: unknown) => actAll($, recapGesture(await current($), data as Gesture))

const onCodexClick = async ($: EngineInterface, data: unknown) => {
  const g = await current($)
  const outcome = codexGesture(g, codexUi, data as Gesture)
  codexUi = outcome.ui
  if (outcome.isCard) await saveCard($, g)
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

/** The card's file name, in the player's Downloads (their home folder without one). */
const CARD_FILE = 'ascii-dungeon-hero.svg'

/** Where the hero card goes: Downloads under the home folder when there is one, else the home folder, else the working directory. */
const cardPath = async ($: EngineInterface) => {
  const home = await $.env.get('HOME')
  if (home === undefined) return { path: CARD_FILE, said: CARD_FILE }
  const isDownloads = await $.fs.exists(`${home}/Downloads`)
  return isDownloads ? { path: `${home}/Downloads/${CARD_FILE}`, said: `~/Downloads/${CARD_FILE}` } : { path: `${home}/${CARD_FILE}`, said: `~/${CARD_FILE}` }
}

/** The hero card saved as an SVG and copied as text, and the toast saying what came of each. */
const saveCard = async ($: EngineInterface, g: Game) => {
  const { path, said } = await cardPath($)
  const saved = await $.fs.write(path, svgOf(cardPixels(g))).then(() => true, () => false)
  const copied = await $.ui.copy({ text: cardText(g) })
  const text = copied.isCopied ? 'Text copied.' : 'The text could not be copied.'
  $.ui.toast(saved ? `Hero card saved to ${said}. ${text}` : `The hero card could not be saved to ${said}. ${text}`)
}

const onSettingsClick = async ($: EngineInterface, data: unknown) => {
  const g = await current($)
  const outcome = settingsGesture(g, soundSettings, settingsUi, data as Gesture)
  settingsUi = outcome.ui
  if (outcome.isHelp === true) isHelpOpen = true
  setSound($, g, outcome.sound)
  await actAll($, outcome.actions)
  $.ui.invalidate('ui.render')
}

/** A gesture to the window whose click layer it came from; false when no layer of the pane's sent it. */
const onClick = async ($: EngineInterface, element: string, data: unknown) => {
  switch (element) {
    case 'map-clicks':
      await onMapClick($, data)
      return true
    case 'bag-clicks':
      await onBagClick($, data)
      return true
    case 'shop-clicks':
      await onShopClick($, data)
      return true
    case 'cbag-clicks':
      await onCbagClick($, data)
      return true
    case 'sheet-clicks':
      await onSheetClick($, data)
      return true
    case 'start-clicks':
      await onStartClick($, data)
      return true
    case 'forge-clicks':
      await onForgeClick($, data)
      return true
    case 'chest-clicks':
      await onChestClick($, data)
      return true
    case 'talk-clicks':
      await onTalkClick($, data)
      return true
    case 'hud-clicks':
      await onHudClick($, data)
      return true
    case 'death-clicks':
      await onDeathClick($, data)
      return true
    case 'recap-clicks':
      await onRecapClick($, data)
      return true
    case 'codex-clicks':
      await onCodexClick($, data)
      return true
    case 'retire-clicks':
      await onRetireClick($, data)
      return true
    case 'talent-clicks':
      await onTalentClick($, data)
      return true
    case 'deep-clicks':
      await onDeepClick($, data)
      return true
    case 'log-clicks':
      if (logGesture(data as Gesture)) isLogOpen = false
      $.ui.invalidate('ui.render')
      return true
    case 'help-clicks':
      if (helpGesture(data as Gesture)) isHelpOpen = false
      $.ui.invalidate('ui.render')
      return true
    case 'settings-clicks':
      await onSettingsClick($, data)
      return true
    default:
      return false
  }
}

/** Plays the bench walk on screen only (the rules never move), after forgetting what was measured before. */
const startBench = async ($: EngineInterface) => {
  if (mapSize === null || !isPixelDash) return { text: 'Open the dungeon pane on the pixel map, then run /dungeon-bench again.' }
  await settle($)
  const bench = normalize({ ...newGame(BENCH_SEED), seen: '1'.repeat(MAP_W * MAP_H) })
  ticker.reset()
  repaints.reset()
  redraws.reset()
  keptMaps.reset()
  builtMaps.reset()
  isBenching = true
  startWalk($, benchRoute(bench, BENCH_TILES), bench, bench)
  return { text: `Bench walk started: ${BENCH_TILES} tiles, about ${Math.ceil((BENCH_TILES * FRAMES_PER_TILE * FRAME_MS) / 1000)} s. Run /dungeon-frames once the hero stops.` }
}

/** The session begun: the commands, the idle motion, the saved game opened if the session has none yet, the pane. */
const beginSession = async ($: EngineInterface) => {
  // A load starts the sound from the options; what was set in settings since is kept, and wins.
  soundSettings = soundFrom(await $.store.get(SOUND).catch(() => undefined), soundSettings)
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
  const saved: unknown = await $.store.get(SAVE)
  isSaveHeld = isFromLater(saved)
  if (isSaveHeld) $.ui.toast('This save is from a newer version of the dungeon: it is kept as it is, and play goes on unsaved until the mod is updated.')
  // A save that cannot be read is kept aside before a new game is saved over it.
  else if (version === 0 && saved !== undefined && !isReadable(saved)) {
    await $.store.set(UNREADABLE, saved)
    $.ui.toast(`The saved game could not be read: it is kept aside, under "${UNREADABLE}" in the plugin's store, and a new game begins.`)
  }
  const opening = openingGame(await read($, game), version, saved)
  if (opening !== undefined) await update($, game, () => opening)
  await act($, { kind: 'greet' })
  void $.ui.open(OPEN)
}

/** What every part of the pane's drawing works from: the surface's elements, the game as it is, and how a key acts. */
const paneOf = ($: EngineInterface, e: RenderInput<'Pane'>, g: Game) => {
  const { Box, Text, Button } = $.ui.resolve(e)
  const Raster = e.surface === 'terminal' ? $.ui.resolve(e).Raster : undefined
  const Client = e.surface === 'terminal' ? $.ui.resolve(e).Client : undefined
  const press = (action: Action) => () => act($, action, true)
  // What the windows do with the engine, as closures: the engine itself never leaves the hook it came to.
  const redraw = () => $.ui.invalidate('ui.render')
  const run = (action: Action, byHand = false) => act($, action, byHand)
  const setSoundTo = (next: SoundSettings) => setSound($, g, next)
  const shareCard = () => saveCard($, g)
  const line = (runs: Run[]) => (
    <Text wrap="truncate-end">
      {runs.map(run => (
        <Text color={run.color} backgroundColor={run.bg} bold={run.bold} inverse={run.inverse} dimColor={run.dim}>
          {run.text}
        </Text>
      ))}
    </Text>
  )
  /** The last two lines of the log, dim, under a window. */
  // The log's last two lines under a window; a click on them opens the whole log (no key: a window's keys take g).
  const logTail = () => (
    <Box flexDirection="column" marginTop={1}>
      {logRuns(g, 2).map((entry, i) => (
        <Button key={`log-tail-${i}`} plain onPress={() => { isLogOpen = true; redraw() }}>
          <Text dimColor wrap="truncate-end">
            {'> '}
            {entry.text}
          </Text>
        </Button>
      ))}
    </Box>
  )
  // Wide enough for a pixel window over the whole pane.
  const isWindowWide = Raster !== undefined && e.props.bodyColumns >= INV_W
  return { e, g, Box, Text, Button, Raster, Client, press, redraw, run, setSoundTo, shareCard, line, logTail, isWindowWide }
}
type Pane = ReturnType<typeof paneOf>

/** The pane's sizes for this draw, from its width and rows and the window open: pure arithmetic, nothing kept. */
const sizesOf = (p: Pane) => {
  const { e, g, Raster } = p
  const columns = e.props.bodyColumns
  const isPixelBag = g.panel === 'bag' && Raster !== undefined && columns >= INV_W
  const isCompactBag = g.panel === 'bag' && Raster !== undefined && !isPixelBag && columns >= COMPACT_W
  // While the bag is open the map gives up the rows the bag needs, down to a strip.
  const hasHud = Raster !== undefined && columns >= HUD_COLUMNS
  const hudRows = hudLayout(columns).height / 2
  // The dashboard's rows: the pixel strip alone, or five text rows and a 5-line log; the character sheet's when open.
  const dashRows = (hasHud ? hudRows : 14) + (isLogOpen ? LOG_TEXT_ROWS : isHelpOpen ? HELP_TEXT_ROWS : (PANEL_ROWS[g.panel] ?? 0))
  // The pane's top row, while it is short of the size the game plays best in: too narrow first, else too short.
  const topNote = Raster === undefined ? undefined : (widthNote(columns) ?? sizeNote(columns, e.props.scroll.bodyRows))
  // The pixel inventory opens as a window over the map, so the map keeps its rows; the text bag sits inline below.
  const mapRoom = e.props.scroll.bodyRows - dashRows - (topNote === undefined ? 0 : 1) - (g.panel === 'bag' && !isPixelBag && !isCompactBag ? 12 : 0)
  // With the pixel dashboard there is no view key: the map is always pixels.
  const isPixelView = Raster !== undefined && (hasHud || g.zoom === 3)
  const pixelRows = isPixelView ? Math.max(PX / 2, Math.min((MAP_H * PX) / 2, mapRoom)) : undefined
  // No frame around the map: it takes the pane's full width.
  return { isWide: columns >= 44, mapWidth: Math.max(10, columns), isPixelBag, isCompactBag, hasHud, hudRows, mapRoom, isPixelView, pixelRows, topNote }
}

/**
 * How the pane lays out this draw, the module's view of it kept as it goes: the strip's width and belt menu, whether
 * the strip is pixels, the map's size, where the walking hero is drawn and the camera.
 */
const layOut = (p: Pane) => {
  const { e, g } = p
  hudWidth = e.props.bodyColumns
  // A belt slot's menu, while the slot still holds something to choose.
  const menuBox = beltMenu === null ? undefined : beltMenuBox(g, beltMenu, hudWidth)
  if (menuBox === undefined) beltMenu = null
  const sizes = sizesOf(p)
  isPixelDash = sizes.hasHud
  const card = itemCard(g).map(p.line)
  const { mapWidth, pixelRows } = sizes
  if (pixelRows !== undefined) mapSize = { columns: mapWidth, rows: pixelRows }
  const { heroAt, drawn } = pixelRows !== undefined ? walkingAt(g) : { heroAt: undefined, drawn: g }
  // The strip, the status and the log as the walk stands: what lies ahead not yet taken.
  const told = walk?.tiles != null ? walkState(walk.start, walk.tiles, walk.frame) : g
  const view = pixelRows !== undefined ? cameraFor(g, heroAt ?? tileCenter(g), mapWidth, pixelRows) : undefined
  return { ...sizes, menuBoxes: menuBox === undefined ? [] : [menuBox], card, heroAt, drawn, told, view }
}
type Layout = ReturnType<typeof layOut>

const bagActions = ({ Box, Button, press }: Pane) => (
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

/** The settings' keys; the orders' hotkeys only where the window has the pane to itself, the dashboard's d and k being taken. */
const settingsKeys = (p: Pane, isWindow = false) => {
  const { g, Button, press, redraw, setSoundTo } = p
  const orderKey = (which: 'drink' | 'smoke' | 'leave', hotkey: string) => {
    const word = orderWord(g, which).toLowerCase().replace(/\bhp\b/, 'HP')
    return <Button key={`settings-${which}`} label={word[0]!.toUpperCase() + word.slice(1)} hotkey={isWindow ? hotkey : undefined} plain onPress={press({ kind: 'order', order: which })} />
  }
  const soundKey = (does: 'effects' | 'music' | 'volume') => () => {
    setSoundTo(nextSound(soundSettings, does))
    redraw()
  }
  const game = [
    <Button key="settings-new" label="New game..." hotkey="n" plain onPress={press({ kind: 'panel', panel: 'start' })} />,
    helpKey(p, isWindow ? 'h' : undefined),
    <Button key="settings-effects" label={soundSettings.effects ? 'Sound: on' : 'Sound: off'} hotkey="e" plain onPress={soundKey('effects')} />,
    <Button key="settings-music" label={soundSettings.music ? 'Music: on' : 'Music: off'} hotkey="m" plain onPress={soundKey('music')} />,
    <Button key="settings-view" label={VIEW_LABEL[g.zoom]} hotkey="v" plain onPress={press({ kind: 'zoom' })} />,
    <Button key="settings-volume" label={`Volume: ${(100 * soundSettings.volume) / VOLUME_STEPS}%`} hotkey="l" plain onPress={soundKey('volume')} />,
  ]
  const orders = [orderKey('drink', 'd'), orderKey('smoke', 'f'), orderKey('leave', 'k')]
  const close = <Button key="settings-close" label="Close" hotkey={isWindow ? 'c' : undefined} plain onPress={press({ kind: 'panel', panel: 'settings' })} />
  if (!isWindow) return [...game, ...orders, close]
  // The window's keys are its page's, and the other page.
  const isGame = settingsUi.page === 'game'
  const other = (
    <Button key="settings-page" label={isGame ? 'Orders' : 'Game'} hotkey="p" plain onPress={() => {
      settingsUi = { page: isGame ? 'orders' : 'game' }
      redraw()
    }} />
  )
  return [...(isGame ? game : orders), other, close]
}

/** Help: the how-it-plays window, over whatever is open. */
const helpKey = ({ Button, redraw }: Pane, hotkey?: string) => (
  <Button key="help-open" label="How it plays" hotkey={hotkey} plain onPress={() => { isHelpOpen = true; redraw() }} />
)
/** The log's latest line under the map, a button that opens the whole log (g, unless a window open answers to it). */
const logLine = ({ Button, Text, redraw }: Pane, entry: Run | undefined, taken: ReadonlySet<string>) => (
  <Button key="log-line" hotkey={taken.has('g') ? undefined : 'g'} plain onPress={() => { isLogOpen = true; redraw() }}>
    <Text dimColor={entry?.dim} wrap="truncate-end">{`> ${entry?.text ?? ''}`}</Text>
  </Button>
)

const logClose = ({ Button, redraw }: Pane, hotkey?: string) => (
  <Button key="log-close" label="Close" hotkey={hotkey} plain onPress={() => { isLogOpen = false; redraw() }} />
)

/** The log as text: every line kept, oldest first, and Close. */
const textLog = (p: Pane) => (
  <p.Box flexDirection="column">
    <p.Text bold>Log</p.Text>
    {logRuns(p.g, LOG_KEPT).map(entry => <p.Text dimColor={entry.dim} wrap="truncate-end">{entry.text}</p.Text>)}
    <p.Box columnGap={2}>{logClose(p)}</p.Box>
  </p.Box>
)

const helpClose = ({ Button, redraw }: Pane, hotkey?: string) => (
  <Button key="help-close" label="Close" hotkey={hotkey} plain onPress={() => { isHelpOpen = false; redraw() }} />
)

/** The how-it-plays window as text: a line a rule, then where things are. */
const textHelp = (p: Pane) => {
  const { Box, Text } = p
  return (
    <Box flexDirection="column">
      <Text bold>How it plays: your coding plays the hero</Text>
      {HELP_ROWS.map(r => <Text key={`help-${r.icon}`} color={r.work === true ? INK.good : undefined}>{`${r.when}: ${r.does.toLowerCase()}.`}</Text>)}
      <Text dimColor>You pick the gear and talents and set the orders: the bag (i), the character sheet (c), settings.</Text>
      <Box columnGap={2}>{helpClose(p)}</Box>
    </Box>
  )
}

const playOnKey = ({ Button, press }: Pane, hotkey?: string) => <Button key="recap-play" label="Play on" hotkey={hotkey} plain onPress={press({ kind: 'panel', panel: 'recap' })} />
const wakeKey = ({ Button, press }: Pane) => <Button key="death-wake" label="Wake" hotkey="w" plain onPress={press({ kind: 'panel', panel: 'death' })} />

/** A pixel window over the whole pane: its raster and click layer, the keys under it, the last two log lines. */
/** A window's top row while the pane cannot show it whole: the rows it needs and the pane has. */
const fitLine = (p: Pane, rows: number, under: number) => {
  const note = fitNote(rows, under, p.e.props.scroll.bodyRows)
  return note === undefined ? undefined : <p.Text dimColor wrap="truncate-end">{note}</p.Text>
}

/** The line over the keys' row under a window, saying how to reach them: the composer has the keyboard until ctrl+x tab
 * gives it to the pane (a click on a window does not). */
const keysHint = ({ Box, Text }: Pane) => (
  <Box marginTop={1}>
    <Text dimColor>ctrl+x tab for keys:</Text>
  </Box>
)

const pixelWindow = (p: Pane, key: string, height: number, drawn: string[][], boxes: readonly OverlayBox[], keys: RenderChildren, hint?: string, hot: readonly Rect[] = [], hasClose = true) => {
  const { Box, Text, Raster, Client } = p
  const px = litWindow(key, drawn, hot, INV_W, hasClose)
  const text = onPixels([...chromeBoxes(drawn), ...boxes], litIn(key))
  return (
    <Box flexDirection="column">
      {fitLine(p, height / 2, UNDER_WINDOW + (hint === undefined ? 0 : HINT_ROWS))}
      <Box flexDirection="column" alignItems="center">
        <Box>
          {Raster !== undefined && <Raster key={key} columns={INV_W} rows={height / 2} cells={canvasCells({ w: INV_W, h: height, px })} />}
          {Client !== undefined && (
            <Box position="absolute" top={0} left={0}>
              <Client key={`${key}-clicks`} module="./windowclient.ts" props={{ columns: INV_W, rows: height / 2, boxes: text }} width={INV_W} height={height / 2} />
            </Box>
          )}
        </Box>
      </Box>
      {keysHint(p)}
      <Box columnGap={2}>{keys}</Box>
      {hint !== undefined && <Text dimColor>{hint}</Text>}
      {p.logTail()}
    </Box>
  )
}

/** The pixel inventory takes the whole pane while it is open: the bag, the item card and the controls, nothing else. */
const pixelBag = (p: Pane, l: Layout) => {
  const { redraw, run, g, Box, Text, Button, Raster, Client, press } = p
  const rows = (INV_TOP + INV_H) / 2
  const popovers = bagOverlay(g, bagUi)
  const drawn = inventoryScreenPixels(g, bagUi.drag ?? undefined, popovers)
  const destroyKey = () => {
    const id = g.cursor
    if (id === null) return
    if (bagUi.menu?.id === id && bagUi.menu.confirm) {
      bagUi = BAG_UI_IDLE
      void run({ kind: 'destroy' })
    } else {
      bagUi = { ...bagUi, menu: { id, confirm: true } }
      redraw()
    }
  }
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" alignItems="center">
        <Box>
          {Raster !== undefined && <Raster key="bag" columns={INV_W} rows={rows} cells={canvasCells({ w: INV_W, h: rows * 2, px: litWindow('bag', drawn, inventoryHot(g, bagUi), INV_W, bagUi.menu === null) })} />}
          {Client !== undefined && (
            <Box position="absolute" top={0} left={0}>
              <Client key="bag-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows, boxes: onPixels([...chromeBoxes(drawn), ...popovers], litIn('bag')) }} width={INV_W} height={rows} />
            </Box>
          )}
        </Box>
      </Box>
      {g.cursor === null && <Box flexDirection="column" marginTop={1}>{l.card}</Box>}
      {keysHint(p)}
      <Box columnGap={2}>
        {bagActions(p)}
        <Button key="destroy" label={bagUi.menu?.confirm === true ? 'Destroy? again' : 'Destroy'} hotkey="d" plain onPress={destroyKey} />
        <Button key="bag" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'bag' })} />
      </Box>
      <Text dimColor>Click an item to compare it, again (or right-click) for its menu; drag it onto its slot to wear it.</Text>
      {p.logTail()}
    </Box>
  )
}

/** The merchant's window takes the whole pane while it is open, like the inventory. */
const pixelShop = (p: Pane) => {
  const { redraw, run, g, Box, Text, Button, Raster, Client, press } = p
  const rows = SHOP_H / 2
  const boxes = shopOverlay(g, shopUi)
  const showWare = (ui: ShopUi) => () => {
    shopUi = ui
    redraw()
  }
  const buyKey = async () => {
    if (shopUi.ware === null) {
      shopUi = { ware: 'health1', menu: false }
      redraw()
    } else await run({ kind: 'buy', ware: shopUi.ware }, true)
  }
  const onItem = (action: Action) => async () => {
    shopUi = SHOP_UI_IDLE
    await run(action, true)
  }
  const chosen = shopUi.ware
  const junk = junkValue(g)
  const drawn = shopPixels(g, shopUi, boxes)
  return (
    <Box flexDirection="column">
      {fitLine(p, rows, UNDER_WINDOW + HINT_ROWS)}
      <Box flexDirection="column" alignItems="center">
        <Box>
          {Raster !== undefined && <Raster key="shop" columns={INV_W} rows={rows} cells={canvasCells({ w: INV_W, h: SHOP_H, px: litWindow('shop', drawn, shopHot(g, shopUi), INV_W, !shopUi.menu) })} />}
          {Client !== undefined && (
            <Box position="absolute" top={0} left={0}>
              <Client key="shop-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows, boxes: onPixels([...chromeBoxes(drawn), ...boxes], litIn('shop')) }} width={INV_W} height={rows} />
            </Box>
          )}
        </Box>
      </Box>
      {keysHint(p)}
      <Box columnGap={2}>
        <Button key="shop-buy" label="Buy" hotkey="b" plain dimColor={chosen !== null && whyNot(g, chosen) !== undefined} onPress={buyKey} />
        <Button key="shop-ware" label="Next ware" hotkey="w" plain onPress={showWare(nextWare(shopUi))} />
        <Button key="shop-sell" label="Sell" hotkey="s" plain dimColor={g.cursor === null || chosen !== null} onPress={onItem({ kind: 'sell' })} />
        <Button key="shop-junk" label={junk.count === 0 ? 'Sell junk' : `Sell junk (${junk.count})`} hotkey="x" plain dimColor={junk.count === 0} onPress={onItem({ kind: 'sellJunk' })} />
        <Button key="shop-undo" label="Undo sale" hotkey="u" plain dimColor={whyNotBuyBack(g) !== undefined} onPress={onItem({ kind: 'buyBack' })} />
        <Button key="shop-next" label="Next item" hotkey="n" plain onPress={onItem({ kind: 'cycle' })} />
        <Button key="shop-equip" label="Equip" hotkey="e" plain dimColor={g.cursor === null || chosen !== null} onPress={onItem({ kind: 'equip' })} />
        <Button key="shop-close" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'shop' })} />
      </Box>
      <Text dimColor>Click a ware or an item to see it, again (or right-click) for its menu.</Text>
      {p.logTail()}
    </Box>
  )
}

/** The start screen: the heroes to choose from and Start; a pixel window when wide enough, else text. */
const startScreen = (p: Pane) => {
  const { redraw, run, g, Box, Text, Button, press } = p
  const ui = startUi ?? { cls: g.cls }
  const choose = (cls: HeroClass) => () => {
    startUi = { cls }
    redraw()
  }
  const keys = [
    ...HEROES.map((cls, i) => <Button key={`start-${cls}`} label={cls === ui.cls ? `[${CLASS_NAME[cls]}]` : CLASS_NAME[cls]} hotkey={String(i + 1)} plain dimColor={cls !== ui.cls} onPress={choose(cls)} />),
    <Text dimColor>|</Text>,
    <Button key="start-go" label={`Start as ${CLASS_NAME[ui.cls]}`} hotkey="s" plain onPress={press(begin(ui.cls))} />,
    helpKey(p, 'h'),
    ...(isUnderWay(g) ? [<Button key="start-back" label="Back to your game" hotkey="b" plain onPress={press({ kind: 'panel', panel: 'start' })} />] : []),
  ]
  if (p.isWindowWide) return pixelWindow(p, 'start', startHeight(g, ui), startPixels(g, ui), startOverlay(g, ui), keys, 'Click a hero to choose, again (or Start) to begin.', startHot(g))
  return (
    <Box flexDirection="column">
      <Text bold>New game: choose your hero</Text>
      <Box columnGap={2} flexWrap="wrap">{keys}</Box>
      <Text wrap="wrap">{classAbout(ui.cls)}</Text>
      <Text dimColor wrap="wrap">{STATS_LINE}</Text>
    </Box>
  )
}

/** Too narrow for the full inventory, wide enough for this: the bag and the belt in pixels, what is worn as a list. */
const compactBag = (p: Pane) => {
  const { g, Box, Text, Button, Raster, Client, press } = p
  const boxes = compactOverlay(g, bagUi)
  const drawn = compactPixels(g, boxes)
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" alignItems="center">
        <Box>
          {Raster !== undefined && <Raster key="cbag" columns={COMPACT_W} rows={COMPACT_H / 2} cells={canvasCells({ w: COMPACT_W, h: COMPACT_H, px: litWindow('cbag', drawn, compactHot(g, bagUi), COMPACT_W, bagUi.menu === null) })} />}
          {Client !== undefined && (
            <Box position="absolute" top={0} left={0}>
              <Client key="cbag-clicks" module="./windowclient.ts" props={{ columns: COMPACT_W, rows: COMPACT_H / 2, boxes: onPixels([...chromeBoxes(drawn), ...boxes], litIn('cbag')) }} width={COMPACT_W} height={COMPACT_H / 2} />
            </Box>
          )}
        </Box>
      </Box>
      <Box marginTop={1} columnGap={2} flexWrap="wrap">
        {bagActions(p)}
        <Button key="bag" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'bag' })} />
      </Box>
      <Text dimColor>Click an item to compare it, again for its menu; drag it to move it. Click what you wear to take it off.</Text>
    </Box>
  )
}

const sheetWindow = (p: Pane) => {
  const { g, Button, press } = p
  return pixelWindow(p, 'sheet', SHEET_H, sheetPixels(g), sheetOverlay(g), [
    ...ATTRIBUTES.map((a, i) => <Button key={`train-${a.stat}`} label={`+${a.label.trim()}`} hotkey={String(i + 1)} plain dimColor={g.points === 0} onPress={press({ kind: 'train', stat: a.stat })} />),
    <Button key="sheet-codex" label="Codex" hotkey="x" plain onPress={press({ kind: 'panel', panel: 'codex' })} />,
    retireKey(p, 'r'),
    talentKey(p, 't'),
    deepKey(p, 'd'),
    <Button key="sheet-close" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />,
  ], g.points > 0 ? 'Click a + (or press its number) to spend a point.' : undefined, [...sheetHot(g), ...heroTabsHot(g, 'sheet')])
}

/** Retire on the sheet: dimmed, and doing nothing, until the hero has slain a big boss. */
const retireKey = ({ g, Button, press }: Pane, hotkey?: string) => (
  <Button key="sheet-retire" label="Retire" hotkey={hotkey} plain dimColor={!canRetire(g)} onPress={canRetire(g) ? press({ kind: 'panel', panel: 'retire' }) : () => undefined} />
)

/** Talent on the sheet: marked while a talent is owed. */
const talentKey = ({ g, Button, press }: Pane, hotkey?: string) => (
  <Button key="sheet-talent" label={owed(g) > 0 ? `Talent (${owed(g)})` : 'Talent'} hotkey={hotkey} plain onPress={press({ kind: 'panel', panel: 'talent' })} />
)

/** Deep on the sheet: marked while a fork waits. */
const deepKey = ({ g, Button, press }: Pane, hotkey?: string) => (
  <Button key="sheet-deep" label={isForkOpen(g) ? 'Deep (choose)' : 'Deep'} hotkey={hotkey} plain onPress={press({ kind: 'panel', panel: 'deep' })} />
)

/** The fork's two marks, a key each, the easier first; the window's own close. */
const deepKeys = ({ g, Button, press }: Pane, isWindow: boolean) => {
  const fork = forkTier(g)
  const chosen = fork === undefined ? undefined : g.marks?.[fork]
  return [
    ...(fork === undefined ? [] : pairOf(g.world, fork)).map((m, i) => (
      <Button key={`deep-${m}`} label={isWindow ? MARKS[m].name : `${MARKS[m].name}: ${MARKS[m].does}`} hotkey={isWindow ? 'ab'[i] : undefined} plain dimColor={chosen !== undefined && chosen !== m} onPress={press({ kind: 'mark', mark: m })} />
    )),
    <Button key="deep-close" label="Close" hotkey={isWindow ? 'c' : undefined} plain onPress={press({ kind: 'panel', panel: 'deep' })} />,
  ]
}

/** The talents offered, a key each taking it; in the window Take for the chosen card, and Later; the window's own close. */
const talentKeys = ({ g, Button, press, redraw }: Pane, isWindow: boolean) => {
  const offered = offer(g)
  const chosen = offered[Math.min(talentUi.chosen, offered.length - 1)]
  // In the window a number chooses its card, as on the start screen, and Take takes it; as text each takes its own.
  const choose = (i: number) => () => {
    talentUi = { chosen: i }
    redraw()
  }
  const windowKey = (t: Talent, i: number) => (
    <Button key={`talent-${t}`} label={t === chosen ? `[${TALENTS[t].name}]` : TALENTS[t].name} hotkey={String(i + 1)} plain dimColor={t !== chosen} onPress={choose(i)} />
  )
  return [
    ...offered.map((t, i) => (isWindow ? windowKey(t, i) : <Button key={`talent-${t}`} label={`${TALENTS[t].name}: ${TALENTS[t].does}`} plain onPress={press({ kind: 'talent', talent: t })} />)),
    ...(isWindow && chosen !== undefined ? [<Button key="talent-take" label="Take" hotkey="t" plain onPress={press({ kind: 'talent', talent: chosen })} />] : []),
    <Button key="talent-close" label={offered.length > 0 ? 'Later' : 'Close'} hotkey={isWindow ? (offered.length > 0 ? 'l' : 'c') : undefined} plain onPress={press({ kind: 'panel', panel: 'talent' })} />,
  ]
}

const retireWindow = (p: Pane) => {
  const { redraw, g, Button, press } = p
  const slot = chosenSlot(g, retireUi)
  return pixelWindow(p, 'retire', retireHeight(g, retireUi), retirePixels(g, retireUi), retireOverlay(g, retireUi), [
    <Button key="retire-go" label="Retire" hotkey="r" plain dimColor={slot === undefined || whyNotRetire(g, slot) !== undefined} onPress={slot === undefined ? () => undefined : press({ kind: 'retire', slot })} />,
    <Button key="retire-next" label="Next piece" hotkey="w" plain onPress={() => {
      retireUi = nextWorn(g, retireUi)
      redraw()
    }} />,
    <Button key="retire-back" label="Back" hotkey="b" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />,
  ], 'Click a piece you wear to pass it down.', retireHot(g, retireUi))
}

const forgeWindow = (p: Pane) => {
  const { redraw, run, g, Button, press } = p
  const slot = chosenSlot(g, forgeUi)
  const item = slot === undefined ? undefined : g.gear[slot]
  return pixelWindow(p, 'forge', forgeHeight(g, forgeUi), forgePixels(g, forgeUi), forgeOverlay(g, forgeUi), [
    <Button key="forge-temper" label="Temper" hotkey="t" plain dimColor={item === undefined || whyNotTemper(g, item) !== undefined} onPress={press(slot === undefined ? { kind: 'temper', slot: 'weapon' } : { kind: 'temper', slot })} />,
    <Button key="forge-reforge" label="Reforge" hotkey="r" plain dimColor={item === undefined || whyNotReforge(g, item) !== undefined} onPress={press(slot === undefined ? { kind: 'reforge', slot: 'weapon' } : { kind: 'reforge', slot })} />,
    <Button key="forge-keep" label="Keep old" hotkey="k" plain dimColor={keptChoice(g) === undefined} onPress={press({ kind: 'keepOld' })} />,
    <Button key="forge-next" label="Next piece" hotkey="w" plain onPress={() => {
      forgeUi = nextWorn(g, forgeUi)
      redraw()
    }} />,
    <Button key="forge-close" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'forge' })} />,
  ], 'Click a piece you wear to choose it, then a job.', forgeHot(g, forgeUi))
}

const stashWindow = (p: Pane) => {
  const { redraw, run, g, Button, press } = p
  const boxes = chestOverlay(g, chestUi)
  const stored = g.stashed.find(i => i.id === chestUi.stored)
  const take = async () => {
    if (stored === undefined) return
    chestUi = CHEST_UI_IDLE
    await run({ kind: 'retrieve', id: stored.id }, true)
  }
  const onBag = (action: Action) => async () => {
    chestUi = CHEST_UI_IDLE
    await run(action, true)
  }
  return pixelWindow(p, 'chest', CHEST_H, chestPixels(g, chestUi, boxes), boxes, [
    <Button key="chest-store" label="Store" hotkey="s" plain dimColor={g.cursor === null || chestUi.stored !== null || whyNotStore(g) !== undefined} onPress={onBag({ kind: 'store' })} />,
    <Button key="chest-take" label="Take" hotkey="t" plain dimColor={stored === undefined || whyNotTake(g, stored) !== undefined} onPress={take} />,
    <Button key="chest-next" label="Next in the chest" hotkey="w" plain onPress={() => {
      chestUi = nextStored(g, chestUi)
      redraw()
    }} />,
    <Button key="chest-bag" label="Next item" hotkey="n" plain onPress={onBag({ kind: 'cycle' })} />,
    <Button key="stash-close" label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: 'stash' })} />,
  ], 'Click a chest row or a bag item to see it, again (or right-click) to move it.', chestHot(g, chestUi), !chestUi.menu)
}

/** A townsperson's window takes the whole pane while it is open, like the merchant's. */
const talkWindow = (p: Pane, who: Speaker) => {
  const { g, Box, Button, Raster, Client, press } = p
  const height = talkHeight(g, who)
  const boxes = talkOverlay(g, who)
  const deed = talkAction(g, who)
  const drawn = talkPixels(g, who)
  return (
    <Box flexDirection="column">
      {fitLine(p, height / 2, UNDER_WINDOW)}
      <Box flexDirection="column" alignItems="center">
        <Box>
          {Raster !== undefined && <Raster key="talk" columns={INV_W} rows={height / 2} cells={canvasCells({ w: INV_W, h: height, px: litWindow('talk', drawn, talkHot(g, who)) })} />}
          {Client !== undefined && (
            <Box position="absolute" top={0} left={0}>
              <Client key="talk-clicks" module="./windowclient.ts" props={{ columns: INV_W, rows: height / 2, boxes: onPixels([...chromeBoxes(drawn), ...boxes], litIn('talk')) }} width={INV_W} height={height / 2} />
            </Box>
          )}
        </Box>
      </Box>
      {keysHint(p)}
      <Box columnGap={2}>
        {deed !== undefined && <Button key="talk-act" label={deed.label[0] + deed.label.slice(1).toLowerCase()} hotkey={deed.key.toLowerCase()} plain dimColor={deed.state === 'off'} onPress={press(deed.action)} />}
        <Button key={`${who}-close`} label="Close" hotkey="c" plain onPress={press({ kind: 'panel', panel: who })} />
      </Box>
      {p.logTail()}
    </Box>
  )
}

/**
 * The windows that take the whole pane, in the order they are tried: the first whose moment it is is drawn. The pixel
 * windows need the pane wide enough (`isWindowWide`); the start screen draws as text when it is not.
 */
const FULL_WINDOWS: readonly { is: (p: Pane, l: Layout) => boolean; draw: (p: Pane, l: Layout) => RenderElement }[] = [
  { is: p => isLogOpen && p.isWindowWide, draw: p => pixelWindow(p, 'log', logHeight(p.g), logPixels(p.g), logOverlay(p.g), [logClose(p, 'c')]) },
  { is: p => isHelpOpen && p.isWindowWide, draw: p => pixelWindow(p, 'help', helpHeight(), helpPixels(), helpOverlay(), [helpClose(p, 'c')]) },
  { is: (_, l) => l.isPixelBag, draw: pixelBag },
  { is: p => p.g.panel === 'shop' && p.isWindowWide, draw: pixelShop },
  { is: p => p.g.panel === 'start', draw: startScreen },
  { is: (_, l) => l.isCompactBag, draw: compactBag },
  { is: p => p.g.panel === 'death' && !isFalling && p.g.fallen !== undefined && p.isWindowWide, draw: p => pixelWindow(p, 'death', deathHeight(p.g), deathPixels(p.g), deathOverlay(p.g), [wakeKey(p)], undefined, deathHot(p.g)) },
  { is: p => p.g.panel === 'recap' && p.isWindowWide, draw: p => pixelWindow(p, 'recap', recapHeight(p.g), recapPixels(p.g), recapOverlay(p.g), [playOnKey(p, 'p')], undefined, recapHot(p.g)) },
  { is: p => p.g.panel === 'settings' && p.isWindowWide, draw: p => pixelWindow(p, 'settings', SETTINGS_H, settingsPixels(p.g, soundSettings, settingsUi), settingsOverlay(p.g, soundSettings, settingsUi), settingsKeys(p, true), undefined, settingsHot(p.g, soundSettings, settingsUi)) },
  { is: p => p.g.panel === 'sheet' && p.isWindowWide, draw: sheetWindow },
  { is: p => p.g.panel === 'retire' && p.isWindowWide, draw: retireWindow },
  { is: p => p.g.panel === 'talent' && p.isWindowWide, draw: p => pixelWindow(p, 'talent', talentHeight(p.g, talentUi), talentPixels(p.g, talentUi), talentOverlay(p.g, talentUi), talentKeys(p, true), undefined, [...talentHot(p.g, talentUi), ...heroTabsHot(p.g, 'talent')]) },
  { is: p => p.g.panel === 'deep' && p.isWindowWide, draw: p => pixelWindow(p, 'deep', deepHeight(p.g), deepPixels(p.g), deepOverlay(p.g), deepKeys(p, true), undefined, [...deepHot(p.g), ...heroTabsHot(p.g, 'deep')]) },
  { is: p => p.g.panel === 'codex' && p.isWindowWide, draw: p => pixelWindow(p, 'codex', codexHeight(p.g, codexUi), codexPixels(p.g, codexUi), codexOverlay(p.g, codexUi), [pageKey(p), cardKey(p, 'k'), codexClose(p, 'c')], undefined, [...codexHot(codexUi), ...heroTabsHot(p.g, 'codex')]) },
  { is: p => p.g.panel === 'forge' && p.isWindowWide, draw: forgeWindow },
  { is: p => p.g.panel === 'stash' && p.isWindowWide, draw: stashWindow },
  { is: p => isSpeaker(p.g.panel) && p.isWindowWide, draw: p => talkWindow(p, p.g.panel as Speaker) },
]

/** The bag as text: its rows and what is worn, each worn piece taken off by a click; the item card and the bag's keys. */
const textBag = (p: Pane, l: Layout) => {
  const { g, Box, Text, Button, press } = p
  return (
    <Box flexDirection="column">
      <Box flexDirection={l.isWide ? 'row' : 'column'}>
        <Box flexDirection="column" marginRight={2}>
          {bagRows(g).map(p.line)}
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
      {l.card}
      {bagActions(p)}
    </Box>
  )
}

const textBelt = ({ g, Box, Button, press }: Pane) => (
  <Box columnGap={2}>
    {Array.from({ length: BELT_SIZE }, (_, i) => (
      <Button key={`belt-${i + 1}`} label={beltLabel(g, i)} hotkey={String(i + 1)} plain dimColor={g.belt[i] === null} onPress={press({ kind: 'use', slot: i })} />
    ))}
  </Box>
)

const textSheet = (p: Pane) => {
  const { g, Box, Text, Button, press } = p
  return (
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
      {keysHint(p)}
      <Box columnGap={2}>
        <Button key="sheet-codex" label="Codex" plain onPress={press({ kind: 'panel', panel: 'codex' })} />
        {retireKey(p)}
        {talentKey(p)}
        {deepKey(p)}
        <Button key="sheet-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />
      </Box>
    </Box>
  )
}

const textShop = ({ g, Box, Text, Button, press }: Pane) => (
  <Box flexDirection="column">
    <Text>
      <Text bold>The merchant</Text>
      <Text color={INK.gold}>{`  Gold ${g.gold}`}</Text>
    </Text>
    {WARES.map(ware => (
      <Button key={`buy-${ware}`} label={`Buy ${nameOf(wareOf(ware).kind, wareOf(ware).tier)}: ${priceOfWare(ware, g)} gold`} plain dimColor={g.gold < priceOfWare(ware, g)} onPress={press({ kind: 'buy', ware })} />
    ))}
    <Button key="shop-undo" label={undoLabel(g)} plain dimColor={whyNotBuyBack(g) !== undefined} onPress={press({ kind: 'buyBack' })} />
    <Button key="shop-close" label="Close" plain onPress={press({ kind: 'panel', panel: 'shop' })} />
  </Box>
)

const textForge = ({ g, Box, Text, Button, press }: Pane) => {
  const worn = SLOTS.flatMap(slot => {
    const item = g.gear[slot]
    return item === undefined ? [] : [{ slot, item }]
  })
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>The smith</Text>
        <Text dimColor>{`  Temper: +1 to the main stat, up to ${TEMPER_MAX} times. Reforge: new affixes, ${reforgeCost(g)} gold`}</Text>
        <Text color={INK.gold}>{`  Gold ${g.gold}`}</Text>
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
}

const closer = ({ Button, press }: Pane, panel: Game['panel']) => <Button key={`${panel}-close`} label="Close" plain onPress={press({ kind: 'panel', panel })} />

const textHealer = (p: Pane) => {
  const { g, Box, Text } = p
  return (
    <Box flexDirection="column">
      <Text bold>The healer</Text>
      <Text>{`HP ${g.hp}/${g.maxHp}`}<Text dimColor>{'  Free, whenever you come back to town.'}</Text></Text>
      {closer(p, 'healer')}
    </Box>
  )
}

const textElder = (p: Pane) => {
  const { g, Box, Text, Button, press } = p
  const quest = g.quest
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>The elder</Text>
        <Text dimColor>{`  Quests done: ${g.questsDone}`}</Text>
      </Text>
      <Text>{quest === null ? 'No quest in hand. Visit again for one.' : questLine(quest)}</Text>
      <Text dimColor>{quest === null ? ' ' : quest.have >= quest.need ? 'Done: make room in your bag, then claim your pay.' : `Pays ${questReward(quest)} gold and an item of Uncommon or better.`}</Text>
      {quest !== null && quest.have >= quest.need && <Button key="claim" label="Claim" hotkey="a" plain onPress={press({ kind: 'claim' })} />}
      {closer(p, 'elder')}
    </Box>
  )
}

const textMystic = (p: Pane) => {
  const { g, Box, Text, Button, press } = p
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>The mystic</Text>
        <Text color={INK.gold}>{`  Gold ${g.gold}`}</Text>
      </Text>
      <Text>{g.fortune === null ? 'No fortune in force.' : `${FORTUNE_NAME[g.fortune.kind]}, until you change depth.`}</Text>
      {g.fortune === null
        ? <Button key="fortune" label={`Read my fortune: ${fortuneCost(g)} gold`} plain dimColor={g.gold < fortuneCost(g)} onPress={press({ kind: 'fortune' })} />
        : <Text dimColor>One fortune at a time.</Text>}
      {closer(p, 'mystic')}
    </Box>
  )
}

const textTalker = (p: Pane, who: 'guard' | 'villager' | 'dog') => {
  const { g, Box, Text, Button, press } = p
  return (
    <Box flexDirection="column">
      <Text bold>{TALKER_NAME[who]}</Text>
      <Text>{TOWN_TALK[who]}</Text>
      {who === 'dog' && <Button key="pet" label={`Pet the dog (${g.petted} so far)`} hotkey="p" plain onPress={press({ kind: 'pet' })} />}
      {who === 'guard' && <Button key="trade-in" label="Trade in three spare pieces" plain dimColor={tradeInOf(g).length < 3} onPress={press({ kind: 'tradeIn' })} />}
      {who === 'villager' && <Button key="gamble" label={`Buy a sealed pack: ${gambleCost(g)} gold`} plain dimColor={g.gold < gambleCost(g)} onPress={press({ kind: 'gamble' })} />}
      {closer(p, who)}
    </Box>
  )
}

const textStash = ({ g, Box, Text, Button, press }: Pane) => {
  const picked = g.bag.find(item => item.id === g.cursor)
  return (
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
}

const textDeath = (p: Pane) => {
  const { g, Box, Text } = p
  const fallen = g.fallen!
  return (
    <Box flexDirection="column">
      <Text bold color="red">You died</Text>
      <Text>{`Slain by ${killerName(fallen)} on depth ${fallen.depth}. Lost ${fallen.lost} gold. You wake on depth ${fallen.wake}.`}</Text>
      <Box columnGap={2}>{wakeKey(p)}</Box>
    </Box>
  )
}

/** The recap as text: what the tool calls came to, in a line or two; Play on closes it (the dashboard's p is a potion here). */
const textRecap = (p: Pane) => {
  const { g, Box, Text } = p
  const r = g.recap
  if (r === undefined) return <Box />
  const work = [r.tests > 0 ? `${r.tests} green test runs` : '', r.commits > 0 ? `${r.commits} commits` : '', r.pushes > 0 ? `${r.pushes} pushes` : '', r.prs > 0 ? `${r.prs} PRs` : ''].filter(s => s !== '')
  return (
    <Box flexDirection="column">
      <Text bold>While you worked</Text>
      <Text>{`${r.calls} tool calls, depth ${r.depth} to ${g.depth}, level ${r.level} to ${g.level}. ${r.kills} kills, +${r.gold} gold, ${r.deaths} deaths.`}</Text>
      {work.length > 0 && <Text>{`Your work: ${work.join(', ')}.`}</Text>}
      {r.best !== undefined && <Text>{'Best find: '}<Text color={RARITY_COLOR[r.best.rarity]}>{r.best.name}</Text></Text>}
      <Box columnGap={2}>{playOnKey(p)}</Box>
    </Box>
  )
}

/** Card: the hero card saved and copied. */
const cardKey = ({ Button, shareCard }: Pane, hotkey?: string) => <Button key="codex-card" label="Card" hotkey={hotkey} plain onPress={shareCard} />
/** The codex's other page: Finds from Foes, Foes from Finds. */
const pageKey = ({ Button, redraw }: Pane) => (
  <Button key="codex-page" label={codexUi.page === 'foes' ? 'Finds' : 'Foes'} hotkey="p" plain onPress={() => {
    codexUi = { page: codexUi.page === 'foes' ? 'finds' : 'foes' }
    redraw()
  }} />
)
const codexClose = ({ Button, press }: Pane, hotkey?: string) => <Button key="codex-close" label="Close" hotkey={hotkey} plain onPress={press({ kind: 'panel', panel: 'codex' })} />

/** The codex as text: each row's count and what is in it, then the records. */
const textCodex = (p: Pane) => {
  const { g, Box, Text } = p
  const c = g.codex ?? firstCodex(g)
  const named = <T extends string>(keys: readonly T[], all: readonly { key: T; name: string }[]) => all.filter(a => keys.includes(a.key)).map(a => a.name).join(', ')
  const uniques = Object.values(UNIQUES)
  const bigs = Object.values(BIG_BOSSES)
  const legendaries = LEGENDARIES.filter(l => c.legendaries.includes(l.name))
  return (
    <Box flexDirection="column">
      <Text bold>Codex</Text>
      <Text>{`Uniques ${c.uniques.length}/${uniques.length}: ${named(c.uniques, uniques) || 'none yet'}`}</Text>
      <Text>{`Big bosses ${c.bigs.length}/${bigs.length}: ${named(c.bigs, bigs) || 'none yet'}`}</Text>
      <Text>{`Legendaries ${legendaries.length}/${LEGENDARIES.length}: ${legendaries.map(l => l.name).join(', ') || 'none yet'}`}</Text>
      <Text dimColor>{`Deepest ${c.deepest}, level ${c.level}, ${c.kills} kills, ${c.bosses} bosses, ${c.deaths} deaths, ${c.gold} gold.`}</Text>
      <Box columnGap={2}>
        {cardKey(p)}
        {codexClose(p)}
      </Box>
    </Box>
  )
}

/** The retire window as text: a button a worn piece, each retiring the hero and passing that piece down; Back. */
const textRetire = ({ g, Box, Text, Button, press }: Pane) => (
  <Box flexDirection="column">
    <Text bold>Retire: choose the heirloom every new hero starts with, its power kept, its stats plain</Text>
    {SLOTS.flatMap(slot => {
      const item = g.gear[slot]
      return item === undefined ? [] : [<Button key={`retire-${slot}`} plain dimColor={whyNotRetire(g, slot) !== undefined} onPress={press({ kind: 'retire', slot })}>{'Pass down '}<Text color={RARITY_COLOR[item.rarity]}>{item.name}</Text></Button>]
    })}
    <Button key="retire-back" label="Back" plain onPress={press({ kind: 'panel', panel: 'sheet' })} />
  </Box>
)

/** The deep window as text: the tier the hero is in and its mark, the tiers reached, and the fork's two marks while one waits. */
const textDeep = (p: Pane) => {
  const { g, Box, Text } = p
  const fork = forkTier(g)
  const here = g.where === 'dungeon' ? tierOf(g.depth) : 0
  const reached = Array.from({ length: tierOf(g.deepest) }, (_, i) => `${roman(i + 1)} ${MARKS[markOf(g, i + 1)].name}`).join(', ')
  const head = fork !== undefined
    ? `Choose the mark of tier ${roman(fork)}. None chosen, the stairs take ${MARKS[pairOf(g.world, fork)[0]].name}.`
    : here > 0 ? `Depth ${g.depth}, tier ${roman(here)}: ${MARKS[markOf(g, here)].name}. ${MARKS[markOf(g, here)].does}` : `The tiers begin past depth ${DEEP_FROM}.`
  return (
    <Box flexDirection="column">
      <Text bold>{head}</Text>
      {reached === '' ? null : <Text dimColor>Tiers: {reached}</Text>}
      <Box flexDirection="column">{deepKeys(p, false)}</Box>
    </Box>
  )
}

/** The talent window as text: the talents offered, a button each, or those taken and the level of the next. */
const textTalent = (p: Pane) => {
  const { g, Box, Text } = p
  const taken = (g.talents ?? []).map(t => TALENTS[t].name).join(', ')
  const next = TALENT_EVERY * ((g.talents?.length ?? 0) + 1)
  return (
    <Box flexDirection="column">
      <Text bold>{owed(g) > 0 ? `Level ${next}: choose a talent` : offer({ ...g, level: next }).length === 0 ? `Talents: ${taken}. Every talent is taken.` : `Talents: ${taken || 'none yet'}. The next at level ${next}.`}</Text>
      <Box flexDirection="column">{talentKeys(p, false)}</Box>
    </Box>
  )
}

const textSettings = (p: Pane) => {
  const { Box, Text } = p
  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <Box columnGap={2}>{settingsKeys(p)}</Box>
    </Box>
  )
}

/** The map: pixels with their click layer, or text (the 1x map or the zoomed one). */
const mapView = (p: Pane, l: Layout) => {
  const { g, Box, Raster, Client } = p
  if (Raster === undefined || l.pixelRows === undefined) {
    const rows = g.zoom === 1
      ? mapRows(g, l.mapWidth, Math.max(7, Math.min(MAP_H, l.mapRoom)))
      : zoomedRows(g, l.mapWidth, Math.max(4 * TILE_H, Math.min(MAP_H * TILE_H, l.mapRoom)))
    return rows.map(p.line)
  }
  const stride = l.heroAt !== undefined && walk !== null && isStrideFrame(walk.frame)
  const hover = mapHoverOf(p.g)
  const map = pixelMapFrame(l.drawn, l.mapWidth, l.pixelRows, l.heroAt, l.view, [], 0, stride, l.heroAt === undefined ? shown : STILL, l.heroAt === undefined ? hover.lit : undefined)
  return (
    <Box>
      <Raster key="map" columns={l.mapWidth} rows={l.pixelRows} cells={drawnMap(map.cells)} />
      {Client !== undefined && (
        <Box position="absolute" top={0} left={0}>
          <Client key="map-clicks" module="./clicks.ts" props={{ columns: l.mapWidth, rows: l.pixelRows, label: labelOnMap(hover.label, map.frame, l.mapWidth) }} width={l.mapWidth} height={l.pixelRows} />
        </Box>
      )}
    </Box>
  )
}

/** Under the map: the pixel strip with its click layer, or the status and the foe as text. */
const stripView = (p: Pane, l: Layout) => {
  const { e, g, Box, Raster, Client } = p
  if (!l.hasHud || Raster === undefined) {
    return (
      <Box flexDirection="column">
        {p.line(statusRuns(l.told))}
        {p.line(foeRuns(g))}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      <Box>
        <Raster key="hud" columns={e.props.bodyColumns} rows={l.hudRows} cells={stripCells(l.told, e.props.bodyColumns, l.menuBoxes)} />
        {Client !== undefined && (
          <Box position="absolute" top={0} left={0}>
            <Client key="hud-clicks" module="./windowclient.ts" props={{ columns: e.props.bodyColumns, rows: l.hudRows, boxes: onPixels(hudBoxes(l.told, e.props.bodyColumns, l.menuBoxes)) }} width={e.props.bodyColumns} height={l.hudRows} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

/** The hotkeys the buttons in a drawing answer to. */
const hotkeysIn = (n: RenderChildren): string[] => {
  if (Array.isArray(n)) return n.flatMap(hotkeysIn)
  if (typeof n !== 'object' || n === null) return []
  const el = n as { type?: string; props?: { hotkey?: unknown }; children?: RenderChildren }
  const own = el.type === 'Button' && typeof el.props?.hotkey === 'string' ? [el.props.hotkey] : []
  return [...own, ...hotkeysIn(el.children)]
}

/**
 * The text dashboard's keys: the windows, the hero's moves, the view, a new game, settings. A key a window open under
 * them answers to is its alone (`taken`): the dashboard's button keeps its place, to be clicked.
 */
const dashKeys = ({ g, Box, Text, Button, press }: Pane, taken: ReadonlySet<string>) => {
  const free = (key: string) => (taken.has(key) ? undefined : key)
  return (
    <Box columnGap={2} flexWrap="wrap">
      <Button key="bag" hotkey={free('i')} plain onPress={press({ kind: 'panel', panel: 'bag' })}>
        <Text bold>Inventory</Text>
      </Button>
      <Button key="sheet" hotkey={free('c')} plain onPress={press({ kind: 'panel', panel: 'sheet' })}>
        Character{g.points > 0 ? <Text color={INK.easy}> ({g.points})</Text> : ''}
      </Button>
      <Text dimColor>|</Text>
      <Button key="attack" label="attack" hotkey={free('a')} plain onPress={press({ kind: 'attack' })} />
      <Button key="potion" label="potion" hotkey={free('p')} plain onPress={press({ kind: 'potion' })} />
      <Button key="walk" label="explore" hotkey={free('w')} plain onPress={press({ kind: 'walk' })} />
      <Button key="stairs" label="descend" hotkey={free('d')} plain onPress={press({ kind: 'stairs' })} />
      <Button key="portal" label={g.where === 'town' ? 'leave town' : 'portal'} hotkey={free('t')} plain onPress={press({ kind: 'portal' })} />
      <Button key="west" label="left" hotkey={free('h')} plain onPress={press({ kind: 'move', dx: -1, dy: 0 })} />
      <Button key="south" label="down" hotkey={free('j')} plain onPress={press({ kind: 'move', dx: 0, dy: 1 })} />
      <Button key="north" label="up" hotkey={free('k')} plain onPress={press({ kind: 'move', dx: 0, dy: -1 })} />
      <Button key="east" label="right" hotkey={free('l')} plain onPress={press({ kind: 'move', dx: 1, dy: 0 })} />
      <Button key="zoom" label={VIEW_LABEL[g.zoom]} hotkey={free('z')} plain onPress={press({ kind: 'zoom' })} />
      <Button key="restart" label="new game" hotkey={free('r')} plain onPress={press({ kind: 'panel', panel: 'start' })} />
      <Button key="settings" label="settings" plain onPress={press({ kind: 'panel', panel: 'settings' })} />
    </Box>
  )
}

/** The windows the dashboard draws inline under the map, in their order: each when it is open and not drawn whole-pane. */
const INLINE: readonly { is: (p: Pane, l: Layout) => boolean; draw: (p: Pane, l: Layout) => RenderElement }[] = [
  { is: () => isLogOpen, draw: textLog },
  { is: () => isHelpOpen, draw: textHelp },
  { is: (p, l) => p.g.panel === 'bag' && !l.isPixelBag && !l.isCompactBag, draw: textBag },
  { is: p => p.g.panel === 'sheet', draw: textSheet },
  { is: p => p.g.panel === 'death' && !isFalling && p.g.fallen !== undefined, draw: textDeath },
  { is: p => p.g.panel === 'recap', draw: textRecap },
  { is: p => p.g.panel === 'codex', draw: textCodex },
  { is: p => p.g.panel === 'retire', draw: textRetire },
  { is: p => p.g.panel === 'talent', draw: textTalent },
  { is: p => p.g.panel === 'deep', draw: textDeep },
  { is: p => p.g.panel === 'settings', draw: textSettings },
  { is: p => p.g.panel === 'shop', draw: textShop },
  { is: p => p.g.panel === 'forge', draw: textForge },
  { is: p => p.g.panel === 'stash', draw: textStash },
  { is: p => p.g.panel === 'healer', draw: textHealer },
  { is: p => p.g.panel === 'elder', draw: textElder },
  { is: p => p.g.panel === 'mystic', draw: textMystic },
  { is: p => p.g.panel === 'guard' || p.g.panel === 'villager' || p.g.panel === 'dog', draw: p => textTalker(p, p.g.panel as 'guard' | 'villager' | 'dog') },
]

/** The dashboard: the pane's size note on its top row where one is due, the map, a note on the layout, the strip or the status, then the text views' keys, belt, open window and log. */
const dashboard = (p: Pane, l: Layout) => {
  const { e, g, Box, Text } = p
  const isWindowed = e.surface === 'terminal' && e.viewport?.isFullscreen === false && l.isPixelView
  const windows = INLINE.map(w => w.is(p, l) && w.draw(p, l))
  const taken = new Set(hotkeysIn(windows))
  return (
    <Box flexDirection="column" position="relative">
      {l.topNote !== undefined && <Text dimColor wrap="truncate-end">{l.topNote}</Text>}
      <Box flexDirection="column">{mapView(p, l)}</Box>
      {isWindowed && (
        <Text dimColor>
          {l.hasHud ? 'Playing by mouse needs the fullscreen layout: type /tui fullscreen.' : 'Clicking the map needs the fullscreen layout: type /tui fullscreen. Keys work everywhere.'}
        </Text>
      )}
      {stripView(p, l)}
      {!l.hasHud && dashKeys(p, taken)}
      {!l.hasHud && g.panel !== 'sheet' && textBelt(p)}
      {windows}
      {!l.hasHud && logRuns(l.told).map((entry, i, all) => (i === all.length - 1 ? logLine(p, entry, taken) : (
        <Text dimColor={entry.dim} wrap="truncate-end">
          {'> '}
          {entry.text}
        </Text>
      )))}
    </Box>
  )
}

/** The pane drawn: taken up again if it was paused, each window's state let go once it is closed, then the window whose moment it is, else the dashboard. */
const drawPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const drawnFrom = fineNow()
  await resume($)
  void loadClips($)
  const g = normalize(await read($, game))
  if (g.panel !== 'bag') bagUi = BAG_UI_IDLE
  if (g.panel !== 'shop') shopUi = SHOP_UI_IDLE
  if (g.panel !== 'forge') forgeUi = FORGE_UI_IDLE
  if (g.panel !== 'retire') retireUi = FORGE_UI_IDLE
  if (g.panel !== 'stash') chestUi = CHEST_UI_IDLE
  if (g.panel !== 'start') startUi = null
  if (g.panel !== 'talent') talentUi = TALENT_UI
  if (g.panel !== 'codex') codexUi = CODEX_UI
  if (g.panel !== 'settings') settingsUi = SETTINGS_UI
  const p = paneOf($, e, g)
  const l = layOut(p)
  const tree = (FULL_WINDOWS.find(w => w.is(p, l))?.draw ?? dashboard)(p, l)
  redraws.add(fineNow() - drawnFrom)
  return tree
}

export const register: Register = (on, options) => {
  soundSettings = { effects: options.sound !== false, music: options.music !== false, volume: VOLUME_STEPS }
  on('session.start', async ($, e, next) => {
    await beginSession($)
    return next(e)
  })

  on('command.run', { command: 'dungeon' }, async $ => {
    await $.ui.open(OPEN)
    await resume($)

    return { text: 'The dungeon pane is open. Click the map to walk and fight, the hero to explore, the portrait for the bag, the level for the character sheet.' }
  })

  on('command.run', { command: 'dungeon-bench' }, async $ => startBench($))

  on('command.run', { command: 'dungeon-frames' }, async () => ({ text: framesReport(ticker.stats(), repaints.summary(), redraws.summary(), keptMaps.summary(), builtMaps.summary()) }))

  on('prompt.submit', async ($, e, next) => {
    // A quest is what the person typed, at the prompt or through Remote Control: not a slash command's line, a prompt
    // they do not see as typed, nor what reaches the session from elsewhere (a notification, a schedule, the SDK host,
    // another session, a channel).
    const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (isTyped && e.command === undefined && e.isMeta !== true) await act($, { kind: 'quest', text: e.text })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await act($, onToolStart(String(e.tool), targetOf(e)))
    const ran = await next(e)
    const ok = ran.deny === undefined && ran.isError !== true
    const work = ok ? workDone(e, ran.result) : undefined
    await act($, { kind: 'outcome', ok, what: String(e.tool), ...(work === undefined ? {} : { work }) })

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer' && !isPaused) {
      await act($, { kind: 'descend' })
      if (!isSaveHeld) await $.store.set(SAVE, savable(await read($, game)))
    }

    return next(e)
  })

  // A gesture on one of the pane's click layers, to its window (`onClick`).
  on('ui.message', async ($, e, next) => {
    if ((e.data as { type?: string } | undefined)?.type === 'hover') {
      if (e.element === 'map-clicks') await onMapHover($, e.data as { x?: number; y?: number; columns?: number; rows?: number })
      else onHover($, e.element ?? '', (e.data as { at: Pos | null }).at)
      return {}
    }
    return (await onClick($, e.element ?? '', e.data)) ? {} : next(e)
  })

  // Closing the pane silences the game: the tune stops, an effect sounding is cut.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    // Reopened by /dungeon, the old pane closes after the new one is up: the game plays on.
    if (isLeftUnseen(e.id, await $.ui.panes().catch(() => []))) await pause($)
    return closed
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, drawPane)
}
