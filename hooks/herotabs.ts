// The hero's windows as tabs of one: the sheet, the bag, the talents, the deep and the codex, each titled by the five
// tabs, the talents and the deep marked while one is owed or a fork waits. Pure: a window asks for its chrome, and
// whether a click in its title bar picked another tab.
import type { Game, Panel } from '../types'
import type { Action } from './game'
import { owed } from './talents'
import { isForkOpen } from './deep'
import { isInside, textTabRects } from './window'
import type { Chrome, Rect, Tab } from './window'
import type { Pos } from './map'

type HeroPanel = Extract<Panel, 'sheet' | 'bag' | 'talent' | 'deep' | 'codex'>
const TABS: readonly { label: string; panel: HeroPanel }[] = [
  { label: 'HERO', panel: 'sheet' },
  { label: 'BAG', panel: 'bag' },
  { label: 'TALENT', panel: 'talent' },
  { label: 'ABYSS', panel: 'deep' },
  { label: 'CODEX', panel: 'codex' },
]

const tabsOf = (g: Game): Tab[] => TABS.map(t => ({ label: t.label, isMarked: (t.panel === 'talent' && owed(g) > 0) || (t.panel === 'deep' && isForkOpen(g)) }))
const chosenOf = (panel: HeroPanel) => TABS.findIndex(t => t.panel === panel)

/** The chrome of the hero's window showing `panel`: the tabs in the title bar, that one chosen. */
export const heroChrome = (g: Game, panel: HeroPanel): Chrome => ({
  title: TABS[chosenOf(panel)]!.label,
  tabs: { items: tabsOf(g), chosen: chosenOf(panel) },
})

/** A click at `at` (window pixels) on a tab: another tab opens its window; the one shown, nothing. Off the tabs, undefined. */
export const heroTabAt = (g: Game, panel: HeroPanel, at: Pos): Action[] | undefined => {
  const i = textTabRects(tabsOf(g)).findIndex(r => isInside(at, r.x, r.y, r.w, r.h))
  if (i < 0) return undefined
  return TABS[i]!.panel === panel ? [] : [{ kind: 'panel', panel: TABS[i]!.panel }]
}

/** The hero's tabs other than the one shown, in window pixels: what a click there opens. */
export const heroTabsHot = (g: Game, panel: HeroPanel): Rect[] => textTabRects(tabsOf(g)).filter((_, i) => TABS[i]!.panel !== panel)
