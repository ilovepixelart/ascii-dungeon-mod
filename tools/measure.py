"""End-to-end frame measurement: runs a real Claude Code with this mod in a pseudo-terminal answering as Ghostty, plays /dungeon-bench,
and measures what the terminal actually receives (when each frame's bytes arrive, how many) and the CPU the process
uses, then prints the mod's own /dungeon-frames report beside it.

Usage: python3 tools/measure.py [--columns 200] [--rows 60] [--seconds 8] [--cwd DIR] [--screen FILE]
"""

import argparse
import fcntl
import itertools
import os
import pty
import re
import select
import signal
import struct
import subprocess
import termios
import threading
import time

# The terminal it plays: Ghostty 1.3.1's replies to what the host asks (version, keyboard, device attributes, the
# graphics probe, cell size in pixels, a mode report).
ANSWERS = [
    (b"\x1b[>0q", b"\x1bP>|ghostty 1.3.1\x1b\\"),
    (b"\x1b[?u", b"\x1b[?0u"),
    (b"\x1b[c", b"\x1b[?62;22c"),
    (b"\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\", b"\x1b_Gi=31;OK\x1b\\"),
    (b"\x1b[16t", b"\x1b[6;20;10t"),
    (b"\x1b[?1016$p", b"\x1b[?1016;2$y"),
]
MOD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAME_MS = 33
# Output arriving within this many ms of the previous chunk belongs to the same frame.
BURST_GAP_MS = 4
ANSI = re.compile(
    r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-Za-z]|\x1b[=>78]"
)


def spawn(columns, rows, cwd):
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(cwd)
        env = dict(
            os.environ,
            TERM="xterm-ghostty",
            TERM_PROGRAM="ghostty",
            TERM_PROGRAM_VERSION="1.3.1",
            COLORTERM="truecolor",
        )
        # The default permission mode: should anything reach the model, no tool runs without a prompt nobody answers.
        os.execvpe(
            "claude",
            ["claude", "--plugin-dir", MOD, "--permission-mode", "default"],
            env,
        )
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
    return pid, fd


class Recorder:
    """Reads the terminal side: every chunk with the time it arrived, and the whole stream for the screen text."""

    def __init__(self, fd):
        self.fd = fd
        self.chunks = []
        self.raw = []
        self.data = bytearray()
        self.lock = threading.Lock()
        self.done = False
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        while not self.done:
            ready, _, _ = select.select([self.fd], [], [], 0.1)
            if not ready:
                continue
            try:
                chunk = os.read(self.fd, 1 << 16)
            except OSError:
                return
            if not chunk:
                return
            # Answer the host's terminal queries as Ghostty does, in the order asked: it decides from the order of
            # the replies what the terminal can draw (a graphics reply after the device attributes means none).
            found = []
            for query, reply in ANSWERS:
                at = chunk.find(query)
                while at >= 0:
                    found.append((at, reply))
                    at = chunk.find(query, at + 1)
            for _, reply in sorted(found):
                os.write(self.fd, reply)
            with self.lock:
                self.chunks.append((time.perf_counter(), len(chunk)))
                self.raw.append((time.perf_counter(), chunk))
                self.data.extend(chunk)

    def text(self, since=0):
        with self.lock:
            raw = bytes(self.data[since:]).decode("utf-8", "replace")
        return re.sub(r"\s+", " ", ANSI.sub(" ", raw))

    def size(self):
        with self.lock:
            return len(self.data)

    def quiet_for(self, seconds, limit):
        """Waits until nothing has arrived for `seconds`, at most `limit` seconds."""
        end = time.perf_counter() + limit
        while time.perf_counter() < end:
            with self.lock:
                last = self.chunks[-1][0] if self.chunks else 0
            if time.perf_counter() - last >= seconds:
                return
            time.sleep(0.05)


def run_command(fd, rec, name, described_as):
    """Types a slash command and submits it only once the menu lists it with its description; else clears the line.
    Submitting an unknown one would send it to the model as a prompt."""
    # Twice: a session still starting may list its plugins' commands only after a while.
    for _ in range(2):
        mark = rec.size()
        for ch in name:
            os.write(fd, ch.encode())
            time.sleep(0.02)
        end = time.perf_counter() + 15
        while time.perf_counter() < end:
            if described_as in rec.text(mark):
                os.write(fd, b"\r")
                return True
            time.sleep(0.1)
        os.write(fd, b"\x15")
        time.sleep(1)
    return False


def cpu_seconds(pid):
    """CPU time used so far by the process and its children, from ps."""
    out = subprocess.run(
        ["ps", "-o", "time=", "-g", str(os.getpgid(pid))],
        capture_output=True,
        check=False,
        text=True,
    ).stdout
    total = 0.0
    for line in out.split():
        parts = line.split(":")
        total += sum(float(p) * 60**i for i, p in enumerate(reversed(parts)))
    return total


def pct(values, q):
    ordered = sorted(values)
    return ordered[max(0, int(-(-q * len(ordered) // 1)) - 1)] if ordered else 0


def bursts(chunks, start, end):
    """Frames as the terminal receives them: runs of output with no gap over BURST_GAP_MS, with their sizes."""
    out = []
    for t, n in chunks:
        if not start <= t <= end:
            continue
        if out and (t - out[-1][1]) * 1000 <= BURST_GAP_MS:
            out[-1][1] = t
            out[-1][2] += n
        else:
            out.append([t, t, n])
    return out


def stop(pid):
    """Ends the session and everything it started: its own process group, never pid 0 or 1 or ours."""
    try:
        group = os.getpgid(pid)
    except ProcessLookupError:
        return
    if not (pid > 1 and group > 1 and group != os.getpgrp()):
        return
    # The terminal is still being read meanwhile: a session blocked writing to a full terminal never gets to exit.
    for sig in (signal.SIGTERM, signal.SIGKILL):
        os.killpg(group, sig)
        for _ in range(50):
            if os.waitpid(pid, os.WNOHANG) != (0, 0):
                return
            time.sleep(0.1)
    print(f"the session (pid {pid}) did not exit; stop it by hand")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--columns", type=int, default=200)
    ap.add_argument("--rows", type=int, default=60)
    ap.add_argument("--seconds", type=float, default=8)
    ap.add_argument("--cwd", default=os.getcwd())
    ap.add_argument(
        "--screen", help="write the session's text here, for looking at what happened"
    )
    ap.add_argument(
        "--timeline",
        help="write each frame's arrival (ms after the bench started) and size here",
    )
    ap.add_argument(
        "--raw",
        help="write every chunk the terminal received here, each after a line: ms after the bench started, length",
    )
    args = ap.parse_args()

    pid, fd = spawn(args.columns, args.rows, args.cwd)
    rec = Recorder(fd)
    try:
        rec.quiet_for(2.0, 30)
        if "trust" in rec.text().lower():
            os.write(fd, b"\r")
            rec.quiet_for(2.0, 20)
        # The pane draws its strip once the mod has loaded; its commands are registered by then.
        end = time.perf_counter() + 30
        while "▀" not in rec.text() and time.perf_counter() < end:
            time.sleep(0.2)
        rec.quiet_for(2.0, 20)
        mark = rec.size()
        if not run_command(
            fd, rec, "/dungeon-bench", "Walk the hero a fixed long route"
        ):
            print(
                "/dungeon-bench never showed in the command menu; nothing was submitted"
            )
            if args.screen:
                with open(args.screen, "w") as f:
                    f.write(rec.text())
            return
        start = time.perf_counter()
        cpu0 = cpu_seconds(pid)
        time.sleep(args.seconds)
        end = time.perf_counter()
        cpu1 = cpu_seconds(pid)
        started = rec.text(mark)
        if not run_command(
            fd, rec, "/dungeon-frames", "How evenly the dungeon pane plays"
        ):
            print(
                "/dungeon-frames never showed in the command menu; nothing was submitted"
            )
            return
        rec.quiet_for(1.5, 10)
        report = re.search(
            r"\d+ ticks, .*?Whole-pane redraws: .*? ms\.", rec.text(mark)
        )
        if args.screen:
            with open(args.screen, "w") as f:
                f.write(rec.text())

        if args.raw:
            with open(args.raw, "wb") as f:
                for t, chunk in rec.raw:
                    f.write(f"{(t - start) * 1000:.1f} {len(chunk)}\n".encode())
                    f.write(chunk)
        # The walk lasts as many ticks as the mod reports, each the median gap apart.
        ticked = (
            re.match(
                r"(\d+) ticks, .*?Gap between ticks: p50 ([\d.]+)", report.group(0)
            )
            if report
            else None
        )
        walk_end = (
            start + int(ticked.group(1)) * float(ticked.group(2)) / 1000
            if ticked
            else end
        )
        frames = bursts(rec.chunks, start, min(end, walk_end))
        if args.timeline:
            with open(args.timeline, "w") as f:
                f.writelines(
                    f"{(a - start) * 1000:9.1f} {(b - a) * 1000:6.1f} {n}\n"
                    for a, b, n in frames
                )
        gaps = [(b[0] - a[0]) * 1000 for a, b in itertools.pairwise(frames)]
        sizes = [b[2] for b in frames]
        print(
            f"terminal {args.columns}x{args.rows}, {args.seconds:.0f} s of bench walk"
        )
        if "Bench walk started" not in started:
            print("the bench did not start; see --screen for what the session showed")
        ticks = f" for {ticked.group(1)} ticks" if ticked else ""
        print(
            f"frames reaching the terminal during the walk: {len(frames)}{ticks} ({len(frames) / max(0.001, min(end, walk_end) - start):.1f} a second)"
        )
        if gaps:
            late = sum(1 for g in gaps if g > FRAME_MS * 1.5)
            print(
                f"gap between frames: p50 {pct(gaps, 0.5):.1f}, p99 {pct(gaps, 0.99):.1f}, max {max(gaps):.1f} ms; {late} over {FRAME_MS * 1.5:.1f} ms"
            )
            print(
                f"bytes a frame: p50 {pct(sizes, 0.5)}, p99 {pct(sizes, 0.99)}, max {max(sizes)}; {sum(sizes) / max(0.001, min(end, walk_end) - start) / 1024:.0f} KiB a second"
            )
        print(
            f"CPU: {100 * (cpu1 - cpu0) / (end - start):.0f}% of one core over the walk"
        )
        print(f"mod's own report: {report.group(0) if report else 'not found'}")
    finally:
        stop(pid)
        rec.done = True
        os.close(fd)


if __name__ == "__main__":
    main()
