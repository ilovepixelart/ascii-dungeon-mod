"""The gallery page: every window as a real Claude Code painted it, grouped by window, the PNGs written in."""

import base64
import html
import os

FAMILY = [
    ("start", "Start"),
    ("map", "Map and strip"),
    ("inventory", "Bag"),
    ("compact", "Compact bag (narrow pane)"),
    ("sheet", "Hero sheet"),
    ("talent", "Talents"),
    ("deep", "Deep"),
    ("codex", "Codex"),
    ("retire", "Retire"),
    ("shop", "Merchant"),
    ("forge", "Smith"),
    ("chest", "Stash"),
    ("talk", "Town folk"),
    ("settings", "Settings"),
    ("help", "Help"),
    ("log", "Log"),
    ("death", "Death"),
    ("recap", "Recap"),
]


def inline(path):
    """A PNG as base64, to write into the page."""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def write(shots, dest, commit, version):
    """The page for the PNGs in `shots`, shot from `commit` by Claude Code `version`, written to `dest`."""
    names = sorted(f[:-4] for f in os.listdir(shots) if f.endswith(".png"))
    sections = []
    for key, title in FAMILY:
        mine = [n for n in names if n == key or n.startswith(key + "-")]
        if not mine:
            continue
        cells = "".join(
            f'<figure><div class="shot"><img loading="lazy" src="data:image/png;base64,'
            f'{inline(os.path.join(shots, n + ".png"))}" alt="{html.escape(n)}"></div>'
            f"<figcaption>{html.escape(n)}</figcaption></figure>"
            for n in mine
        )
        sections.append(
            f'<section id="{key}"><h2>{html.escape(title)} <span>{len(mine)}</span></h2><div class="grid">{cells}</div></section>'
        )
    nav = "".join(
        f'<a href="#{k}">{html.escape(t.split(" (")[0])}</a>'
        for k, t in FAMILY
        if any(n == k or n.startswith(k + "-") for n in names)
    )
    page = f"""<title>Dungeon Window Gallery</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root {{
  --bg: #1f2228; --panel: #282c34; --line: #3a3f4a; --fg: #e6e6e6; --dim: #9aa1ad; --gold: #ffd34d;
  --mono: "JetBrains Mono", ui-monospace, monospace;
  color-scheme: dark;
}}
body {{ margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 var(--mono); padding: 32px max(16px, env(safe-area-inset-right, 0px)) 64px max(16px, env(safe-area-inset-left, 0px)); }}
main {{ max-width: 1400px; margin: 0 auto; }}
h1 {{ font-size: clamp(24px, 4vw, 34px); line-height: 1.15; margin: 0 0 10px; color: var(--gold); }}
.lede {{ color: var(--dim); max-width: 80ch; margin: 0 0 18px; }}
.lede b {{ color: var(--fg); font-weight: 700; }}
nav {{ display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 8px; position: sticky; top: 0; background: var(--bg); padding: 10px 0; border-bottom: 1px solid var(--line); z-index: 1; }}
nav a {{ color: var(--dim); text-decoration: none; font-size: 13px; }}
nav a:hover {{ color: var(--gold); }}
section {{ scroll-margin-top: 56px; }}
h2 {{ font-size: 18px; margin: 30px 0 12px; }}
h2 span {{ color: var(--dim); font-size: 13px; font-weight: 400; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 18px; }}
figure {{ margin: 0; }}
.shot {{ background: var(--panel); border: 1px solid var(--line); }}
.shot img {{ display: block; width: 100%; height: auto; }}
figcaption {{ font-size: 12px; color: var(--dim); margin-top: 6px; overflow-wrap: anywhere; }}
</style>
<main>
<h1>Every window, as the terminal draws it</h1>
<p class="lede">Each picture is a <b>real frame</b>: Claude Code {html.escape(version)} running the mod at <b>{html.escape(commit)}</b> in a terminal, each window opened from a saved game, its cells captured as the engine painted them, then drawn cell for cell in JetBrains Mono on Ghostty's default background. Nothing here is a mock-up. A preview tool's pixel font no longer appears.</p>
<nav>{nav}</nav>
{"".join(sections)}
</main>
"""
    with open(dest, "w", encoding="utf-8") as f:
        f.write(page)
