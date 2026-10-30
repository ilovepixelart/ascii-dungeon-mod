import { describe, expect, test } from 'claude-code/testing'

import { HELP_PAGES, HELP_ROWS, helpGesture, helpHeight, helpOverlay, helpPixels, helpTabRects } from './helpwindow'
import type { HelpPage } from './helpwindow'
import { missingGlyphs } from './pixelart'
import { CLOSE_BOX, POPOVER_BG } from './window'
import type { Gesture } from './window'

const tap = (x: number, y: number): Gesture => ({ type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })

describe('the how it plays window', () => {
  const text = (line: { text: string }[]) => line.map(r => r.text).join('')

  test('heads its box with what it is about, bold in gold, a row of room under it', async () => {
    const lines = helpOverlay().find(b => b.role === 'about')!.lines
    expect(lines[0]).toEqual([{ text: 'Your coding plays the hero.', bold: true, color: '#ffd34d' }])
    expect(lines[1]).toEqual([])
  })

  test('says what the coding does: a rule each, what happens and what it comes to', async () => {
    expect(HELP_ROWS.map(r => [r.when, r.does])).toEqual([
      ['Every tool call', 'A step or a blow'],
      ['A failed call', 'Lets the foe strike'],
      ['Tests that pass', 'A sure critical'],
      ['A commit', 'A shrine and full HP'],
      ['A push or a PR', 'A cache of loot'],
      ['An answer finished', 'The stairs down, after 3 calls'],
    ])
    const lines = helpOverlay().find(b => b.role === 'about')!.lines
    HELP_ROWS.forEach((r, i) => {
      expect(lines[2 + 3 * i]![0]).toMatchObject({ text: r.when, bold: true })
      expect(lines[3 + 3 * i]![0]).toMatchObject({ text: r.does, dim: true })
    })
    expect(text(lines[lines.length - 1]!)).toBe('You pick the gear and the talents, and set the orders.')
  })

  test('the work it rewards is in green: tests, commits, pushes and pull requests', async () => {
    const color = (when: string) => helpOverlay().find(b => b.role === 'about')!.lines.find(l => l[0]?.text === when)![0]!.color
    expect(['Tests that pass', 'A commit', 'A push or a PR'].map(color)).toEqual(['#3ccf4e', '#3ccf4e', '#3ccf4e'])
    expect(color('Every tool call')).toBeUndefined()
  })

  test('each rule\'s icon beside its first line, in a column left of the text\'s box, where its fill does not reach', async () => {
    const px = helpPixels()
    const box = helpOverlay().find(b => b.role === 'about')!
    // The click layer fills a box's cells from box.x + 1: the icons, cells 5 to 9, are clear of it.
    expect(box.x + 1).toBeGreaterThan(9)
    HELP_ROWS.forEach((_, i) => {
      const y = 2 * (box.y + 3 + 3 * i)
      const inked = [0, 1, 2, 3, 4].some(dy => px[y + dy]!.slice(5, 10).some(p => p !== POPOVER_BG))
      expect(inked).toBe(true)
    })
  })

  test('every page fits in 40 rows at one height, every letter one the font has', async () => {
    missingGlyphs.clear()
    for (const page of Object.keys(HELP_PAGES) as HelpPage[]) {
      const px = helpPixels(page)
      expect(px.length).toBe(helpHeight())
      // Its box inside the window, under the tabs.
      const box = helpOverlay(page).find(b => b.role === 'about')!
      expect(2 * (box.y + box.h)).toBeLessThanOrEqual(helpHeight())
    }
    expect(helpHeight()).toBeLessThanOrEqual(80)
    expect([...missingGlyphs]).toEqual([])
  })

  test('its close box closes it; a tab shows its page; anywhere else, nothing', async () => {
    expect(helpGesture(tap(CLOSE_BOX[0] + 1, CLOSE_BOX[1] + 1))).toBe('close')
    const tabs = helpTabRects()
    expect(tabs.length).toBe(4)
    expect(tabs.map(r => helpGesture(tap(r.x + 1, r.y + 1)))).toEqual(['coding', 'hand', 'town', 'growth'])
    expect(helpGesture(tap(40, 70))).toBeUndefined()
    expect(helpGesture({ type: 'drag', from: { x: 1, y: 1 }, at: { x: 9, y: 9 }, button: 'left' } as Gesture)).toBeUndefined()
  })

  test('its pages say how the hero plays by hand, what the town holds, and how the hero grows', async () => {
    expect(HELP_PAGES.hand.rows.map(r => [r.when, r.does])).toEqual([
      ['A walk', 'May meet a foe'],
      ['A foe met', 'Hits twice as hard as its kind'],
      ['A click on a foe', 'Walks up and strikes'],
      ['A click on the stairs', 'Walks there and down'],
      ['Tool-call talents and gear', 'Never offered'],
      ['Orders, in Settings', 'Hand or session play'],
    ])
    expect(HELP_PAGES.town.rows.map(r => [r.when, r.does])).toEqual([
      ['The portal (t)', 'To town and back, no foe alive'],
      ['The healer', 'Full HP, free'],
      ['The merchant', 'Potions and scrolls'],
      ['The smith', 'Tempers and reforges gear'],
      ['The stash', 'Kept for your next hero'],
      ['5 calls, no window open', 'Back to the dungeon'],
    ])
    expect(HELP_PAGES.growth.rows.map(r => [r.when, r.does])).toEqual([
      ['Every 5th level', 'A talent, one of three'],
      ['Every 5th depth', 'A guardian bars the stairs'],
      ['Every 10th depth', 'A big boss instead'],
      ['Past depth 50', 'The Abyss: a mark each circle'],
      ['The codex', 'All you found and slew'],
    ])
    // The coding page is HELP_ROWS, as before; each page heads with its own line.
    expect(HELP_PAGES.coding.rows).toBe(HELP_ROWS)
    expect((Object.keys(HELP_PAGES) as HelpPage[]).map(p => text(helpOverlay(p).find(b => b.role === 'about')!.lines[0]!))).toEqual([
      'Your coding plays the hero.', 'You play the hero yourself.', 'The town, through the portal.', 'How the hero grows.',
    ])
  })
})
