import { describe, expect, mock, test } from 'claude-code/testing'

import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { CLIP_MS, TUNE_MS } from './clips'
import { MUSIC_GAIN, TOWN_TUNE, gainOf } from './sounds'
import { base64Of, bytesOf, readWav, sampleOf, wavOf } from './mixdown'
import { BENCH_SEED, IDLE_BEFORE_BOB_MS, ambientAt, framesReport, toastFor } from './register'
import { FRAME_MS } from './frames'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { alongTheWay, apply, levelOf, newGame, onToolStart, routeToStairs, threat } from './game'
import { BAG_X, BAG_Y, INV_H, INV_TOP, INV_W, WORN_SLOTS } from './inventory'
import { BELT_BELOW_Y, INSET, LINE2_Y, beltSlotX, hudLayout, portalSlotX, settingsSlotX } from './hud'
import { bfs, cellId, floorThing, same } from './map'
import type { Pos } from './map'
import { TOWN_SPOTS, isTownWalkable, townSpotAt } from './town'
import { wareRect } from './shop'
import { PX } from './pixelart'
import { CLOSE_BOX } from './window'
import { retireButtons } from './retirewindow'
import { offer } from './talents'
import { takeRect, talentCards } from './talentwindow'
import { pairOf } from './deep'
import { deepCards } from './deepwindow'
import { arrive } from './world'
import { SETTINGS_UI, settingsRect } from './settings'
import { cardText } from './herocard'
import { codexCardRect } from './codexwindow'
import { FOE_BAR_FILL, FRAMES_PER_TILE, HIT_FRAMES, stampCells, stampOf, walkState, benchRoute, clickToTile, hexToInt, hitFramesFor, hitsBetween, isStrideFrame, pixelMap, tileCamera, walkPosition, walkingGame } from './pixels'

const PANE = {
  plugin: 'ascii-dungeon',
  component: 'Pane',
  requestId: 'dungeon',
  props: {
    title: 'Dungeon',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('an edit summons a foe that a successful edit then hits', async ($, on) => {
  on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /of utils\.ts \(.\) emerges from the dark!$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^> You (hit|slay) the .* of utils\.ts/ })).toBeDefined()
})

test("a failing shell command costs the hero HP, once the knight's shield has turned the first blow", async ($, on) => {
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^> Your shield turns the .* of npm's blow\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /of npm strikes you for \d+\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\[ +HP \d+\/30 +\]/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\[ +HP 30\/30 +\]/ })).toBeUndefined()
})

const SHELL_DONE = { stdout: '', stderr: '', interrupted: false }

test('a commit the host reports kneels the hero at a shrine', async ($, on) => {
  on('tool.call', () => ({ result: { ...SHELL_DONE, gitOperation: { commit: { sha: 'abc1234', kind: 'committed' } } } as never }))
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "fix the build"' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^> You kneel at a shrine: your work is kept\./ })).toBeDefined()
})

test('a passing test run makes the blow sure', async ($, on) => {
  on('tool.call', () => ({ result: SHELL_DONE as never }))
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^> The tests pass: your blow is sure\.$/ })).toBeDefined()
})

test('a failing test run is no sure blow, and a commit the host does not report no shrine', async ($, on) => {
  on('tool.call', (_$, e) => (e.tool === 'Bash' && e.command === 'bun test' ? { result: { stdout: '', stderr: 'boom' } as never, isError: true } : { result: SHELL_DONE as never }))
  await $.tool.call({ tool: 'Bash', command: 'git commit -qm "fix the build"' })
  await $.tool.call({ tool: 'Bash', command: 'bun test' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^> You kneel at a shrine/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^> The tests pass/ })).toBeUndefined()
})

test('after ten tool calls unseen, the next key opens the recap instead; Play on closes it and the key works again', async ($, on) => {
  on('tool.call', () => ({ result: { file: { content: '' } } as never }))
  for (let i = 0; i < 10; i += 1) await $.tool.call({ tool: 'Read', file_path: `/src/${i}.ts` })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const sprites = { type: 'Text', text: /d\[#\]-\+/ } as const
  await ui.press({ key: 'zoom' })
  expect(await ui.find({ type: 'Text', text: 'While you worked' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^10 tool calls, depth 1 to 1, level 1 to 1\./ })).toBeDefined()
  await ui.press({ key: 'recap-play' })
  expect(await ui.find({ type: 'Text', text: 'While you worked' })).toBeUndefined()
  await ui.press({ key: 'zoom' })
  expect(await ui.find(sprites)).toBeUndefined()
  await ui.unmount()
})

test('after fewer tool calls, a key does what it says', async ($, on) => {
  on('tool.call', () => ({ result: { file: { content: '' } } as never }))
  for (let i = 0; i < 9; i += 1) await $.tool.call({ tool: 'Read', file_path: `/src/${i}.ts` })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'zoom' })
  expect(await ui.find({ type: 'Text', text: 'While you worked' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /\.@|@\./ })).toBeDefined()
  await ui.unmount()
})

/** The plugin's store, kept in a map: what the hooks wrote, and what a later session reads back. */
const storeIn = (on: On, kept = new Map<string, unknown>()) => {
  on('store.get', (_$, e) => ({ value: kept.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined } as never
  })
  return kept
}

test('a sound setting changed is saved', async ($, on) => {
  const kept = storeIn(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'settings-effects' })
  await ui.press({ key: 'settings-volume' })
  expect(kept.get('sound')).toEqual({ effects: false, music: true, volume: 1 })
  await ui.unmount()
})

test('what is done by hand between turns is saved at once: the view, a potion drunk', async ($, on) => {
  const kept = storeIn(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'zoom' })
  const zoomed = kept.get('save') as Game | undefined
  await ui.press({ key: 'potion' })
  const drunk = kept.get('save') as Game | undefined
  expect(zoomed?.zoom).toBe(1)
  expect(drunk?.belt[0]).toBeNull()
  expect(drunk?.zoom).toBe(1)
  await ui.unmount()
})

test('a stat trained by hand is saved at once, and a later session opens on it', async ($, on) => {
  const kept = storeIn(on, new Map<string, unknown>([['save', { ...newGame(), points: 1 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const might = newGame().stats.might
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sheet' })
  await ui.press({ key: 'train-might' })
  const saved = kept.get('save') as Game
  expect([saved.stats.might, saved.points]).toEqual([might + 1, 0])
  await ui.unmount()
})

test('an order changed in settings is kept with the game, and said on its key', async ($, on) => {
  const kept = storeIn(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'settings' })
  expect(await ui.find({ type: 'Button', key: 'settings-drink' })).toMatchObject({ props: { label: 'Drink at quarter HP' } })
  await ui.press({ key: 'settings-drink' })
  expect(await ui.find({ type: 'Button', key: 'settings-drink' })).toMatchObject({ props: { label: 'Drink at half HP' } })
  expect((kept.get('save') as Game).orders?.drink).toBe(50)
  await ui.unmount()
})

test('a session starts with the sound saved before, not the defaults', async ($, on) => {
  storeIn(on, new Map<string, unknown>([['sound', { effects: false, music: false, volume: 2 }], ['save', newGame()]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'settings' })
  expect(await ui.find({ type: 'Button', key: 'settings-effects' })).toMatchObject({ props: { label: 'Sound: off' } })
  expect(await ui.find({ type: 'Button', key: 'settings-music' })).toMatchObject({ props: { label: 'Music: off' } })
  expect(await ui.find({ type: 'Button', key: 'settings-volume' })).toMatchObject({ props: { label: 'Volume: 50%' } })
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane draws the map and its buttons act (${surface})`, async $ => {
    const ui = await $.ui.mount({ ...PANE, surface })
    const sprites = { type: 'Text', text: /d\[#\]-\+/ } as const
    const pixelView = async () => {
      const raster = await ui.find({ type: 'Raster', key: 'map' })
      if (surface === 'terminal') expect(raster?.props.columns).toBe(PANE.props.bodyColumns)
      else expect(raster === undefined && (await ui.find(sprites)) !== undefined).toBe(true)
    }
    await pixelView()
    await ui.press({ key: 'zoom' })
    expect(await ui.find({ type: 'Text', text: /\.@|@\./ })).toBeDefined()
    expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
    expect(await ui.find(sprites)).toBeUndefined()
    await ui.press({ key: 'zoom' })
    expect(await ui.find({ type: 'Text', text: /\(@\) \|/ })).toBeDefined()
    expect(await ui.find(sprites)).toBeDefined()
    await ui.press({ key: 'zoom' })
    await pixelView()
    expect(await ui.find({ type: 'Text', text: /^\[      HP 30\/30      \]  Lv 1  XP 0\/20/ })).toBeDefined()

    await ui.press({ key: 'potion' })
    expect(await ui.find({ type: 'Text', text: /Potions 0 / })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'You drink a Health Potion. +0 HP' })).toBeDefined()

    await ui.press({ key: 'attack' })
    expect(await ui.find({ type: 'Text', text: 'You swing at the darkness.' })).toBeDefined()
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the bag and character panels toggle and show their contents (${surface})`, async $ => {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '+--------+' })).toBeUndefined()

    await ui.press({ key: 'bag' })
    expect(await ui.find({ type: 'Text', text: '+--------+' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'gear-weapon', text: /Short Sword/ })).toBeDefined()

    await ui.press({ key: 'sheet' })
    expect(await ui.find({ type: 'Text', text: '+--------+' })).toBeUndefined()
    await ui.press({ key: 'train-might' })
    expect(await ui.find({ type: 'Text', text: 'No stat points to spend. Level up first.' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'sheet-new' })).toBeUndefined()
    await ui.unmount()
  })
}

const WIDE = { ...PANE, props: { ...PANE.props, bodyColumns: 110 } } as const

/** Every toast the pane raises, in order. */
const toasts = (on: On) => {
  const said: string[] = []
  on('ui.toast', (_$, e) => {
    said.push(e.text)
    return { value: undefined }
  })
  return said
}
/** The strip's cell over its content pixel x, y at the wide pane's width: INSET in, two pixels a cell down. */
const stripCell = (x: number, y: number) => ({ x: INSET + x, y: Math.floor((INSET + y) / 2) })
const INNER = WIDE.props.bodyColumns - 2 * INSET
/** A click on the strip, as its click layer reads one: a press and its release in the same place. */
const clickStrip = async (ui: { pointer: (e: never) => Promise<unknown> }, x: number, y: number) => {
  await ui.pointer({ type: 'down', ...stripCell(x, y), button: 'left', in: 'hud-clicks' } as never)
  await ui.pointer({ type: 'up', ...stripCell(x, y), button: 'left', in: 'hud-clicks' } as never)
}
/** Where the view's camera starts in a place: on the tile line nearest the hero, as the pane puts it. */
const viewOf = (g: Pick<Game, 'x' | 'y'>, columns: number, rows: number) => tileCamera(null, { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, columns, rows * 2)

/** The map's cell showing `tile`, with the camera where it starts, as before any walk moves it. */
const cellOf = (g: Game, tile: Pos, columns: number, rows: number) => {
  const cells = Array.from({ length: columns * rows }, (_, i) => ({ x: i % columns, y: Math.floor(i / columns) }))
  return cells.find(c => same(clickToTile(g, { x: c.x + 0.5, y: c.y + 0.5, columns, rows }, viewOf(g, columns, rows)), tile))!
}
const heroCell = (g: Game, columns: number, rows: number) => cellOf(g, g, columns, rows)
/** Every floor tile of the level, nearest the hero first. */
const cellsIn = (g: Game, _columns: number, _rows: number) =>
  levelOf(g).tiles.flatMap((row, y) => [...row].flatMap((t, x) => (t === '.' ? [{ x, y }] : []))).sort((a, b) => Math.abs(a.x - g.x) + Math.abs(a.y - g.y) - (Math.abs(b.x - g.x) + Math.abs(b.y - g.y)))

test('on a wide terminal pane the bag opens as the pixel inventory with the item card under it', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeUndefined()
  await clickStrip(ui, 5, 5)
  const bag = await ui.find({ type: 'Raster', key: 'bag' })
  expect(bag?.props.columns).toBe(INV_W)
  expect(bag?.props.rows).toBe((INV_TOP + INV_H) / 2)
  expect(await ui.find({ type: 'Text', text: 'Your bag is empty. Slay foes for loot.' })).toBeDefined()
  await ui.unmount()
})

test('the desktop keeps the text bag, with the same card', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'desktop' })
  await ui.press({ key: 'bag' })
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '+--------+' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Your bag is empty. Slay foes for loot.' })).toBeDefined()
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`belt slot 1 drinks the starting potion (${surface})`, async $ => {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', key: 'belt-1', text: 'Health Potion x1' })).toBeDefined()
    await ui.press({ key: 'belt-1' })
    expect(await ui.find({ type: 'Text', text: /You drink a Health Potion/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'belt-1', text: 'empty' })).toBeDefined()
    await ui.unmount()
  })

  test(`settings opens the start screen, which starts a new game as another class (${surface})`, async $ => {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'settings' })
    await ui.press({ key: 'settings-new' })
    expect(await ui.find({ type: 'Text', text: 'New game: choose your hero' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Knight: Shield block, / })).toBeDefined()
    await ui.press({ key: 'start-mage' })
    expect(await ui.find({ type: 'Text', text: /^Mage: Siphon, / })).toBeDefined()
    await ui.press({ key: 'start-go' })
    expect(await ui.find({ type: 'Text', text: 'New game: choose your hero' })).toBeUndefined()
    await ui.press({ key: 'bag' })
    expect(await ui.find({ type: 'Button', key: 'gear-weapon', text: /Ash Staff/ })).toBeDefined()
    await ui.unmount()
  })
}

test('on a wide pane the start screen is a pixel window over the map; a hero chosen and started, the map comes back', async $ => {
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await narrow.press({ key: 'settings' })
  await narrow.press({ key: 'settings-new' })
  await narrow.unmount()
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'start' })).toBeDefined()
  expect(await ui.find({ type: 'Client', key: 'start-clicks' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  await ui.press({ key: 'start-rogue' })
  await ui.press({ key: 'start-go' })
  expect(await ui.find({ type: 'Raster', key: 'start' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await ui.unmount()
  const back = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await back.press({ key: 'bag' })
  expect(await back.find({ type: 'Button', key: 'gear-weapon', text: /Dagger/ })).toBeDefined()
  await back.unmount()
})

test('on a wide pane the strip\'s XP line opens the character sheet as a pixel window, which closes back to the map', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 20, LINE2_Y + 2)
  expect(await ui.find({ type: 'Raster', key: 'sheet' })).toBeDefined()
  expect(await ui.find({ type: 'Client', key: 'sheet-clicks' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  await ui.press({ key: 'sheet-close' })
  expect(await ui.find({ type: 'Raster', key: 'sheet' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await ui.unmount()
})

test('the sheet\'s Codex opens the codex as a pixel window; its close box closes it back to the map', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 20, LINE2_Y + 2)
  await ui.press({ key: 'sheet-codex' })
  expect(await ui.find({ type: 'Raster', key: 'codex' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'sheet' })).toBeUndefined()
  const close = { x: CLOSE_BOX[0] + 1, y: Math.floor((CLOSE_BOX[1] + 1) / 2) }
  await ui.pointer({ type: 'down', ...close, button: 'left', in: 'codex-clicks' } as never)
  await ui.pointer({ type: 'up', ...close, button: 'left', in: 'codex-clicks' } as never)
  expect(await ui.find({ type: 'Raster', key: 'codex' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await ui.unmount()
})

test('as text the codex says what is in each row and the records, and closes', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sheet' })
  await ui.press({ key: 'sheet-codex' })
  expect(await ui.find({ type: 'Text', text: 'Uniques 0/5: none yet' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Legendaries 0/7: none yet' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Deepest 1, level 1, 0 kills, 0 bosses, 0 deaths, 0 gold\.$/ })).toBeDefined()
  await ui.press({ key: 'codex-close' })
  expect(await ui.find({ type: 'Text', text: /^Uniques / })).toBeUndefined()
  await ui.unmount()
})

test('a hero who slew a big boss retires from the sheet, and the next hero sets out in the heirloom', async ($, on) => {
  const kept = storeIn(on, new Map<string, unknown>([['save', { ...newGame(), bossSlain: 10, deepest: 12 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sheet' })
  await ui.press({ key: 'sheet-retire' })
  await ui.press({ key: 'retire-weapon' })
  expect((kept.get('save') as Game).panel).toBe('start')
  await ui.press({ key: 'start-mage' })
  await ui.press({ key: 'start-go' })
  const hero = kept.get('save') as Game
  expect([hero.cls, hero.level, hero.codex?.retired, hero.heirloom?.base]).toEqual(['mage', 1, 1, 'sword'])
  expect(hero.bag.some(i => i.base === 'sword')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^> Your heirloom, the Short Sword, waits in your bag\.$/ })).toBeDefined()
  await ui.unmount()
})

test('on a wide pane the retire window\'s Back, clicked, goes back to the sheet', async ($, on) => {
  const saved = { ...newGame(), bossSlain: 10, deepest: 12 }
  storeIn(on, new Map<string, unknown>([['save', saved]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 20, LINE2_Y + 2)
  await ui.press({ key: 'sheet-retire' })
  expect(await ui.find({ type: 'Raster', key: 'retire' })).toBeDefined()
  const back = retireButtons({ ...saved, panel: 'retire' }, { slot: null }).back
  const at = { x: back.x + 2, y: Math.floor((back.y + 4) / 2) }
  await ui.pointer({ type: 'down', ...at, button: 'left', in: 'retire-clicks' } as never)
  await ui.pointer({ type: 'up', ...at, button: 'left', in: 'retire-clicks' } as never)
  expect(await ui.find({ type: 'Raster', key: 'retire' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'sheet' })).toBeDefined()
  await ui.unmount()
})

test('a talent owed: the session opens on it, it is picked and saved, and the window then says when the next comes', async ($, on) => {
  const kept = storeIn(on, new Map<string, unknown>([['save', { ...newGame(), level: 10 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Level 10: choose a talent' })).toBeDefined()
  const first = offer({ ...newGame(), level: 10 })[0]!
  await ui.press({ key: `talent-${first}` })
  expect((kept.get('save') as Game).talents).toEqual([first])
  // The only one owed taken, the window closes; opened from the sheet, it says when the next comes.
  expect((kept.get('save') as Game).panel).toBe('none')
  await ui.press({ key: 'sheet' })
  expect(await ui.find({ type: 'Button', key: 'sheet-talent', text: 'Talent' })).toBeDefined()
  await ui.press({ key: 'sheet-talent' })
  expect(await ui.find({ type: 'Text', text: /^Talents: .+\. The next at level 20\.$/ })).toBeDefined()
  await ui.unmount()
})

test('on a wide pane a session with a talent owed opens on the cards; a card clicked is chosen, clicked again taken', async ($, on) => {
  const saved = { ...newGame(), level: 10 }
  const kept = storeIn(on, new Map<string, unknown>([['save', saved]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  expect((kept.get('save') as Game).panel).toBe('talent')
  const card = talentCards({ ...saved, panel: 'talent' })[2]!
  const at = { x: card.rect.x + 10, y: Math.floor((card.rect.y + 20) / 2) }
  const click = async () => {
    await ui.pointer({ type: 'down', ...at, button: 'left', in: 'talent-clicks' } as never)
    await ui.pointer({ type: 'up', ...at, button: 'left', in: 'talent-clicks' } as never)
  }
  await click()
  expect((kept.get('save') as Game).talents ?? []).toEqual([])
  await click()
  expect((kept.get('save') as Game).talents).toEqual([card.talent])
  // The only one owed taken, the window closes.
  expect((kept.get('save') as Game).panel).toBe('none')
  await ui.unmount()
})

test('the pointer over Take lights its outline; moved off it, or out of the window, the window is as it was', async ($, on) => {
  storeIn(on, new Map<string, unknown>([['save', { ...newGame(), level: 10 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  const cells = async () => (await ui.find({ type: 'Raster', key: 'talent' }))?.props.cells
  const move = (x: number, y: number) => ui.pointer({ type: 'move', x, y, in: 'talent-clicks' } as never)
  const idle = await cells()
  const take = takeRect()
  await move(take.x + 4, Math.floor((take.y + 5) / 2))
  const lit = await cells()
  expect(lit).not.toEqual(idle)
  // Nothing clickable under it: as it was.
  await move(50, 8)
  expect(await cells()).toEqual(idle)
  await move(take.x + 4, Math.floor((take.y + 5) / 2))
  expect(await cells()).toEqual(lit)
  await ui.pointer({ type: 'leave', x: 0, y: 0, in: 'talent-clicks' } as never)
  expect(await cells()).toEqual(idle)
  await ui.unmount()
})

/** A hero at depth 60 with its big boss slain: the fork for tier II waits. */
const atFork = () => {
  const g = newGame()
  return { ...g, ...arrive(g.world, 60), deepest: 60, bossSlain: 60 }
}

test('a fork waiting is chosen from the sheet, saved, and said', async ($, on) => {
  const saved = atFork()
  const kept = storeIn(on, new Map<string, unknown>([['save', saved]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sheet' })
  expect(await ui.find({ type: 'Button', key: 'sheet-deep', text: /Deep \(choose\)/ })).toBeDefined()
  await ui.press({ key: 'sheet-deep' })
  const hard = pairOf(saved.world, 2)[1]
  await ui.press({ key: `deep-${hard}` })
  expect((kept.get('save') as Game).marks).toEqual({ 2: hard })
  expect(await ui.find({ type: 'Button', key: 'sheet-deep', text: /Deep \(choose\)/ })).toBeUndefined()
  await ui.unmount()
})

test('on a wide pane a mark card, clicked, chooses that mark', async ($, on) => {
  const saved = atFork()
  const kept = storeIn(on, new Map<string, unknown>([['save', saved]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 20, LINE2_Y + 2)
  await ui.press({ key: 'sheet-deep' })
  const card = deepCards({ ...saved, panel: 'deep' })[1]!
  const at = { x: card.rect.x + 20, y: Math.floor((card.rect.y + 6) / 2) }
  await ui.pointer({ type: 'down', ...at, button: 'left', in: 'deep-clicks' } as never)
  await ui.pointer({ type: 'up', ...at, button: 'left', in: 'deep-clicks' } as never)
  expect((kept.get('save') as Game).marks).toEqual({ 2: card.mark })
  await ui.unmount()
})

/** The engine's file system and clipboard as a card press meets them: what was written where, what was copied. */
const cardWorld = (on: On, has: { downloads: boolean; copies: boolean; writes?: boolean }) => {
  const seen = { written: [] as { path: string; text: string }[], copied: [] as string[] }
  mock.env(on, { HOME: '/home/hero' })
  on('fs.exists', (_$, e) => ({ value: has.downloads && e.path === '/home/hero/Downloads' }) as never)
  on('fs.write', (_$, e) => {
    if (has.writes === false) throw new Error('EACCES')
    seen.written.push({ path: e.path, text: e.text })
    return { value: undefined } as never
  })
  on('ui.copy', (_$, e) => {
    seen.copied.push(e.text)
    return { value: has.copies ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } } as never
  })
  return seen
}

const openCodex = async ($: Engine, on: On, pane: typeof PANE | typeof WIDE = PANE) => {
  storeIn(on, new Map<string, unknown>([['save', { ...newGame(), panel: 'codex' }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ ...pane, surface: 'terminal' })
}

test('Card in the codex saves the hero card to Downloads as an SVG, copies it as text, and says both', async ($, on) => {
  const seen = cardWorld(on, { downloads: true, copies: true })
  const said = toasts(on)
  const ui = await openCodex($, on)
  await ui.press({ key: 'codex-card' })
  expect(seen.written.map(w => w.path)).toEqual(['/home/hero/Downloads/ascii-dungeon-hero.svg'])
  expect(seen.written[0]!.text).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
  expect(seen.copied).toEqual([cardText({ ...newGame(), panel: 'codex' })])
  expect(said).toContain('Hero card saved to ~/Downloads/ascii-dungeon-hero.svg. Text copied.')
  await ui.unmount()
})

test('without a Downloads folder the card goes to the home folder; a clipboard that refuses is said', async ($, on) => {
  const seen = cardWorld(on, { downloads: false, copies: false })
  const said = toasts(on)
  const ui = await openCodex($, on)
  await ui.press({ key: 'codex-card' })
  expect(seen.written.map(w => w.path)).toEqual(['/home/hero/ascii-dungeon-hero.svg'])
  expect(said).toContain('Hero card saved to ~/ascii-dungeon-hero.svg. The text could not be copied.')
  await ui.unmount()
})

test('a card that cannot be written is said, and the text is still copied', async ($, on) => {
  const seen = cardWorld(on, { downloads: true, copies: true, writes: false })
  const said = toasts(on)
  const ui = await openCodex($, on)
  await ui.press({ key: 'codex-card' })
  expect(seen.copied.length).toBe(1)
  expect(said).toContain('The hero card could not be saved to ~/Downloads/ascii-dungeon-hero.svg. Text copied.')
  await ui.unmount()
})

test('on a wide pane a click on Card on the codex window\'s Finds saves the card', async ($, on) => {
  const seen = cardWorld(on, { downloads: true, copies: true })
  const ui = await openCodex($, on, WIDE)
  await ui.press({ key: 'codex-page' })
  const r = codexCardRect({ page: 'finds' })!
  const at = { x: r.x + 2, y: Math.floor((r.y + 4) / 2) }
  await ui.pointer({ type: 'down', ...at, button: 'left', in: 'codex-clicks' } as never)
  await ui.pointer({ type: 'up', ...at, button: 'left', in: 'codex-clicks' } as never)
  expect(seen.written.length).toBe(1)
  await ui.unmount()
})

test('a session begun with talents owed says so in the log', async ($, on) => {
  const kept = storeIn(on, new Map<string, unknown>([['save', { ...newGame(), level: 91 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((kept.get('save') as Game).log).toContain('9 talents to choose: open the character sheet.')
  await ui.unmount()
})

test('a session begun with nothing waiting says nothing of it', async ($, on) => {
  const kept = storeIn(on, new Map<string, unknown>([['save', { ...newGame(), level: 5 }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const log = ((kept.get('save') as Game | undefined)?.log ?? [])
  expect(log.some(l => l.includes('to choose') || l.startsWith('The deep forks'))).toBe(false)
  await ui.unmount()
})

test('How it plays opens from settings over it, and closes back to settings', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, settingsSlotX(INNER) + 5, 5)
  expect(await ui.find({ type: 'Raster', key: 'settings' })).toBeDefined()
  const r = settingsRect(newGame(), { effects: true, music: true, volume: 4 }, SETTINGS_UI, 'help')!
  const at = { x: r.x + 2, y: Math.floor((r.y + 4) / 2) }
  await ui.pointer({ type: 'down', ...at, button: 'left', in: 'settings-clicks' } as never)
  await ui.pointer({ type: 'up', ...at, button: 'left', in: 'settings-clicks' } as never)
  expect(await ui.find({ type: 'Raster', key: 'help' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'settings' })).toBeUndefined()
  const close = { x: CLOSE_BOX[0] + 1, y: Math.floor((CLOSE_BOX[1] + 1) / 2) }
  await ui.pointer({ type: 'down', ...close, button: 'left', in: 'help-clicks' } as never)
  await ui.pointer({ type: 'up', ...close, button: 'left', in: 'help-clicks' } as never)
  expect(await ui.find({ type: 'Raster', key: 'help' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'settings' })).toBeDefined()
  await ui.unmount()
})

test('as text, How it plays lists the rules and closes', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'help-open' })
  expect(await ui.find({ type: 'Text', text: 'Tests that pass: a sure critical.' })).toBeDefined()
  await ui.press({ key: 'help-close' })
  expect(await ui.find({ type: 'Text', text: 'Tests that pass: a sure critical.' })).toBeUndefined()
  await ui.unmount()
})

test('before a big boss falls, Retire on the sheet does nothing', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sheet' })
  await ui.press({ key: 'sheet-retire' })
  expect(await ui.find({ type: 'Button', key: 'retire-back' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'sheet-close' })).toBeDefined()
  await ui.unmount()
})

test('a wide terminal pane of the best size draws the pixel strip alone under the map: no text rows, no buttons, no log', async $ => {
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  const hud = await ui.find({ type: 'Raster', key: 'hud' })
  expect(hud?.props.columns).toBe(110)
  expect(hud?.props.rows).toBe(hudLayout(110).height / 2)
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  expect(await ui.findAll({ type: 'Text' })).toEqual([])
  await ui.unmount()
})

test('what a click comes to shows as a toast: a belt slot drinks, and the empty slot says so', async ($, on) => {
  const said = toasts(on)
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, beltSlotX(INNER, 0) + 6, BELT_BELOW_Y + 5)
  await clickStrip(ui, beltSlotX(INNER, 0) + 6, BELT_BELOW_Y + 5)
  expect(said).toEqual(['You drink a Health Potion. +0 HP', 'Belt slot 1 is empty.'])
  await ui.unmount()
})

test('a foe summoned by a tool call is toasted with its threat; the narrow pane shows it in its log instead', async ($, on) => {
  const said = toasts(on)
  on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  expect(said.some(t => /^A .* of utils\.ts emerges: (easy|tough|deadly)\.$/.test(t))).toBe(true)
  await ui.unmount()
  said.length = 0
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  expect(said.filter(t => /emerges/.test(t))).toEqual([])
  await narrow.unmount()
})

test('clicking the level line opens the character sheet, and its Close button shuts it', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 40, LINE2_Y + 2)
  expect(await ui.find({ type: 'Button', key: 'train-might' })).toBeDefined()
  await ui.press({ key: 'sheet-close' })
  expect(await ui.find({ type: 'Button', key: 'train-might' })).toBeUndefined()
  await ui.unmount()
})

test('with the pixel strip the map is always pixels, whatever view a narrower pane left behind', async $ => {
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await narrow.press({ key: 'zoom' })
  expect(await narrow.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  await narrow.unmount()
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.columns).toBe(110)
  await ui.unmount()
})

test('the desktop keeps the text dashboard, with no strip', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'desktop' })
  expect(await ui.find({ type: 'Raster', key: 'hud' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^\[ +HP 30\/30 +\]/ })).toBeDefined()
  await ui.unmount()
})

test('a click on the pixel map reaches the game through the click layer', async ($, on) => {
  const clock = mock.clock(on)
  const said = toasts(on)
  on('ui.blit', () => ({ value: {} }))
  // Tall enough that the map window shows ground beyond the starting room.
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  expect(await ui.find({ type: 'Client', key: 'map-clicks' })).toBeDefined()
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  // The pane starts a new game; find a cell over ground no one can walk to (rock, or not yet seen) and one over seen floor beside the hero.
  const g = newGame()
  const level = levelOf(g)
  const tileAt = (x: number, y: number) => clickToTile(g, { x: x + 0.5, y: y + 0.5, columns, rows }, viewOf(g, columns, rows))
  const cells = Array.from({ length: columns * rows }, (_, i) => ({ x: i % columns, y: Math.floor(i / columns) }))
  const unseen = cells.find(c => {
    const t = tileAt(c.x, c.y)
    return t.x >= 0 && t.y >= 0 && t.x < 64 && t.y < 18 && (g.seen[t.y * 64 + t.x] === '0' || level.tiles[t.y]?.[t.x] !== '.')
  })!
  const floor = cells.find(c => {
    const t = tileAt(c.x, c.y)
    return Math.abs(t.x - g.x) + Math.abs(t.y - g.y) === 1 && level.tiles[t.y]?.[t.x] === '.'
  })!

  await ui.pointer({ type: 'down', x: unseen.x, y: unseen.y, button: 'left', in: 'map-clicks' })
  expect(said).toEqual(["You can't get there."])

  const before = (await ui.find({ type: 'Raster', key: 'map' }))?.props.cells
  await ui.pointer({ type: 'down', x: floor.x, y: floor.y, button: 'left', in: 'map-clicks' })
  await clock.advance(1000)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).not.toBe(before)
  await ui.unmount()
})

test('a click during a walk goes to the tile drawn under the pointer, the hero where he is drawn', async ($, on) => {
  const clock = mock.clock(on)
  const said = toasts(on)
  on('ui.blit', () => ({ value: {} }))
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  const g = newGame()
  const level = levelOf(g)
  const cells = Array.from({ length: columns * rows }, (_, i) => ({ x: i % columns, y: Math.floor(i / columns) }))
  // Read off the frame on screen before the walk: which cell shows the hero's tile, which one a floor tile beside it.
  const tileAt = (c: { x: number; y: number }) => clickToTile(g, { x: c.x + 0.5, y: c.y + 0.5, columns, rows }, viewOf(g, columns, rows))
  const home = cells.find(c => same(tileAt(c), g))!
  const floor = cells.find(c => {
    const t = tileAt(c)
    return Math.abs(t.x - g.x) + Math.abs(t.y - g.y) === 1 && level.tiles[t.y]?.[t.x] === '.'
  })!
  await ui.pointer({ type: 'down', ...floor, button: 'left', in: 'map-clicks' })
  // A one-tile step stays inside the camera's dead zone, so mid-walk the same cell still shows the hero's first tile.
  await clock.advance(40)
  await ui.pointer({ type: 'down', ...home, button: 'left', in: 'map-clicks' })
  await clock.advance(400)
  expect(said.filter(t => /can't get there/.test(t))).toEqual([])
  // Two pixels into the step the hero is still drawn on his own tile: the step is cut there, untaken, and the click on
  // him explores, as a click on the hero does.
  const startCenter = viewOf(g, columns, rows)
  const explored = apply(g, { kind: 'walk' })
  expect(same(explored, g)).toBe(false)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(pixelMap(explored, columns, rows, undefined, startCenter))
  await ui.unmount()
})

test('outside the fullscreen layout the pane says clicking needs it', async $ => {
  const outside = await $.ui.mount({ ...WIDE, surface: 'terminal', viewport: { columns: 200, rows: 60, isFullscreen: false } })
  expect(await outside.find({ type: 'Text', text: /^Playing by mouse needs the fullscreen layout/ })).toBeDefined()
  await outside.unmount()
  const inside = await $.ui.mount({ ...WIDE, surface: 'terminal', viewport: { columns: 200, rows: 60, isFullscreen: true } })
  expect(await inside.find({ type: 'Text', text: /needs the fullscreen layout/ })).toBeUndefined()
  await inside.unmount()
})

test('on a pane of 80 to 104 columns the compact inventory takes the pane, and closes back to the map', async $ => {
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 90 }, surface: 'terminal' })
  await ui.pointer({ type: 'down', x: INSET + 5, y: Math.floor((INSET + 5) / 2), button: 'left', in: 'hud-clicks' } as never)
  await ui.pointer({ type: 'up', x: INSET + 5, y: Math.floor((INSET + 5) / 2), button: 'left', in: 'hud-clicks' } as never)
  expect(await ui.find({ type: 'Raster', key: 'cbag' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'gear-weapon' })).toBeUndefined()
  await ui.press({ key: 'bag' })
  expect(await ui.find({ type: 'Raster', key: 'cbag' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await ui.unmount()
})

test('on a wide terminal the inventory takes the whole pane while it is open, and closes back to the map', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await clickStrip(ui, 5, 5)
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'hud' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeDefined()
  expect(await ui.find({ type: 'Client', key: 'bag-clicks' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'bag', text: /Close/ })).toBeDefined()
  await ui.press({ key: 'bag' })
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeUndefined()
  await ui.unmount()
})

test('with the mouse: gear is taken off, dragged back on, and a bag item destroyed from its menu after a second click', async ($, on) => {
  const said = toasts(on)
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  await clickStrip(ui, 5, 5)
  // A cell (x, y) of the click layer is the screen pixels x and 2y, 2y + 1; a pointer there lands on 2y + 1.
  const at = (px: number, py: number) => ({ x: px, y: Math.floor(py / 2) })
  const tap = async (p: { x: number; y: number }, button: 'left' | 'right' = 'left') => {
    await ui.pointer({ type: 'down', ...p, button, in: 'bag-clicks' })
    await ui.pointer({ type: 'up', ...p, button, in: 'bag-clicks' })
  }
  const [x, y, w, h] = WORN_SLOTS.weapon
  const slot = at(x + Math.floor(w / 2), INV_TOP + y + Math.floor(h / 2))
  await tap(slot)
  expect(await ui.find({ type: 'Text', text: /^> You take off the (.+)\.$/ })).toBeDefined()
  // Taken off, it lands in the bag's first free spot, the top-left cell: drag it back onto the slot.
  const first = at(BAG_X + 3, INV_TOP + BAG_Y + 4)
  await ui.pointer({ type: 'down', ...first, button: 'left', in: 'bag-clicks' })
  await ui.pointer({ type: 'move', ...slot, button: 'left', in: 'bag-clicks' })
  await ui.pointer({ type: 'up', ...slot, button: 'left', in: 'bag-clicks' })
  expect(await ui.find({ type: 'Text', text: /^> You equip the (.+)\.$/ })).toBeDefined()
  // Off again, then its menu by a right click: Destroy needs a second click.
  await tap(slot)
  await tap(first, 'right')
  const boxes = (await ui.find({ type: 'Client', key: 'bag-clicks' }))?.props.props as { boxes: { role: string; x: number; y: number }[] }
  const menu = boxes.boxes.find(b => b.role === 'menu')!
  const destroy = { x: menu.x + 3, y: menu.y + 2 }
  await tap(destroy)
  expect(await ui.find({ type: 'Text', text: /^> You destroy/ })).toBeUndefined()
  await tap(destroy)
  expect(await ui.find({ type: 'Text', text: /^> You destroy the (.+)\.$/ })).toBeDefined()
  // The inventory screen keeps its own log: what its clicks come to is not toasted as well.
  expect(said).toEqual([])
  await ui.unmount()
})

test('clicking the portrait in the strip opens the inventory', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  expect(await ui.find({ type: 'Client', key: 'hud-clicks' })).toBeDefined()
  await ui.pointer({ type: 'down', x: 5, y: 2, button: 'left', in: 'hud-clicks' })
  await ui.pointer({ type: 'up', x: 5, y: 2, button: 'left', in: 'hud-clicks' })
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeDefined()
  await ui.unmount()
})

test('a step plays as a walk: the hero is drawn at his starting tile first, at his new one once it ends', async ($, on) => {
  const clock = mock.clock(on)
  const frames: string[] = []
  on('ui.blit', (_$, e) => {
    if ('cells' in e) frames.push(e.cells)
    return { value: {} }
  })
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  const start = newGame()
  const after = apply(start, { kind: 'walk' })
  expect(after.walked.length).toBe(1)
  const shown = (await ui.find({ type: 'Raster', key: 'map' }))?.props.cells
  await ui.pointer({ type: 'down', ...heroCell(start, columns, rows), button: 'left', in: 'map-clicks' })
  const startCenter = viewOf(start, columns, rows)
  // Nothing has happened yet: the step is carried out when the walk ends, so the map is as it was until the first frame.
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(shown)
  await clock.advance(400)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(pixelMap(after, columns, rows, undefined, startCenter))
  // In between, a frame was painted at every tick, each one a frame further along: 1 px at a time, the camera
  // holding still for a one-tile step.
  expect(frames.length).toBe(4 - 1)
  frames.forEach((cells, i) => expect(cells).toBe(pixelMap(after, columns, rows, walkPosition([start, after], i + 1), startCenter, [], 0, isStrideFrame(i + 1))))
  await ui.unmount()
})

test('clicking a foe: its bar stays full while the hero walks up, and drops once he strikes', async ($, on) => {
  const clock = mock.clock(on)
  const frames: string[] = []
  on('ui.blit', (_$, e) => {
    if ('cells' in e) frames.push(e.cells)
    return { value: {} }
  })
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  // A failed edit summons a foe and leaves it unhurt.
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  await clock.advance(5000)
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const fill = hexToInt(FOE_BAR_FILL)
  // The bar's red pixels, read off the raster: each cell holds a top and a bottom pixel.
  const barPixels = (cells: string) => {
    const words = new Uint32Array(Uint8Array.from(atob(cells), ch => ch.charCodeAt(0)).buffer)
    const found: { x: number; y: number }[] = []
    words.forEach((w, i) => {
      const cell = Math.floor(i / 3)
      if (i % 3 !== 0 && w === fill) found.push({ x: cell % columns, y: 2 * Math.floor(cell / columns) + (i % 3) - 1 })
    })
    return found
  }
  const full = barPixels(map?.props.cells as string)
  expect(full.length).toBeGreaterThan(0)
  // The foe's sprite is just below its bar.
  const bar = full[0]!
  frames.length = 0
  await ui.pointer({ type: 'down', x: bar.x + 2.5, y: (bar.y + 3 + PX / 2) / 2, button: 'left', in: 'map-clicks' })
  await clock.advance(FRAME_MS)
  expect(frames.length).toBeGreaterThan(0)
  expect(barPixels(frames[0]!).length).toBe(full.length)
  await clock.advance(5000)
  expect(barPixels((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells as string).length).toBeLessThan(full.length)
  await ui.unmount()
})

test('a walk whose repaint is refused gives way to an ordinary redraw', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: { deny: 'not mounted' } }))
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const start = newGame()
  await ui.pointer({ type: 'down', ...heroCell(start, map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
  // Frames go out without waiting for the host: the refusal of one is seen on the walk's next frame.
  await clock.advance(80)
  const after = apply(start, { kind: 'walk' })
  const startCenter = viewOf(start, map?.props.columns as number, map?.props.rows as number)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(pixelMap(after, map?.props.columns as number, map?.props.rows as number, undefined, startCenter))
  await ui.unmount()
})

test('the pane asks to dock wide enough for the pixel inventory window', async ($, on) => {
  const opened: { columns?: number }[] = []
  on('ui.open', (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  await $.command.run({ command: 'dungeon', args: '' } as never)
  expect(opened.length).toBeGreaterThan(0)
  for (const o of opened) expect(o.columns).toBeGreaterThanOrEqual(108)
})

test('the portal slot takes the hero to town and back, the map and the toasts saying where he is', async ($, on) => {
  const said = toasts(on)
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  await clickStrip(ui, portalSlotX(INNER) + 5, 5)
  expect(said).toEqual(['You step through the portal into town.'])
  const town = apply(newGame(), { kind: 'portal' })
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(pixelMap(town, columns, rows, undefined, viewOf(town, columns, rows)))
  await clickStrip(ui, portalSlotX(INNER) + 5, 5)
  expect(said).toEqual(['You step through the portal into town.', 'You step back through the portal.'])
  await ui.unmount()
})

test('no frame around the game: neither the map nor the inventory screen draws a border, and the map spans the pane', async $ => {
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  const bordered = async () => (await ui.findAll({ type: 'Box' })).filter(b => b.props.borderStyle !== undefined).length
  // Pixel view: the larger-pixel map, then the inventory screen.
  expect(await bordered()).toBe(0)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.columns).toBe(WIDE.props.bodyColumns)
  await clickStrip(ui, 5, 5)
  expect(await bordered()).toBe(0)
  await ui.unmount()
})

test('the map takes every row the strip leaves, nothing for text rows or a frame', async $ => {
  // At the best size, so no note takes a row.
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  const strip = hudLayout(WIDE.props.bodyColumns).height / 2
  // The strip: 28 px of content and 2 px of frame and room each side, 32 px, 16 rows.
  expect(strip).toBe(16)
  expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.rows).toBe(80 - 16)
  await ui.unmount()
})

describe('what is toasted', () => {
  const g = newGame(4)
  const said = (next: Partial<Game>): Game => ({ ...g, toast: null, fresh: 0, ...next })

  test("the game's own news always, even with a log on screen", async () => {
    expect(toastFor(g, { ...said({}), toast: 'Level up! You are now level 2.' }, false, true)).toBe('Level up! You are now level 2.')
  })

  test('nothing else while a log is on screen: not a click\'s line, not a new foe', async () => {
    expect(toastFor(g, said({ fresh: 1, log: ["You can't get there."] }), true, true)).toBeNull()
    expect(toastFor(g, said({ foe: foeAhead(g, 3) }), false, true)).toBeNull()
  })

  test("a click's newest line, and nothing for a click that said nothing", async () => {
    expect(toastFor(g, said({ fresh: 2, log: ['You pick up 5 gold.', 'You find a Health Potion.'] }), true, false)).toBe('You find a Health Potion.')
    expect(toastFor(g, said({ fresh: 0 }), true, false)).toBeNull()
    expect(toastFor(g, said({ fresh: 1, log: ['A wall.'] }), false, false)).toBeNull()
  })

  test('a new foe with its threat, once: not the same foe again', async () => {
    const foe = foeAhead(g, 3, { name: 'goblin of x', hp: 4, maxHp: 9, atk: 1 })
    const fighting = { ...said({}), foe }
    expect(toastFor(g, fighting, false, false)).toBe(`A goblin of x emerges: ${threat(fighting)}.`)
    expect(threat(fighting)).toBe('easy')
    expect(toastFor(fighting, { ...fighting, foe: { ...foe, hp: 2 } }, false, false)).toBeNull()
  })
})

test('the frames report says how evenly ticks came and how long drawing took, against the budget', async () => {
  const summary = (p50: number, p99: number, max: number) => ({ count: 4, mean: 0, p50, p99, max })
  const none = summary(0, 0, 0)
  expect(framesReport({ ticks: 0, late: 0, skipped: 0, interval: none, work: none }, none, none)).toBe('No frames played yet: walk somewhere first.')
  expect(framesReport({ ticks: 120, late: 3, skipped: 1, interval: summary(33, 36, 70), work: summary(0.12, 4.1, 7.25) }, summary(0.05, 2, 3), summary(1.5, 9, 12))).toBe(
    '120 ticks, 3 late (over 49.5 ms after the last), 1 skipped while a frame was drawing. Gap between ticks: p50 33.0, p99 36.0, max 70.0 ms. ' +
      'Drawing a tick: p50 0.12, p99 4.1, max 7.3 ms (budget 33), of which the host taking the map: p50 0.05, p99 2.0, max 3.0 ms. ' +
      'Whole-pane redraws: 4, p50 1.5, p99 9.0, max 12.0 ms. Drawing the map: 0 with the ground kept, p50 0.00, p99 0.00 ms; 0 drawn afresh, p50 0.00, p99 0.00, max 0.00 ms.',
  )
  expect(framesReport({ ticks: 1, late: 0, skipped: 0, interval: none, work: none }, none, none, summary(0.5, 1, 2), { ...summary(80, 120, 130), count: 9 })).toMatch(
    /Drawing the map: 4 with the ground kept, p50 0\.50, p99 1\.0 ms; 9 drawn afresh, p50 80\.0, p99 120\.0, max 130\.0 ms\.$/,
  )
})

test('/dungeon-frames reports the walks played so far', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: {} }))
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  const map = await ui.find({ type: 'Raster', key: 'map' })
  await ui.pointer({ type: 'down', ...heroCell(newGame(), map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
  await clock.advance(400)
  const { text } = (await $.command.run({ command: 'dungeon-frames', args: '' } as never)) as { text: string }
  expect(text).toMatch(/^\d+ ticks, 0 late .*Gap between ticks: p50 33\.0, p99 33\.0, max 33\.0 ms\./)
  await ui.unmount()
})

test('/dungeon-bench plays a long walk in a fixed scene on screen only, and /dungeon-frames then reports just its frames', { timeoutMs: 20000 }, async ($, on) => {
  const clock = mock.clock(on)
  const frames: string[] = []
  on('ui.blit', (_$, e) => {
    if ('cells' in e) frames.push(e.cells)
    return { value: {} }
  })
  const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
  // The player's own game is somewhere else entirely: in town. The bench does not use it.
  await clickStrip(ui, portalSlotX(INNER) + 5, 5)
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  const { text } = (await $.command.run({ command: 'dungeon-bench', args: '' } as never)) as { text: string }
  expect(text).toBe('Bench walk started: 40 tiles, about 6 s. Run /dungeon-frames once the hero stops.')
  await clock.advance(40 * 4 * FRAME_MS + 1000)
  // Every frame but the last is repainted in place; the last hands back to the ordinary drawing. After it, only the
  // player's own town, its water shimmering.
  const town = apply(newGame(), { kind: 'portal' })
  const still = [false, true].map(shimmer => pixelMap(town, columns, rows, undefined, viewOf(town, columns, rows), [], 0, false, { bob: false, shimmer }))
  expect(frames.length).toBeGreaterThanOrEqual(40 * 4 - 1)
  expect(frames.slice(0, 40 * 4 - 1).some(f => still.includes(f))).toBe(false)
  expect(frames.slice(40 * 4 - 1).every(f => still.includes(f))).toBe(true)
  // The scene: a fixed level, every tile explored, so the walk crosses lit ground each time, whatever the save holds.
  const bench = { ...newGame(BENCH_SEED), seen: '1'.repeat(64 * 18) }
  const route = benchRoute(bench, 40)
  // A new place: the camera starts on the tile line nearest the hero as the first frame draws him.
  const at = walkPosition(route, 1)
  expect(frames[0]).toBe(stampCells(pixelMap(walkingGame(bench, bench, route, 1), columns, rows, at, tileCamera(null, at, columns, rows * 2), [], 0, true), 1))
  // Each bench frame carries its number: every one of them sent, in order, once; nothing after the bench is stamped.
  const stamps = frames.map(stampOf)
  expect(stamps.slice(0, 40 * 4 - 1)).toEqual(Array.from({ length: 40 * 4 - 1 }, (_, i) => (i + 1) % 16))
  expect(stamps.slice(40 * 4 - 1).every(n => n === undefined)).toBe(true)
  const report = ((await $.command.run({ command: 'dungeon-frames', args: '' } as never)) as { text: string }).text
  expect(report).toMatch(/^160 ticks, 0 late /)
  await ui.unmount()
})

describe('a click is carried out when the hero gets there, not when it is made', () => {
  const TALL = { ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' } as const

  test('clicking a foe: no blow while the hero walks up, the blow once he reaches it', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    on('ui.blit', () => ({ value: {} }))
    on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
    const ui = await $.ui.mount(TALL)
    await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
    await clock.advance(5000)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    // The foe a failed edit summoned, three tiles along the way to the stairs.
    const g = newGame()
    const foe = foeAhead(g, 3)
    said.length = 0
    await ui.pointer({ type: 'down', ...cellOf(g, foe, columns, rows), button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    // The exchange is toasted by its last line: the hero's blow, or the foe's answer to it.
    const blows = () => said.filter(t => /^You (CRITICALLY )?(hit|slay) |of utils\.ts strikes you/.test(t))
    expect(blows()).toEqual([])
    await clock.advance(5000)
    expect(blows().length).toBe(1)
    await ui.unmount()
  })

  test('in town the healer speaks once the hero stands beside her, not on the click', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount(TALL)
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const town = apply(newGame(), { kind: 'portal' })
    said.length = 0
    await ui.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS.healer, map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    expect(said).toEqual([])
    await clock.advance(5000)
    expect(said).toEqual(['The healer finds nothing to mend.'])
    await ui.unmount()
  })

  test('in town a click on the portal walks the hero to it, frame by frame, and only then steps through', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    let blits = 0
    on('ui.blit', () => {
      blits += 1
      return { value: {} }
    })
    const ui = await $.ui.mount(TALL)
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    const town = apply(newGame(), { kind: 'portal' })
    const portal = cellOf(town, TOWN_SPOTS.portal, columns, rows)
    // Off to open ground first, so the portal is a walk away; two tiles, so the camera holds still and the cells hold.
    const away = [2].flatMap(d => [{ x: TOWN_SPOTS.portal.x + d, y: TOWN_SPOTS.portal.y }, { x: TOWN_SPOTS.portal.x - d, y: TOWN_SPOTS.portal.y }, { x: TOWN_SPOTS.portal.x, y: TOWN_SPOTS.portal.y - d }]).find(p => isTownWalkable(p) && townSpotAt(p) === undefined)!
    await ui.pointer({ type: 'down', ...cellOf(town, away, columns, rows), button: 'left', in: 'map-clicks' })
    await clock.advance(5000)
    said.length = 0
    blits = 0
    await ui.pointer({ type: 'down', ...portal, button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    expect(said).toEqual([])
    await clock.advance(5000)
    expect(blits).toBeGreaterThan(2)
    expect(said).toContain('You step back through the portal.')
    await ui.unmount()
  })

  test('a click on the stairs walks the hero to them, frame by frame, and only then descends', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    let blits = 0
    on('ui.blit', () => {
      blits += 1
      return { value: {} }
    })
    // A hero four tiles of known floor from the stairs, every tile seen.
    const g0 = newGame()
    const level = levelOf(g0)
    const way = bfs(level.tiles, g0, level.stairs)!
    const from = way[way.length - 5]!
    const start: Game = { ...g0, x: from.x, y: from.y, seen: '1'.repeat(g0.seen.length) }
    const kept = storeIn(on, new Map<string, unknown>([['save', start]]))
    on('command.register', () => ({ value: undefined }) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TALL)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const stairs = cellOf(start, level.stairs, map?.props.columns as number, map?.props.rows as number)
    said.length = 0
    blits = 0
    await ui.pointer({ type: 'down', ...stairs, button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    // A frame in: still on depth 1, nothing said of the stairs.
    expect((kept.get('save') as Game).depth).toBe(1)
    expect(said.some(l => / descend to depth /.test(l))).toBe(false)
    await clock.advance(5000)
    expect(blits).toBeGreaterThan(2)
    expect((kept.get('save') as Game).depth).toBe(2)
    await ui.unmount()
  })

  test('a second click during a walk to someone waits for the visit, then goes on from there', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount(TALL)
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    const town = apply(newGame(), { kind: 'portal' })
    // Both cells read off the screen before either walk, the camera holding still in town's small square.
    const healer = cellOf(town, TOWN_SPOTS.healer, columns, rows)
    const elder = cellOf(town, TOWN_SPOTS.elder, columns, rows)
    said.length = 0
    await ui.pointer({ type: 'down', ...healer, button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    await ui.pointer({ type: 'down', ...elder, button: 'left', in: 'map-clicks' })
    // The hero is still on his way to the healer: no visit yet, and none rushed through.
    expect(said).toEqual([])
    await clock.advance(5000)
    expect(said).toHaveLength(2)
    expect(said[0]).toBe('The healer finds nothing to mend.')
    expect(said[1]).toMatch(/^The elder: "(Slay|Reach) /)
    await ui.unmount()
  })

  test('a tool call that moves the hero carries out the click first, at once', async ($, on) => {
    const clock = mock.clock(on)
    const said = toasts(on)
    on('ui.blit', () => ({ value: {} }))
    // Edits fail (a foe appears, unhurt); reads succeed and explore.
    on('tool.call', (_$, e) => (e.tool === 'Read' ? { result: { file: { content: '' } } as never } : { result: { stdout: '', stderr: 'boom' } as never, isError: true }))
    const ui = await $.ui.mount(TALL)
    await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
    await clock.advance(5000)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const g = newGame()
    said.length = 0
    await ui.pointer({ type: 'down', ...cellOf(g, foeAhead(g, 3), map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' })
    // The blow came with the read, not at the end of a walk the read would have overtaken.
    expect(said.filter(t => /^You (CRITICALLY )?(hit|slay) |of utils\.ts strikes you/.test(t)).length).toBe(1)
    await ui.unmount()
  })

  test('a tool call alongside the walk leaves it drawing the click\'s walk, the ground uncovered as the hero gets there and staying uncovered', async ($, on) => {
    const clock = mock.clock(on)
    const frames: string[] = []
    on('ui.blit', (_$, e) => {
      if ('cells' in e) frames.push(e.cells)
      return { value: {} }
    })
    on('tool.call', () => ({ result: { content: 'done' } as never }))
    const ui = await $.ui.mount(TALL)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    const g = newGame()
    const route = routeToStairs(g) ?? []
    // A tile on screen, already seen, whose walk changes what is drawn: ground uncovered, or a pickup taken on the way.
    const changes = (p: { x: number; y: number }) => {
      const after = apply(g, { kind: 'goto', ...p })
      return after.seen !== g.seen || after.taken.length > 0
    }
    const target = [...route, ...cellsIn(g, columns, rows)].find(p => g.seen[p.y * 64 + p.x] === '1' && cellOf(g, p, columns, rows) !== undefined && changes(p))
    expect(target).toBeDefined()
    const plan = apply(g, { kind: 'goto', ...target! })
    const path = [{ x: g.x, y: g.y }, ...plan.walked]
    await ui.pointer({ type: 'down', ...cellOf(g, target!, columns, rows), button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    // A subagent mid-walk: an ally heals the hero; nothing moves.
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'x', subagent_type: 'general-purpose' } as never)
    await clock.advance(5000)
    let camera = viewOf(g, columns, rows)
    // Each frame the game as of the tile the hero has reached.
    const tiles = alongTheWay(g, plan)!
    const expected = Array.from({ length: (path.length - 1) * 4 - 1 }, (_, i) => {
      const at = walkPosition(path, i + 1)
      camera = tileCamera(camera, at, columns, rows * 2)
      return pixelMap(walkState(g, tiles, i + 1), columns, rows, at, camera, [], 0, isStrideFrame(i + 1))
    })
    expect(frames.length).toBe(expected.length)
    frames.forEach((cells, i) => {
      if (cells !== expected[i]) throw new Error(`frame ${i + 1} is not the walk's`)
    })
    await ui.unmount()
  })

  test('a tool call that leaves the hero where he is lets the walk play out in full', async ($, on) => {
    const clock = mock.clock(on)
    let blits = 0
    on('ui.blit', () => {
      blits += 1
      return { value: {} }
    })
    on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
    const ui = await $.ui.mount(TALL)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const g = newGame()
    // The hero clicked: an explore step, a tile's worth of frames.
    await ui.pointer({ type: 'down', ...heroCell(g, map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
    await clock.advance(FRAME_MS)
    // A failed shell command mid-walk: a foe appears, the hero stays.
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(5000)
    // The walk's 3 frames in full; then the knight's shield turns the new foe's first blow and BLOCK rises over the
    // hero, a pixel every 2 of its 18 frames: 9 frames, the repeats not sent; then the ordinary map once its frames end.
    expect(blits).toBe(4 - 1 + HIT_FRAMES / 2 + 1)
    await ui.unmount()
  })
})

const mountTall = ($: Engine) => $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
type PaneUi = Awaited<ReturnType<typeof mountTall>>

/** Walks a new hero through the portal to a spot in a wide pane, after `first` (in the dungeon); its window is open after. */
const atTheSpot = async ($: Engine, on: On, spot: keyof typeof TOWN_SPOTS, first?: (ui: PaneUi) => Promise<void>) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: {} }))
  const ui = await mountTall($)
  await first?.(ui)
  await clickStrip(ui, portalSlotX(INNER) + 5, 5)
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const town = apply(newGame(), { kind: 'portal' })
  await ui.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS[spot], map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
  await clock.advance(5000)
  return ui
}
const atTheMerchant = ($: Engine, on: On) => atTheSpot($, on, 'merchant')

/** A pane too narrow for the pixel windows, wide enough for the pixel map and strip. */
const NARROW = { ...PANE, props: { ...PANE.props, bodyColumns: INV_W - 15, scroll: { offset: 0, bodyRows: 80 } } } as const

test('in a pane too narrow for its window the merchant opens a text shop of clickable wares, which says what a purchase came to, and closes', async ($, on) => {
  const said = toasts(on)
  // Opened where the map shows the merchant, then seen in a narrower pane: the game is the same.
  await (await atTheMerchant($, on)).unmount()
  const ui = await $.ui.mount({ ...NARROW, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'shop' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'buy-health1', text: 'Buy Health Potion: 25 gold' })).toBeDefined()
  said.length = 0
  await ui.press({ key: 'buy-health1' })
  // A new hero has no gold: the shop says so.
  expect(said).toEqual(['Not enough gold: a Health Potion costs 25.'])
  await ui.press({ key: 'shop-close' })
  expect(await ui.find({ type: 'Button', key: 'buy-health1' })).toBeUndefined()
  await ui.unmount()
})

test('on a wide pane the merchant opens a pixel window in place of the map, with no text shop, and closes back to the map', async ($, on) => {
  const ui = await atTheMerchant($, on)
  expect(await ui.find({ type: 'Raster', key: 'shop' })).toBeDefined()
  expect(await ui.find({ type: 'Client', key: 'shop-clicks' })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'buy-health1' })).toBeUndefined()
  await ui.press({ key: 'shop-close' })
  expect(await ui.find({ type: 'Raster', key: 'shop' })).toBeUndefined()
  expect(await ui.find({ type: 'Raster', key: 'map' })).toBeDefined()
  await ui.unmount()
})

test('in the merchant\'s window a clicked ware shows its card, a second click its menu, and the key says when the gold is short', async ($, on) => {
  const said = toasts(on)
  const ui = await atTheMerchant($, on)
  const r = wareRect(0)
  // A cell (x, y) of the click layer is the window pixels x and 2y, 2y + 1.
  const ware = { x: r.x + Math.floor(r.w / 2), y: Math.floor((r.y + 4) / 2) }
  const tap = async () => {
    await ui.pointer({ type: 'down', ...ware, button: 'left', in: 'shop-clicks' })
    await ui.pointer({ type: 'up', ...ware, button: 'left', in: 'shop-clicks' })
  }
  const boxes = async () => ((await ui.find({ type: 'Client', key: 'shop-clicks' }))?.props.props as { boxes: { lines: { text: string }[][] }[] }).boxes.map(b => b.lines.map(l => l.map(x => x.text).join('')))
  await tap()
  expect((await boxes())[0]?.[0]).toBe('Health Potion')
  expect((await boxes()).length).toBe(1)
  await tap()
  expect((await boxes())[1]).toEqual(['b Buy for 25  not enough gold'])
  said.length = 0
  await ui.press({ key: 'shop-buy' })
  // A new hero has no gold.
  expect(said).toEqual(['Not enough gold: a Health Potion costs 25.'])
  await ui.unmount()
})

/** The text of a pixel window's boxes, by the window's click layer: each box a list of its lines. */
const boxTexts = async (ui: PaneUi, key: string) =>
  ((await ui.find({ type: 'Client', key }))?.props.props as { boxes: { lines: { text: string }[][] }[] }).boxes.map(b => b.lines.map(l => l.map(r => r.text).join('')))

test('on a wide pane the smith opens a pixel window on the first piece worn, its prices or why not, and its keys work', async ($, on) => {
  const said = toasts(on)
  const ui = await atTheSpot($, on, 'smith')
  expect(await ui.find({ type: 'Raster', key: 'forge' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'temper-weapon' })).toBeUndefined()
  const [card] = await boxTexts(ui, 'forge-clicks')
  // A new knight's Short Sword: no gold to temper, a Common has nothing to reforge.
  expect(card?.[0]).toBe('Short Sword')
  expect(card?.slice(-2)).toEqual(['Temper 60  not enough gold', 'Reforge a Common has no affixes'])
  said.length = 0
  await ui.press({ key: 'forge-temper' })
  expect(said).toEqual(['Not enough gold: tempering costs 60.'])
  await ui.press({ key: 'forge-next' })
  expect((await boxTexts(ui, 'forge-clicks'))[0]?.[0]).not.toBe('Short Sword')
  await ui.press({ key: 'forge-close' })
  expect(await ui.find({ type: 'Raster', key: 'forge' })).toBeUndefined()
  await ui.unmount()
})

test('in a pane too narrow for its window the smith offers to temper each worn item at its price, and says when the gold is short', async ($, on) => {
  const said = toasts(on)
  await (await atTheSpot($, on, 'smith')).unmount()
  const ui = await $.ui.mount({ ...NARROW, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'temper-weapon', text: 'Temper: 60 gold' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Short Sword' })).toBeDefined()
  said.length = 0
  await ui.press({ key: 'temper-weapon' })
  expect(said).toEqual(['Not enough gold: tempering costs 60.'])
  await ui.press({ key: 'forge-close' })
  expect(await ui.find({ type: 'Button', key: 'temper-weapon' })).toBeUndefined()
  await ui.unmount()
})

/** The worn sword taken off into the bag through the inventory, then the hero walked to the stash in a wide pane. */
const swordToTheStash = async ($: Engine, on: On) =>
  atTheSpot($, on, 'stash', async ui => {
    await clickStrip(ui, 5, 5)
    const [x, y, w, h] = WORN_SLOTS.weapon
    const slot = { x: x + Math.floor(w / 2), y: Math.floor((INV_TOP + y + Math.floor(h / 2)) / 2) }
    await ui.pointer({ type: 'down', ...slot, button: 'left', in: 'bag-clicks' })
    await ui.pointer({ type: 'up', ...slot, button: 'left', in: 'bag-clicks' })
    await ui.press({ key: 'bag' })
  })

test('on a wide pane the stash opens a pixel window: the chosen bag item stored by its key, chosen in the chest and taken back', async ($, on) => {
  const ui = await swordToTheStash($, on)
  expect(await ui.find({ type: 'Raster', key: 'chest' })).toBeDefined()
  const list = async () => (await boxTexts(ui, 'chest-clicks'))[0]!
  expect((await list()).every(line => line === '-')).toBe(true)
  await ui.press({ key: 'chest-store' })
  expect((await list())[0]?.trim()).toBe('Short Sword')
  await ui.press({ key: 'chest-next' })
  expect((await list())[0]).toBe('> Short Sword')
  await ui.press({ key: 'chest-take' })
  expect((await list()).every(line => line === '-')).toBe(true)
  await ui.press({ key: 'stash-close' })
  expect(await ui.find({ type: 'Raster', key: 'chest' })).toBeUndefined()
  await ui.unmount()
})

test('in a pane too narrow for its window the stash takes the selected bag item and hands it back', async ($, on) => {
  const picked = newGame().gear.weapon!
  await (await swordToTheStash($, on)).unmount()
  const ui = await $.ui.mount({ ...NARROW, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Nothing stored yet.' })).toBeDefined()
  await ui.press({ key: 'store' })
  expect(await ui.find({ type: 'Button', key: `retrieve-${picked.id}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Your bag is empty.' })).toBeDefined()
  await ui.press({ key: `retrieve-${picked.id}` })
  expect(await ui.find({ type: 'Text', text: 'Nothing stored yet.' })).toBeDefined()
  await ui.press({ key: 'stash-close' })
  expect(await ui.find({ type: 'Button', key: 'stash-close' })).toBeUndefined()
  await ui.unmount()
})

test('a killing blow plays its walk, its hit frames and 4 held frames more, sending no frame that repeats the one before', async ($, on) => {
  const clock = mock.clock(on)
  let blits = 0
  let sent: string[] = []
  on('ui.blit', (_$, e) => {
    blits += 1
    sent.push(String((e as { cells: unknown }).cells))
    return { value: {} }
  })
  on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  // The same game beside the pane's, edit by edit, until a blow kills.
  let g = newGame()
  for (let edit = 0; edit < 20; edit += 1) {
    const summoned = apply(g, onToolStart('Edit', '/src/utils.ts'))
    const next = apply(summoned, { kind: 'outcome', ok: true, what: 'Edit' })
    blits = 0
    sent = []
    await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
    await clock.advance(5000)
    const hits = hitsBetween(summoned, next)
    g = next
    if (!hits.some(h => h.kind === 'kill')) continue
    const walked = Math.max(0, next.walked.length * FRAMES_PER_TILE - 1)
    // The blow plays its frames (18 and a 4-frame hold), but a frame the same as the one before is not sent again:
    // the hold and the number's rise a pixel every other frame repeat.
    expect(hitFramesFor(hits)).toBe(HIT_FRAMES + 4)
    expect(sent.every((cells, i) => i === 0 || cells !== sent[i - 1])).toBe(true)
    expect(blits).toBeGreaterThan(walked + HIT_FRAMES / 2 - 2)
    expect(blits).toBeLessThan(walked + hitFramesFor(hits) - 1)
    await ui.unmount()
    return
  }
  throw new Error('no kill in 20 edits')
})

test('on a wide pane every townsperson opens a pixel window of their words with a Close button; the mystic\'s offers a fortune', { timeoutMs: 20000 }, async ($, on) => {
  const clock = mock.clock(on)
  const said = toasts(on)
  on('ui.blit', () => ({ value: {} }))
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  await clickStrip(ui, portalSlotX(INNER) + 5, 5)
  const map = await ui.find({ type: 'Raster', key: 'map' })
  const columns = map?.props.columns as number
  const rows = map?.props.rows as number
  const town = apply(newGame(), { kind: 'portal' })
  const words = async () => ((await ui.find({ type: 'Client', key: 'talk-clicks' }))?.props.props as { boxes: { lines: { text: string }[][] }[] } | undefined)?.boxes[0]?.lines.map(l => l.map(r => r.text).join('')) ?? []
  // The first words of each, for a new hero on their first visit.
  const first = { healer: /^"Not a scratch on you/, elder: /^"Slay|^"Reach/, mystic: /^"Come back when your purse is heavier/, guard: /^"/, villager: /^"Your stash by the square/, dog: /^The dog wags its tail/ } as const
  for (const who of Object.keys(first) as (keyof typeof first)[]) {
    // Out and back through the portal: the camera recenters on the arrival, where the cells below assume it.
    if (who !== 'healer') {
      await clickStrip(ui, portalSlotX(INNER) + 5, 5)
      await clickStrip(ui, portalSlotX(INNER) + 5, 5)
      await clock.advance(5000)
    }
    await ui.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS[who], columns, rows), button: 'left', in: 'map-clicks' })
    await clock.advance(5000)
    expect(await ui.find({ type: 'Raster', key: 'talk' })).toBeDefined()
    expect((await words())[0]).toMatch(first[who])
    if (who === 'mystic') {
      expect(await ui.find({ type: 'Button', key: 'talk-act', text: /Fortune/ })).toBeDefined()
      said.length = 0
      await ui.press({ key: 'talk-act' })
      expect(said).toEqual(['The mystic: "A fortune costs 30 gold."'])
    }
    await ui.press({ key: `${who}-close` })
    expect(await ui.find({ type: 'Button', key: `${who}-close` })).toBeUndefined()
  }
  await ui.unmount()
})

test('in a pane too narrow for their window the dog has a text window of its own, and petting it counts', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: {} }))
  const wide = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  await clickStrip(wide, portalSlotX(INNER) + 5, 5)
  const map = await wide.find({ type: 'Raster', key: 'map' })
  const town = apply(newGame(), { kind: 'portal' })
  await wide.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS.dog, map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
  await clock.advance(5000)
  await wide.unmount()
  const ui = await $.ui.mount({ ...NARROW, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster', key: 'talk' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^The dog/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'pet', text: 'Pet the dog (0 so far)' })).toBeDefined()
  await ui.press({ key: 'pet' })
  expect(await ui.find({ type: 'Button', key: 'pet', text: 'Pet the dog (1 so far)' })).toBeDefined()
  await ui.unmount()
})

test('a blow plays as hit frames: the number over the foe for 18 frames, then the ordinary map again', async ($, on) => {
  const clock = mock.clock(on)
  const frames: string[] = []
  on('ui.blit', (_$, e) => {
    if ('cells' in e) frames.push(e.cells)
    return { value: {} }
  })
  // An edit that succeeds: it summons a foe and strikes it at once.
  on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  await clock.advance(2000)
  // The hero walks up first; the blow's frames follow the walk's.
  expect(frames.length).toBeGreaterThanOrEqual(HIT_FRAMES - 1)
  const after = (await ui.find({ type: 'Raster', key: 'map' }))?.props.cells
  // Every frame of the blow is not the ordinary map; the last one sent is, so the terminal is left showing it
  // whether or not the host repaints a map whose cells it already had.
  expect(frames.slice(0, -1).every(f => f !== after)).toBe(true)
  expect(frames.at(-1)).toBe(after)
  await ui.unmount()
})

test('a kill\'s number does not stay on the map: once its frames end the last frame sent is the ordinary map', async ($, on) => {
  const clock = mock.clock(on)
  const frames: string[] = []
  on('ui.blit', (_$, e) => {
    if ('cells' in e) frames.push(e.cells)
    return { value: {} }
  })
  // A foe beside the hero with 1 HP: the next edit's blow slays it.
  const g0 = newGame()
  storeIn(on, new Map<string, unknown>([['save', { ...g0, foe: foeAhead(g0, 1, { hp: 1, maxHp: 1, atk: 0 }) }]]))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
  await clock.advance(1000)
  frames.length = 0
  await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
  await clock.advance(5000)
  const tree = (await ui.find({ type: 'Raster', key: 'map' }))?.props.cells
  expect(frames.length).toBeGreaterThan(2)
  expect(frames.at(-1)).toBe(tree)
  await ui.unmount()
})

describe('idle motion in the pane', () => {
  test('the bob starts 10 s after the last thing happened, then flips every 12 frames; the shimmer only in town, every 10', async () => {
    const BOB = 12 * FRAME_MS
    expect(IDLE_BEFORE_BOB_MS).toBe(10_000)
    expect(ambientAt(IDLE_BEFORE_BOB_MS - 1, 0, false).bob).toBe(false)
    expect(ambientAt(IDLE_BEFORE_BOB_MS, 0, false).bob).toBe(true)
    expect(ambientAt(IDLE_BEFORE_BOB_MS + BOB - 1, 0, false).bob).toBe(true)
    expect(ambientAt(IDLE_BEFORE_BOB_MS + BOB, 0, false).bob).toBe(false)
    expect(ambientAt(IDLE_BEFORE_BOB_MS + 2 * BOB, 0, false).bob).toBe(true)
    const SHIMMER = 10 * FRAME_MS
    expect([0, SHIMMER - 1, SHIMMER, 2 * SHIMMER].map(t => ambientAt(t, t, true).shimmer)).toEqual([false, false, true, false])
    expect(ambientAt(SHIMMER, SHIMMER, false).shimmer).toBe(false)
  })

  test('standing idle 10 s the pane paints the hero lifted, then back down 12 frames later', async ($, on) => {
    const clock = mock.clock(on)
    const frames: string[] = []
    on('ui.blit', (_$, e) => {
      if ('cells' in e) frames.push(e.cells)
      return { value: {} }
    })
    on('tool.call', () => ({ result: {} as never }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    // A tool that moves nothing on the map (a companion joins): the last thing to happen.
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'x' })
    const g = newGame()
    const view = viewOf(g, columns, rows)
    frames.length = 0
    await clock.advance(IDLE_BEFORE_BOB_MS - 200)
    expect(frames).toEqual([])
    await clock.advance(400)
    expect(frames.at(-1)).toBe(pixelMap(g, columns, rows, undefined, view, [], 0, false, { bob: true, shimmer: false }))
    await clock.advance(12 * FRAME_MS)
    const down = pixelMap(g, columns, rows, undefined, view, [], 0, false, { bob: false, shimmer: false })
    expect(frames.at(-1)).toBe(down)
    // Lifted again, then a tool call: the hero is back down at once and waits another 10 s.
    await clock.advance(12 * FRAME_MS)
    await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'x' })
    frames.length = 0
    await clock.advance(IDLE_BEFORE_BOB_MS - 200)
    expect(frames).toEqual([])
    expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(down)
    await ui.unmount()
  })
})

describe('pickups on a walk', () => {
  // Several worlds, so the pickup lands on frames where the camera pages as well as on frames where it holds.
  const READS = 40
  for (const world of [1, 3, 4, 6, 7, 8]) test(`a tool call that walks the hero over something picks it up only when the walk gets there (world ${world})`, { timeoutMs: 20000 }, async ($, on) => {
    const clock = mock.clock(on)
    let lastBlit = ''
    on('ui.blit', (_$, e) => {
      if ('cells' in e) lastBlit = e.cells
      return { value: {} }
    })
    // The first call fails, so an imp's blow leaves the hero hurt; after that every read succeeds.
    let calls = 0
    on('tool.call', () => (calls++ === 0 ? { result: {} as never, isError: true as const } : { result: { file: { content: '' } } as never }))
    storeIn(on, new Map<string, unknown>([['save', newGame(world)]]))
    on('command.register', () => ({ value: undefined }) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    const hud = async () => (await ui.find({ type: 'Raster', key: 'hud' }))?.props.cells as string
    // The same game beside the pane's, read by read, until a read's walk takes something up.
    let g = newGame(world)
    for (let call = 0; call < READS; call += 1) {
      const was = g
      const walked = apply(g, onToolStart('Read', '/a.ts'))
      const next = apply(walked, { kind: 'outcome', ok: call > 0, what: 'Read' })
      // The first tile on the way holding something to take: not taken before, and no furnishing.
      const tile = walked.walked.findIndex(p => !was.taken.includes(cellId(p)) && !' BLQF'.includes(floorThing(was.world, was.depth, levelOf(was), p)))
      const isPickup = walked.walked.length > 1 && walked.log.slice(-walked.fresh).some(l => /^You (pick up|find|pray|read at)/.test(l))
      await $.tool.call({ tool: 'Read', file_path: '/a.ts' })
      g = next
      // Something taken mid-walk: on the walk's last tile the walk is over and the pane draws the hero at rest instead,
      // and a walk that only reaches a furnishing (an altar, a lectern) changes nothing on the strip.
      if (!isPickup || tile < 0 || tile >= walked.walked.length - 1) {
        await clock.advance(5000)
        continue
      }
      // The strip changes on the very frame the hero reaches the tile, not before and not at the walk's end.
      const before = await hud()
      let changedOn = 0
      for (let frame = 1; frame <= walked.walked.length * FRAMES_PER_TILE && changedOn === 0; frame += 1) {
        await clock.advance(FRAME_MS)
        if ((await hud()) !== before) changedOn = frame
      }
      expect(changedOn).toBe((tile + 1) * FRAMES_PER_TILE)
      // The pane redrawn for the strip draws the map as the walk does: nothing taken comes back, nothing blinks.
      expect((await ui.find({ type: 'Raster', key: 'map' }))?.props.cells).toBe(lastBlit)
      await ui.unmount()
      return
    }
    throw new Error(`no pickup on a walk in ${READS} reads`)
  })
})

describe('sound', () => {
  /** Edits until one kills; what the pane asked the host to play. */
  const playedUntilKill = async ($: Engine, on: On) => {
    const clock = mock.clock(on)
    const played: string[] = []
    on('audio.play', (_$, e) => {
      if (e.clip.asset !== undefined) played.push(e.clip.asset)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    let g = newGame()
    for (let edit = 0; edit < 20; edit += 1) {
      const next = apply(apply(g, onToolStart('Edit', '/src/utils.ts')), { kind: 'outcome', ok: true, what: 'Edit' })
      await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
      await clock.advance(5000)
      if (next.log.some(l => l.startsWith('You slay ') && !g.log.includes(l))) break
      g = next
    }
    await ui.unmount()
    return played
  }

  test('a kill plays its sound', async ($, on) => {
    expect(await playedUntilKill($, on)).toContain('sounds/kill.wav')
  })

  test('with the sound option off nothing plays', { options: { sound: false } }, async ($, on) => {
    expect(await playedUntilKill($, on)).toEqual([])
  })
})

describe('footsteps and the portal', () => {
  const playedOnBench = async ($: Engine, on: On) => {
    const clock = mock.clock(on)
    const played: string[] = []
    // The effects alone: the town's tune has a test of its own.
    on('audio.play', (_$, e) => {
      if (e.clip.asset !== undefined && e.clip.asset !== TOWN_TUNE) played.push(e.clip.asset)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    await $.command.run({ command: 'dungeon-bench', args: '' } as never)
    await clock.advance(40 * 4 * FRAME_MS + 1000)
    await ui.unmount()
    return played
  }

  test('the portal sounds, and the 40-tile bench walk steps every other tile: 20 steps, the two in turn', { timeoutMs: 20000 }, async ($, on) => {
    const played = await playedOnBench($, on)
    expect(played[0]).toBe('sounds/portal.wav')
    const steps = played.filter(p => p.includes('step'))
    expect(steps).toHaveLength(20)
    expect(steps.slice(0, 3)).toEqual(['sounds/step1.wav', 'sounds/step2.wav', 'sounds/step1.wav'])
  })

  test('with its clips read, a walk sounds as one clip: every footstep mixed in on its frame, none played alone', { timeoutMs: 20000 }, async ($, on) => {
    const clock = mock.clock(on)
    // Each clip a single sample, so the mix shows where each was laid.
    on('fs.read', () => ({ value: { base64: base64Of(wavOf(Int16Array.from([1000]))) } }))
    const played: { asset?: string; base64?: string }[] = []
    on('audio.play', (_$, e) => {
      if (e.clip.asset !== TOWN_TUNE) played.push(e.clip)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    await $.command.run({ command: 'dungeon-bench', args: '' } as never)
    await clock.advance(40 * 4 * FRAME_MS + 1000)
    await ui.unmount()
    expect(played.filter(c => c.asset?.includes('step'))).toEqual([])
    const mixes = played.filter(c => c.base64 !== undefined)
    expect(mixes).toHaveLength(1)
    const pcm = readWav(bytesOf(mixes[0]!.base64!))!
    // Twenty footsteps, one every other tile from the first frame, each at its gain in the mix.
    const laid = Array.from({ length: 20 }, (_, i) => pcm[sampleOf(1 + 8 * i)])
    expect(laid).toEqual(Array(20).fill(1000 * gainOf('step1')))
  })

  test('an action that comes to several sounds plays them as one clip, each on a frame of its own: a fight\'s blows, deaths and drops', { timeoutMs: 20000 }, async ($, on) => {
    const clock = mock.clock(on)
    on('fs.read', () => ({ value: { base64: base64Of(wavOf(Int16Array.from([1000]))) } }))
    on('tool.call', () => ({ result: { filePath: '/src/utils.ts' } as never }))
    const mixes: Int16Array[] = []
    on('audio.play', (_$, e) => {
      if (e.clip.base64 !== undefined) mixes.push(readWav(bytesOf(e.clip.base64))!)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await clock.advance(1000)
    for (let i = 0; i < 40; i += 1) {
      await $.tool.call({ tool: 'Edit', file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
      await clock.advance(3000)
    }
    await ui.unmount()
    // The fights' own clips (a walk's start with a footstep on frame 1): each sound a single sample, laid on its frame.
    const exchanges = mixes.filter(m => m[sampleOf(1)] === 0)
    const onsets = exchanges.map(m => Array.from(m.keys()).filter(i => m[i] !== 0))
    expect(onsets.some(o => o.length >= 2)).toBe(true)
    const frames = new Set(Array.from({ length: 40 }, (_, f) => sampleOf(f)))
    expect(onsets.every(o => o[0] === 0 && o.every(i => frames.has(i)))).toBe(true)
  })

  test('with the sound option off, no footsteps and no portal', { options: { sound: false }, timeoutMs: 20000 }, async ($, on) => {
    expect(await playedOnBench($, on)).toEqual([])
  })
})

describe('town music in the pane', () => {
  const plays = async ($: Engine, on: On) => {
    const clock = mock.clock(on)
    const played: string[] = []
    on('audio.play', (_$, e) => {
      if (e.clip.asset === TOWN_TUNE) played.push(e.clip.asset)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    // Into town, out, and in again.
    for (let i = 0; i < 3; i += 1) {
      await clickStrip(ui, portalSlotX(INNER) + 5, 5)
      await clock.advance(1000)
    }
    await ui.unmount()
    return played
  }

  test('entering town starts the tune, leaving stops it, coming back starts it again', async ($, on) => {
    expect(await plays($, on)).toEqual([TOWN_TUNE, TOWN_TUNE])
  })

  test('the pane plays the tune a round at a time, each started as the last ends, never left to the host to loop', { timeoutMs: 20000 }, async ($, on) => {
    const clock = mock.clock(on)
    const rounds: boolean[] = []
    on('audio.play', (_$, e) => {
      if (e.clip.asset === TOWN_TUNE) rounds.push(e.shouldLoop === true)
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(2 * TUNE_MS + 100)
    await ui.unmount()
    expect(rounds).toEqual([false, false, false])
  })

  test('walking about town keeps the one tune going, never a second over it', async ($, on) => {
    const clock = mock.clock(on)
    let loops = 0
    on('audio.play', (_$, e) => {
      if (e.clip.asset === TOWN_TUNE) loops += 1
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const town = apply(newGame(), { kind: 'portal' })
    for (const spot of ['guard', 'elder'] as const) {
      await ui.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS[spot], map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
      await clock.advance(5000)
      // The window covers the map: closed, the walk about town goes on.
      await ui.press({ key: `${spot}-close` })
    }
    expect(loops).toBe(1)
    await ui.unmount()
  })

  test('with the music option off, no tune', { options: { music: false } }, async ($, on) => {
    expect(await plays($, on)).toEqual([])
  })
})

describe('the mix in the pane', () => {
  test('footsteps play over the portal sound, nothing cut; every clip plays at its level in the mix', async ($, on) => {
    const clock = mock.clock(on)
    const played: { asset: string; gain?: number; at: number }[] = []
    on('audio.play', (_$, e) => {
      played.push({ asset: e.clip.asset ?? '', gain: e.gain, at: clock.now() })
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
    const town = apply(newGame(), { kind: 'portal' })
    // Through the portal and off at once to the healer: the walk's first steps sound while the portal's still does.
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    const map = await ui.find({ type: 'Raster', key: 'map' })
    await ui.pointer({ type: 'down', ...cellOf(town, TOWN_SPOTS.healer, map?.props.columns as number, map?.props.rows as number), button: 'left', in: 'map-clicks' })
    await clock.advance(5000)
    const portal = played.find(p => p.asset === 'sounds/portal.wav')!
    const steps = played.filter(p => p.asset.includes('step'))
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.some(s => s.at < portal.at + CLIP_MS.portal)).toBe(true)
    expect(played.find(p => p.asset === 'sounds/town.wav')?.gain).toBe(MUSIC_GAIN)
    expect(portal.gain).toBe(gainOf('portal'))
    expect(steps.every(s => s.gain === gainOf('step1'))).toBe(true)
    await ui.unmount()
  })

  test('settings set the sound: at a quarter volume the portal and the tune play at a quarter of their levels; with music off no tune', async ($, on) => {
    const clock = mock.clock(on)
    const played: { asset: string; gain?: number }[] = []
    on('audio.play', (_$, e) => {
      played.push({ asset: e.clip.asset ?? '', gain: e.gain })
      return { value: undefined }
    })
    on('ui.blit', () => ({ value: {} }))
    const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
    await clickStrip(ui, settingsSlotX(INNER) + 5, 5)
    // Full, then a quarter: one press goes round to it.
    await ui.press({ key: 'settings-volume' })
    await ui.press({ key: 'settings-close' })
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    expect(played.find(p => p.asset === 'sounds/portal.wav')?.gain).toBe(gainOf('portal') / 4)
    expect(played.find(p => p.asset === 'sounds/town.wav')?.gain).toBe(MUSIC_GAIN / 4)
    // Back to the dungeon, music off, and into town again: no tune.
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    await clickStrip(ui, settingsSlotX(INNER) + 5, 5)
    await ui.press({ key: 'settings-music' })
    await ui.press({ key: 'settings-close' })
    played.length = 0
    await clickStrip(ui, portalSlotX(INNER) + 5, 5)
    await clock.advance(1000)
    expect(played.some(p => p.asset === 'sounds/portal.wav')).toBe(true)
    expect(played.some(p => p.asset === 'sounds/town.wav')).toBe(false)
    await ui.unmount()
  })
})

describe('the inventory during a walk', () => {
  test('opened while a tool call walks the hero, the pixel inventory opens, and stays open once the walk is done', async ($, on) => {
    const clock = mock.clock(on)
    on('ui.blit', () => ({ value: {} }))
    on('tool.call', () => ({ result: { file: { content: '' } } as never }))
    const ui = await $.ui.mount({ ...WIDE, surface: 'terminal' })
    await $.tool.call({ tool: 'Read', file_path: '/a.ts' })
    await clock.advance(FRAME_MS)
    await clickStrip(ui, 5, 5)
    expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeDefined()
    await clock.advance(5000)
    expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeDefined()
    await ui.unmount()
  })
})

describe('a walk cut short', () => {
  test('a second click cuts the walk where the hero is drawn: only the tiles he has walked count, and the new walk starts there', async ($, on) => {
    const clock = mock.clock(on)
    let blits = 0
    on('ui.blit', () => {
      blits += 1
      return { value: {} }
    })
    const ui = await $.ui.mount({ ...WIDE, props: { ...WIDE.props, scroll: { offset: 0, bodyRows: 80 } }, surface: 'terminal' })
    const map = await ui.find({ type: 'Raster', key: 'map' })
    const columns = map?.props.columns as number
    const rows = map?.props.rows as number
    const g = newGame()
    // A seen tile on screen at least 5 tiles' walk away.
    const target = cellsIn(g, columns, rows).find(p => g.seen[p.y * 64 + p.x] === '1' && cellOf(g, p, columns, rows) !== undefined && apply(g, { kind: 'goto', ...p }).walked.length >= 5)!
    expect(target).toBeDefined()
    await ui.pointer({ type: 'down', ...cellOf(g, target, columns, rows), button: 'left', in: 'map-clicks' })
    // Two tiles walked, then back to where he set out.
    await clock.advance(2 * FRAMES_PER_TILE * FRAME_MS)
    blits = 0
    await ui.pointer({ type: 'down', ...heroCell(g, columns, rows), button: 'left', in: 'map-clicks' })
    await clock.advance(5000)
    // The walk back is the two tiles walked: 2 tiles of 4 frames, the last handed to the ordinary drawing.
    expect(blits).toBe(2 * FRAMES_PER_TILE - 1)
    await ui.unmount()
  })
})

describe('a pane short of the size the game plays best in', () => {
  const sized = (columns: number, rows: number) => ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' as const })

  test('says so on its top row, wide enough but short; narrow, the width note alone', async $ => {
    const short = await $.ui.mount(sized(110, 40))
    expect(await short.find({ type: 'Text', text: 'ASCII Dungeon plays best in a pane at least 105 columns wide and 47 rows tall; this one is 110 by 40.' })).toBeDefined()
    await short.unmount()
    const narrow = await $.ui.mount(sized(90, 40))
    expect(await narrow.find({ type: 'Text', text: /^Widen the pane for the full pixel windows/ })).toBeDefined()
    expect(await narrow.find({ type: 'Text', text: /^ASCII Dungeon plays best/ })).toBeUndefined()
    await narrow.unmount()
    const best = await $.ui.mount(sized(110, 47))
    expect(await best.find({ type: 'Text', text: /^ASCII Dungeon plays best|^Widen the pane/ })).toBeUndefined()
    await best.unmount()
  })

  test('the map gives up the note\'s row: one row short of the best size, two map rows fewer', async $ => {
    const rowsAt = async (rows: number) => {
      const ui = await $.ui.mount(sized(110, rows))
      const n = (await ui.find({ type: 'Raster', key: 'map' }))?.props.rows as number
      await ui.unmount()
      return n
    }
    expect((await rowsAt(47)) - (await rowsAt(46))).toBe(2)
  })

  test('a window it cannot show whole says on its top row the rows it needs; a pane that holds it says nothing', async ($, on) => {
    storeIn(on, new Map<string, unknown>([['save', { ...newGame(), panel: 'settings' }]]))
    on('command.register', () => ({ value: undefined }) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const cut = await $.ui.mount(sized(110, 30))
    expect((await cut.find({ type: 'Raster', key: 'settings' }))?.props.rows).toBe(35)
    // Settings is 35 rows, with 5 under it and this line: 41.
    expect(await cut.find({ type: 'Text', text: 'This window needs 41 rows to show whole; the pane has 30. Make it taller, or scroll down.' })).toBeDefined()
    await cut.unmount()
    const whole = await $.ui.mount(sized(110, 41))
    expect(await whole.find({ type: 'Text', text: /^This window needs/ })).toBeUndefined()
    await whole.unmount()
  })
})

describe('a pane too narrow for the pixel views', () => {
  test('says so, and how wide each needs; a pane wide enough says nothing', async $ => {
    const narrow = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await narrow.find({ type: 'Text', text: 'Widen the pane for the pixel strip and inventory (80 columns) and the full windows (105); it is 60.' })).toBeDefined()
    await narrow.unmount()
    const middle = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 90 }, surface: 'terminal' })
    expect(await middle.find({ type: 'Text', text: 'Widen the pane for the full pixel windows, the town\'s and the character sheet (105 columns); it is 90.' })).toBeDefined()
    await middle.unmount()
    const wide = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 110 }, surface: 'terminal' })
    expect(await wide.find({ type: 'Text', text: /^Widen the pane/ })).toBeUndefined()
    await wide.unmount()
  })
})
