"""The frame stamps' reader in measure.py, against hand-made terminal streams. Run: python3 -m unittest tools/test_measure.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from measure import frame_report, stamps


def stamped(n):
    """A chunk as a terminal gets a frame stamped n: other colors around the stamp's background."""
    return f"\x1b[38;2;10;20;30;48;2;{17 * (n % 16)};0;255m \x1b[48;2;1;2;3m".encode()


class Stamps(unittest.TestCase):
    def test_reads_every_stamp_in_order_with_its_time(self):
        raw = [
            (0.0, stamped(1)),
            (0.033, stamped(2) + stamped(3)),
            (0.1, b"\\x1b[48;2;254;0m no stamp"),
        ]
        self.assertEqual(stamps(raw), [(0.0, 1), (0.033, 2), (0.033, 3)])

    def test_unwraps_the_count_past_16_and_sees_a_skip(self):
        raw = [(i * 0.033, stamped(n)) for i, n in enumerate([14, 15, 16, 17, 19, 20])]
        self.assertEqual([n for _, n in stamps(raw)], [14, 15, 16, 17, 19, 20])

    def test_a_repeat_and_a_step_back_read_as_such(self):
        raw = [(i * 0.033, stamped(n)) for i, n in enumerate([1, 2, 2, 1, 3])]
        self.assertEqual([n for _, n in stamps(raw)], [1, 2, 2, 1, 3])

    def test_reports_skipped_repeated_and_out_of_order_frames(self):
        arrivals = [
            (0.000, 1),
            (0.033, 2),
            (0.066, 4),
            (0.099, 4),
            (0.132, 3),
            (0.165, 6),
        ]
        r = frame_report(arrivals)
        self.assertEqual(r["skipped"], [5])
        self.assertEqual(r["repeated"], [4])
        self.assertEqual(r["out_of_order"], 1)
        self.assertEqual(r["received"], 6)

    def test_an_even_stream_has_no_jitter_and_keeps_its_schedule(self):
        arrivals = [(i * 0.033, i + 1) for i in range(10)]
        r = frame_report(arrivals)
        self.assertAlmostEqual(r["jitter_ms"], 0, places=6)
        self.assertAlmostEqual(r["late_max"], 0, places=6)
        self.assertEqual(r["skipped"], [])

    def test_a_stall_shows_as_jitter_and_as_frames_behind_schedule(self):
        # Frame 5 arrives 100 ms late, and every frame after it with it.
        arrivals = [(i * 0.033 + (0.1 if i >= 4 else 0), i + 1) for i in range(10)]
        r = frame_report(arrivals)
        self.assertGreater(r["jitter_ms"], 20)
        self.assertAlmostEqual(r["late_max"], 100, places=3)


if __name__ == "__main__":
    unittest.main()
