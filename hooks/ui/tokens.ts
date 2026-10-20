// The interface's design tokens: each color a window draws, named once by its role; the spacing windows lay out by;
// and the families a card belongs to. A window built on the kit takes its colors from here, not codes of its own.

/** What is written or marked: text, the dimmed and the disabled, gold, the white of the focus. */
export const INK = {
  text: '#e8e4dc',
  dim: '#8a8494',
  gold: '#ffd34d',
  focus: '#ffffff',
  focusShade: '#9a96a4',
  onRibbon: '#14101a',
} as const

/** What things are drawn on: a card's face and edge, a rule's line, a framed backdrop, the shadows under them. */
export const SURFACE = {
  card: '#15131b',
  cardEdge: '#3a3644',
  rule: '#4a4456',
  frame: '#6b6258',
  backdrop: '#1c2230',
  floor: '#232a3a',
  inset: '#0c0a10',
  shadow: '#06050a',
  veil: '#0b0a0f',
} as const

/** Pixels between things side by side. */
export const SPACE = { gap: 3 } as const

/** A family a card belongs to: its ribbon's word, its ink, the light and dark of its bevel, its face top to bottom. */
export type Family = { label: string; ink: string; light: string; dark: string; top: string; bottom: string }
export const FAMILIES = {
  work: { label: 'WORK', ink: '#5ccf6a', light: '#a8f0b0', dark: '#2c6a36', top: '#1a2a20', bottom: '#0f1612' },
  fight: { label: 'FIGHT', ink: '#f06a5a', light: '#ffb0a6', dark: '#7a2a24', top: '#2c1820', bottom: '#160d11' },
  road: { label: 'ROAD', ink: '#ffd34d', light: '#fff0b0', dark: '#8a6a1a', top: '#2a2416', bottom: '#15120b' },
} as const satisfies Record<string, Family>
export type FamilyName = keyof typeof FAMILIES
