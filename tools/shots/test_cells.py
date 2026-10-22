"""cells.py against hand-made tmux captures. Run: python3 -m unittest tools/shots/test_cells.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cells import ANSI16, crop_pane, parse


def chars(rows):
    return ["".join(ch for ch, _, _ in cells) for cells in rows]


class Parse(unittest.TestCase):
    def test_reads_truecolor_and_256_colour_grounds_and_resets(self):
        [row] = parse("\x1b[38;2;255;0;0;48;5;16mA\x1b[1mB\x1b[0mC")
        a, b, c = (st for _, st, _ in row)
        self.assertEqual((a["fg"], a["bg"], a["bold"]), ((255, 0, 0), (0, 0, 0), False))
        self.assertEqual((b["fg"], b["bold"]), ((255, 0, 0), True))
        self.assertEqual((c["fg"], c["bg"], c["bold"]), (None, None, False))

    def test_reads_the_named_colours_bright_ones_from_the_upper_eight(self):
        [row] = parse("\x1b[31;102mA\x1b[39;49mB")
        self.assertEqual((row[0][1]["fg"], row[0][1]["bg"]), (ANSI16[1], ANSI16[10]))
        self.assertEqual((row[1][1]["fg"], row[1][1]["bg"]), (None, None))
        # Bright white is not white in Ghostty's palette: the upper eight are read as their own.
        [bright] = parse("\x1b[97mA\x1b[37mB")
        self.assertEqual(
            [st["fg"] for _, st, _ in bright], [(0xFF, 0xFF, 0xFF), (0xDC, 0xDF, 0xE4)]
        )

    def test_dim_and_bold_end_together_and_inverse_ends_alone(self):
        [row] = parse("\x1b[1;2;7mA\x1b[22mB\x1b[27mC")
        flags = [(st["bold"], st["dim"], st["inverse"]) for _, st, _ in row]
        self.assertEqual(
            flags, [(True, True, True), (False, False, True), (False, False, False)]
        )

    def test_a_wide_character_takes_two_cells_and_other_escapes_take_none(self):
        [row] = parse("\x1b[?25l\x1b]0;title\x07戦x")
        self.assertEqual([(ch, w) for ch, _, w in row], [("戦", 2), ("", 0), ("x", 1)])

    def test_trailing_empty_rows_are_dropped(self):
        self.assertEqual(chars(parse("a\nb\n\n\n")), ["a", "b"])


class Crop(unittest.TestCase):
    def test_keeps_the_pane_right_of_the_divider_and_above_the_prompt_rule_without_blank_rows(
        self,
    ):
        screen = "\n".join(
            [
                "chat │      ",
                "chat │ PANE ",
                "chat │ two  ",
                "chat │      ",
                "─" * 50,
                "> prompt",
            ]
        )
        self.assertEqual(chars(crop_pane(parse(screen))), [" PANE ", " two  "])

    def test_a_row_with_a_ground_is_not_blank(self):
        screen = "x│\x1b[48;2;1;2;3m  \x1b[0m\nx│ y"
        self.assertEqual(chars(crop_pane(parse(screen))), ["  ", " y"])


if __name__ == "__main__":
    unittest.main()
