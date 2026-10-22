"""Every window as a real Claude Code session draws it, not a preview. For each scene of scenes.ts: seed a copy of the
mod's save with the scene's game, start `claude` on the copy in a private tmux, give the pane the keyboard (ctrl+x
tab), press the scene's keys or click its text, wait for the frame to settle, and capture the cells. Then each capture
is painted cell for cell as Ghostty shows it (picture.py) and gallery.html shows them all.

The copy is the mod renamed ascii-dungeon-shots, so it keeps a save of its own and the player's game is never touched.
A folder Claude Code has not been trusted in stops at its trust question: run from one it has (--cwd).

Usage: uv run --with pillow python tools/shots/shoot.py <out-dir> [--cwd DIR] [name prefix...]
"""

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cells
import page
import picture

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
NAME = "ascii-dungeon"
COPY = "ascii-dungeon-shots"
SOCKET = "shots"
STORES = os.path.expanduser("~/.claude/plugins/store")
# The three places the plugin's name is its save's key: the manifest, the state contract, and the store calls.
RENAMES = [
    (".claude-plugin/plugin.json", f'"name": "{NAME}"', f'"name": "{COPY}"'),
    ("types/index.d.ts", f"'{NAME}': {{ game: Game }}", f"'{COPY}': {{ game: Game }}"),
    (
        "hooks/register.tsx",
        f"plugin: '{NAME}', key: 'game'",
        f"plugin: '{COPY}', key: 'game'",
    ),
]
CLOSE = "✕"


def tmux(*args, check=True):
    return subprocess.run(
        ["tmux", "-L", SOCKET, *args], capture_output=True, text=True, check=check
    ).stdout


def screen(escapes=False):
    """The pane's text, with its escapes when asked; -N keeps a row's trailing cells, a window's ground among them."""
    return tmux(
        "capture-pane", "-p", "-N", *(["-e"] if escapes else []), "-t", "s", check=False
    )


def settle(marker, timeout=40.0):
    """Wait for the marker on screen, then for two captures in a row to agree (or a few tries, for a moving map)."""
    end = time.time() + timeout
    while marker not in screen():
        if time.time() > end:
            return False
        time.sleep(0.4)
    last = None
    for _ in range(8):
        time.sleep(0.6)
        now = screen(True)
        if now == last:
            break
        last = now
    return True


def copy_mod(dest):
    """The mod copied to dest, renamed: each rename must find its text exactly once, or the copy would share the save."""
    shutil.rmtree(dest, ignore_errors=True)
    skip = shutil.ignore_patterns(
        ".git", "node_modules", "types", "*.test.ts", "tools", "docs"
    )
    shutil.copytree(
        REPO,
        dest,
        ignore=lambda d, names: (
            set(skip(d, names)) - ({"types"} if d == REPO else set())
        ),
    )
    for path, old, new in RENAMES:
        full = os.path.join(dest, path)
        with open(full, encoding="utf-8") as f:
            text = f.read()
        if text.count(old) != 1:
            raise SystemExit(
                f"{path}: expected {old!r} once, found it {text.count(old)} times"
            )
        with open(full, "w", encoding="utf-8") as f:
            f.write(text.replace(old, new))


def start(mod, cwd, cols):
    tmux("kill-server", check=False)
    env = "env COLORTERM=truecolor CLAUDE_CODE_TMUX_TRUECOLOR=1"
    tmux(
        "-f",
        os.path.join(HERE, "tmux.conf"),
        "new-session",
        "-d",
        "-s",
        "s",
        "-x",
        str(cols),
        "-y",
        "75",
        "-c",
        cwd,
        f"{env} claude --plugin-dir {mod}",
    )


def store_file(mod, cwd):
    """The copy's store: the engine names it, so start the copy once and take the newest of its name."""
    start(mod, cwd, 280)
    try:
        if not settle(CLOSE):
            raise SystemExit(
                f"the copy's pane never opened; is {cwd} a folder Claude Code trusts?"
            )
    finally:
        tmux("kill-server", check=False)
    found = sorted(
        glob.glob(os.path.join(STORES, f"{COPY}_*.json")), key=os.path.getmtime
    )
    if not found:
        raise SystemExit(f"no store for {COPY} in {STORES}")
    return found[-1]


def click(text):
    """A real left click at the first place on screen showing text, as the player would click it."""
    lines = screen().split("\n")
    row = next((i for i, line in enumerate(lines) if text in line), None)
    if row is None:
        return False
    col = lines[row].index(text) + 1
    for end in ("M", "m"):
        tmux("send-keys", "-t", "s", "-l", f"\x1b[<0;{col + 1};{row + 1}{end}")
    time.sleep(1.2)
    settle(CLOSE, 10)
    return True


def shoot(scene, mod, cwd, store, out):
    """One scene captured to out/<name>.ans and painted to out/<name>.png; what went wrong, or 'ok'."""
    with open(store, "w", encoding="utf-8") as f:
        json.dump(
            {
                "save": scene["game"],
                "sound": {"effects": False, "music": False, "volume": 4},
            },
            f,
        )
    start(mod, cwd, scene.get("cols", 280))
    if not settle(CLOSE):
        return "no pane"
    if scene.get("keys"):
        for key in ("C-x", "Tab"):
            tmux("send-keys", "-t", "s", key)
        time.sleep(0.8)
        for k in scene["keys"]:
            tmux("send-keys", "-t", "s", "-l", k)
            time.sleep(0.8)
        settle(CLOSE, 10)
    if scene.get("click") and not click(scene["click"]):
        return "no " + scene["click"]
    captured = screen(True)
    with open(os.path.join(out, scene["name"] + ".ans"), "w", encoding="utf-8") as f:
        f.write(captured)
    picture.render(cells.crop_pane(cells.parse(captured))).save(
        os.path.join(out, scene["name"] + ".png")
    )
    return "ok"


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("out")
    parser.add_argument(
        "--cwd",
        default=os.getcwd(),
        help="the folder Claude Code starts in; it must be trusted",
    )
    parser.add_argument(
        "prefixes", nargs="*", help="shoot only the scenes whose names start with one"
    )
    args = parser.parse_args()
    out = os.path.abspath(args.out)
    shots = os.path.join(out, "shots")
    os.makedirs(shots, exist_ok=True)
    # Read before copying, so the page names the commit the frames are of.
    commit = subprocess.run(
        ["git", "-C", REPO, "rev-parse", "--short", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    version = subprocess.run(
        ["claude", "--version"], capture_output=True, text=True, check=True
    ).stdout.split()[0]
    mod = os.path.join(out, COPY)
    copy_mod(mod)
    scenes_file = os.path.join(out, "scenes.json")
    subprocess.run(
        ["bun", os.path.join(HERE, "scenes.ts"), scenes_file],
        cwd=REPO,
        check=True,
        stdout=subprocess.DEVNULL,
    )
    with open(scenes_file, encoding="utf-8") as f:
        scenes = [
            s
            for s in json.load(f)
            if not args.prefixes or any(s["name"].startswith(p) for p in args.prefixes)
        ]
    store = store_file(mod, args.cwd)
    failed = []
    try:
        for s in scenes:
            result = shoot(s, mod, args.cwd, store, shots)
            print(s["name"], result, flush=True)
            if result != "ok":
                failed.append(s["name"])
    finally:
        tmux("kill-server", check=False)
    page.write(shots, os.path.join(out, "gallery.html"), commit, version)
    print(os.path.join(out, "gallery.html"))
    if failed:
        raise SystemExit(f"{len(failed)} scenes not shot: {', '.join(failed)}")


if __name__ == "__main__":
    main()
