// The interface's design tokens: each color a window draws, named once by its role; the spacing windows lay out by;
// and the families a card belongs to. A window takes its colors from here, never a code of its own: the colors gate
// (scripts/check-colors.mjs) holds every module that draws a window to it.

/** What is written or marked: text, the dimmed and the disabled, gold, the white of the focus, what each state says. */
export const INK = {
  text: '#e8e4dc',
  dim: '#8a8494',
  off: '#5a5664',
  gold: '#ffd34d',
  focus: '#ffffff',
  focusShade: '#9a96a4',
  white: '#ffffff',
  onRibbon: '#14101a',
  /** Text on a bright bar or a light color. */
  onBright: '#1a1820',
  /** The work the game rewards, and an upgrade. */
  good: '#3ccf4e',
  /** An easier mark, and the points to spend. */
  easy: '#5ccf6a',
  /** A harder mark. */
  hard: '#ff7a59',
  /** The close box's X, a death, a foe that slew the hero. */
  danger: '#ff5a4f',
  /** What the hero cannot wear or do. */
  wrong: '#ff4a4a',
  /** A shape for what is not there: an empty slot's ghost. */
  ghost: '#2a2732',
  /** Art a palette lacks a color for: loud on purpose. */
  missing: '#ff00ff',
  coinRim: '#c9971f',
  unpaidRim: '#4a4652',
  /** The XP bar and the quest's, lit to shaded; the smith's pips. */
  xpLight: '#f0d070',
  xp: '#d9b54a',
  xpShade: '#a88430',
} as const

/** What things are drawn on: the ground, title bar, cards, buttons, frames, lines, and the shadows under them. */
export const SURFACE = {
  ground: '#0b0b10',
  titleBar: '#15131b',
  slot: '#1a1820',
  /** A grid's lines, a rule between sections. */
  line: '#2c2834',
  card: '#15131b',
  cardEdge: '#3a3644',
  /** A found entry's box in the codex. */
  litEdge: '#3a3440',
  /** What is not yet found: its shape alone. */
  shade: '#2e2a38',
  frame: '#6b6258',
  backdrop: '#1c2230',
  floor: '#232a3a',
  inset: '#0c0a10',
  shadow: '#06050a',
  veil: '#0b0a0f',
  /** A text box's fill, under the click layer's text. */
  popover: '#0e0d13',
  /** A button's face, and a row standing out; an off button's, and an empty box. */
  raised: '#1f1c27',
  sunken: '#141219',
  buttonLit: '#2c2836',
  buttonEdge: '#4a4456',
  /** The chosen tab's ground, an off button's edge. */
  tab: '#24212c',
  closeGround: '#2a1e24',
  /** The hero card's ground. */
  print: '#0f0d14',
  xpEmpty: '#2a2618',
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
