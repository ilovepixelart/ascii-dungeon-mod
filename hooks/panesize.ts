// What the pane's size is short of, as a line to show: a window taller than the pane, and a pane under the size the
// game plays best in. Pure: the pane says where and when.
import { WINDOW_W } from './window'

/** The rows a window's lines take under it: a gap and the keys, then a gap and the log's last two lines. */
export const UNDER_WINDOW = 5
/** A window's hint under its keys, a line, where it has one. */
export const HINT_ROWS = 1
/** The pane the game plays best in: every window wide enough, the tallest (the bag and the merchant, 41 rows) whole with
 * its keys, its hint and the log under it, and the note's row. */
export const BEST_COLUMNS = WINDOW_W
export const BEST_ROWS = 48

/** A window of `rows` and `under` rows beneath it that the pane's `bodyRows` cannot show whole: how many it needs, counting this line. */
export const fitNote = (rows: number, under: number, bodyRows: number): string | undefined => {
  const needed = rows + under + 1
  return needed > bodyRows ? `This window needs ${needed} rows to show whole; the pane has ${bodyRows}. Make it taller, or scroll down.` : undefined
}

/** A pane under the size the game plays best in, said once; nothing at that size or over. */
export const sizeNote = (columns: number, rows: number): string | undefined =>
  columns < BEST_COLUMNS || rows < BEST_ROWS ? `ASCII Dungeon plays best in a pane at least ${BEST_COLUMNS} columns wide and ${BEST_ROWS} rows tall; this one is ${columns} by ${rows}.` : undefined
