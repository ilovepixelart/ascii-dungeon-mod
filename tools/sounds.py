"""Builds the game's sound effects (short 8-bit blips) and the town's looping tune, as 22 kHz mono 16-bit WAV files
into sounds/.

Usage: python3 tools/sounds.py
"""

import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sounds")


def tone(freq_from, freq_to, ms, wave_kind="square", volume=0.35):
    """One note sliding from freq_from to freq_to over ms, with a quick attack and a fading tail."""
    n = int(RATE * ms / 1000)
    phase = 0.0
    out = []
    for i in range(n):
        t = i / n
        freq = freq_from + (freq_to - freq_from) * t
        phase += freq / RATE
        cycle = phase % 1.0
        if wave_kind == "square":
            v = 1.0 if cycle < 0.5 else -1.0
        elif wave_kind == "triangle":
            v = 4 * abs(cycle - 0.5) - 1
        else:
            # Noise, seeded by the sample so every build writes the same bytes.
            v = math.sin(i * 12.9898 + 78.233) * 43758.5453 % 2 - 1
        envelope = min(1.0, i / (RATE * 0.004)) * (1 - t) ** 1.5
        out.append(v * envelope * volume)
    return out


def write(name, samples):
    with wave.open(os.path.join(OUT, f"{name}.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))


def over(*parts):
    """Parts sounding at once, summed."""
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0.0 for p in parts) for i in range(n)]


def gap(ms):
    """Silence between parts."""
    return [0.0] * int(RATE * ms / 1000)


SOUNDS = {
    "hit": tone(320, 180, 70, "noise", 0.3) + tone(220, 160, 50, "square", 0.2),
    "crit": tone(660, 440, 60, "square") + tone(880, 520, 90, "square"),
    # A foe dying: a growl falling away under a crumble of noise.
    "kill": over(tone(260, 70, 300, "square", 0.24), tone(0, 0, 220, "noise", 0.16)),
    "hurt": tone(200, 90, 140, "square", 0.3),
    "coin": tone(988, 988, 50, "square", 0.25) + tone(1319, 1319, 120, "square", 0.25),
    # A chest: a low creak, the latch, then a chime.
    "chest": over(tone(110, 150, 140, "square", 0.10), tone(0, 0, 140, "noise", 0.05)) + tone(0, 0, 18, "noise", 0.30) + gap(20)
    + tone(392, 392, 60, "triangle", 0.4) + tone(523, 523, 60, "triangle", 0.4) + tone(784, 784, 160, "triangle", 0.4),
    # Up and down through the portal: a shimmering sweep.
    "portal": tone(260, 1040, 260, "triangle", 0.35) + tone(1040, 520, 200, "triangle", 0.25),
    # Footsteps, two so a walk alternates them: a soft thud of noise, the second a little lower.
    "step1": tone(140, 90, 45, "noise", 0.12),
    "step2": tone(120, 80, 45, "noise", 0.12),
    "level": tone(523, 523, 80, "square", 0.3) + tone(659, 659, 80, "square", 0.3) + tone(784, 784, 80, "square", 0.3) + tone(1047, 1047, 220, "square", 0.3),
    # A Rare or better: a quick climb of bright triangle notes, ringing at the top.
    "loot": tone(784, 784, 50, "triangle", 0.35) + tone(988, 988, 50, "triangle", 0.35) + tone(1175, 1175, 50, "triangle", 0.35) + tone(1568, 1568, 260, "triangle", 0.3),
    # The nemesis found you: two low notes falling a semitone, the second held.
    "nemesis": tone(147, 147, 180, "square", 0.3) + tone(139, 130, 420, "square", 0.3),
    # Something strong is near: a low rumble of noise swelling under a slow low note.
    "peak": [a + b for a, b in zip(tone(70, 110, 500, "noise", 0.18), tone(98, 104, 500, "square", 0.14))],
    # The dungeon falls quiet: a soft chime stepping down.
    "calm": tone(880, 880, 90, "triangle", 0.22) + tone(659, 659, 90, "triangle", 0.2) + tone(523, 523, 240, "triangle", 0.18),
    # A falling minor phrase, slow at its end: the hero slain.
    "death": tone(392, 370, 200, "square", 0.28) + tone(330, 311, 200, "square", 0.28) + tone(262, 196, 520, "triangle", 0.3),
    # Four steps down the stairs, each a little lower.
    "descend": tone(523, 494, 70, "triangle", 0.3) + tone(440, 415, 70, "triangle", 0.3) + tone(349, 330, 70, "triangle", 0.3) + tone(262, 196, 200, "triangle", 0.3),
    # A low rumble under a held growl: a guardian rises.
    "boss": [a + b for a, b in zip(tone(60, 90, 640, "noise", 0.16), tone(82, 73, 640, "square", 0.26))],
    # A short fanfare: a quest done.
    "quest": tone(659, 659, 70, "square", 0.26) + tone(784, 784, 70, "square", 0.26) + tone(1047, 1047, 220, "square", 0.24),
    # Bubbles rising: a potion drunk, the spring.
    "drink": tone(400, 700, 45, "triangle", 0.3) + tone(500, 820, 45, "triangle", 0.3) + tone(450, 950, 90, "triangle", 0.28),
    # Paper torn, then a shimmer: a scroll read.
    "scroll": tone(1800, 900, 90, "noise", 0.14) + tone(880, 1320, 200, "triangle", 0.24),
    # A snap and a thud: a trap.
    "trap": tone(1500, 300, 40, "noise", 0.36) + tone(180, 110, 100, "square", 0.28),
    # A struck anvil ringing out: the smith at work.
    "anvil": tone(1760, 1720, 35, "square", 0.24) + tone(1760, 1320, 260, "triangle", 0.24),
    # Coins counted out: something bought.
    "buy": tone(1175, 1175, 40, "square", 0.2) + tone(1568, 1568, 40, "square", 0.2) + tone(2093, 2093, 130, "square", 0.18),
    # A clink of buckles: gear put on.
    "equip": tone(500, 300, 40, "noise", 0.18) + tone(587, 587, 50, "square", 0.18) + tone(784, 784, 90, "square", 0.16),
    # A sting of two close notes: a foe out of the dark.
    "foe": tone(220, 233, 90, "square", 0.22) + tone(208, 196, 170, "square", 0.22),
    # Things picked up, each its form: a potion's glass clink, a herb's rustle, a scroll's paper, a rune's stone ring,
    # a bomb's dull clack, gear's metal clink.
    "potionUp": tone(1568, 1568, 35, "triangle", 0.30) + tone(2093, 2093, 140, "triangle", 0.24),
    "herbUp": over(tone(0, 0, 90, "noise", 0.07), tone(660, 880, 110, "triangle", 0.20)),
    "scrollUp": tone(0, 0, 50, "noise", 0.12) + tone(0, 0, 60, "noise", 0.09) + tone(880, 1175, 120, "triangle", 0.18),
    "runeUp": tone(300, 250, 30, "square", 0.20) + tone(1175, 1175, 180, "triangle", 0.20),
    "bombUp": over(tone(0, 0, 50, "noise", 0.22), tone(170, 120, 70, "square", 0.20)),
    "gearUp": tone(1047, 1047, 30, "square", 0.16) + tone(1568, 1568, 90, "triangle", 0.18),
    # A blow turned: a clang of metal.
    "block": over(tone(0, 0, 25, "noise", 0.20), tone(1400, 1300, 200, "triangle", 0.22), tone(700, 650, 120, "square", 0.08)),
    # A blow that finds nothing: a swish of air.
    "whiff": over(tone(0, 0, 140, "noise", 0.12), tone(300, 600, 140, "triangle", 0.05)),
    # A heavy blow coming next turn: a warning rising.
    "windup": over(tone(220, 440, 260, "square", 0.14), tone(440, 880, 260, "triangle", 0.10)),
    # A foe mending: dark bubbles.
    "foeHeal": tone(200, 320, 60, "triangle", 0.22) + tone(180, 300, 60, "triangle", 0.22) + tone(220, 360, 90, "triangle", 0.20),
    # A big boss enraged: a long roar.
    "rage": over(tone(90, 60, 600, "square", 0.22), tone(0, 0, 600, "noise", 0.14), tone(130, 90, 600, "square", 0.10)),
    # Gold snatched: a coin's chime falling away.
    "steal": tone(1319, 988, 40, "square", 0.20) + tone(988, 659, 80, "square", 0.20),
    # A big boss destroyed: a long growl under a burst, then a sparkle.
    "bossDeath": over(tone(200, 40, 900, "square", 0.22), tone(0, 0, 700, "noise", 0.18)) + tone(1568, 2093, 200, "triangle", 0.15),
    # Gold counted out: something sold, the buy's notes falling.
    "sell": tone(2093, 2093, 40, "square", 0.16) + tone(1568, 1568, 40, "square", 0.16) + tone(1175, 1175, 120, "square", 0.15),
    # Gear taken off: the equip's clink, its notes falling.
    "unequip": tone(300, 500, 40, "noise", 0.16) + tone(784, 784, 50, "square", 0.16) + tone(587, 587, 90, "square", 0.14),
    # An item destroyed: a crunch.
    "destroy": over(tone(0, 0, 120, "noise", 0.25), tone(120, 60, 120, "square", 0.18)),
    # The stash's lid: a thud.
    "stash": tone(140, 90, 70, "square", 0.22) + tone(0, 0, 40, "noise", 0.12),
    # A mark set on an item (locked, junk): a soft tick.
    "tick": tone(1760, 1760, 15, "square", 0.12),
    # What cannot be done: a soft low buzz, twice.
    "deny": tone(196, 185, 90, "square", 0.14) + gap(30) + tone(185, 175, 120, "square", 0.14),
    # A point trained: a small chime.
    "train": tone(659, 659, 60, "triangle", 0.24) + tone(988, 988, 160, "triangle", 0.24),
    # Wounds mended: a warm swell up three notes.
    "heal": tone(523, 523, 120, "triangle", 0.18) + tone(659, 659, 120, "triangle", 0.20) + tone(784, 784, 260, "triangle", 0.18),
    # The dog: a little yip, twice.
    "bark": tone(900, 1300, 50, "square", 0.18) + gap(40) + tone(1000, 1400, 60, "square", 0.16),
    # A fortune read: a shimmer.
    "fortune": tone(1047, 1568, 120, "triangle", 0.18) + tone(1568, 1319, 120, "triangle", 0.16) + tone(1760, 1760, 220, "triangle", 0.14),
    # A quest given: a two-note call.
    "questNew": tone(523, 523, 90, "triangle", 0.24) + tone(784, 784, 200, "triangle", 0.24),
    # A depth's twist: an ominous low tone.
    "twist": over(tone(98, 92, 520, "square", 0.18), tone(147, 139, 520, "triangle", 0.12)),
    # Walking into a wall: a dull thud.
    "bump": tone(90, 60, 60, "square", 0.20) + tone(0, 0, 30, "noise", 0.08),
}

# The town's tune, a chill one: 8 bars of 4/4 at 76 beats a minute, long notes of the C pentatonic over major-seventh
# chords, a rounded lead with a slow vibrato, a soft bass and a quiet arpeggio.
BEAT = 60 / 76
NOTE = {"C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.0, "A3": 220.0, "B3": 246.94,
        "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.0, "A4": 440.0, "B4": 493.88,
        "C5": 523.25, "D5": 587.33, "E5": 659.25, "G5": 783.99}
# The lead, (note, beats); "-" a rest.
LEAD = [
    ("E4", 1.5), ("G4", 0.5), ("A4", 2),
    ("G4", 1), ("E4", 1), ("D4", 2),
    ("C4", 1.5), ("D4", 0.5), ("E4", 1), ("G4", 1),
    ("A4", 3), ("-", 1),
    ("C5", 1.5), ("A4", 0.5), ("G4", 2),
    ("E4", 1), ("G4", 1), ("A4", 2),
    ("G4", 1.5), ("E4", 0.5), ("D4", 1), ("E4", 1),
    ("C4", 3), ("-", 1),
]
# A chord a bar: its root for the bass, its notes for the arpeggio.
CHORDS = [("C3", "C4 E4 G4 B4"), ("A3", "A3 C4 E4 G4"), ("F3", "F3 A3 C4 E4"), ("G3", "G3 B3 D4 E4"),
          ("C3", "C4 E4 G4 B4"), ("A3", "A3 C4 E4 G4"), ("F3", "F3 A3 C4 E4"), ("G3", "G3 B3 D4 E4")]


def voice(n_samples, notes, render):
    out = [0.0] * n_samples
    at = 0.0
    for name, beats in notes:
        length = beats * BEAT
        if name != "-":
            part = render(NOTE[name], length)
            start = int(at * RATE)
            for i, v in enumerate(part[: n_samples - start]):
                out[start + i] += v
        at += length
    return out


def soft(freq, seconds, kind, volume, decay=2.0, vibrato=0.0):
    """A held note with a soft attack and an exponential fall, so notes never click; `vibrato` is its depth in hertz."""
    n = int(RATE * seconds)
    phase = 0.0
    out = []
    for i in range(n):
        phase += (freq + vibrato * math.sin(2 * math.pi * 5 * i / RATE)) / RATE
        c = phase % 1.0
        v = (1.0 if c < 0.25 else -1.0) * 0.6 if kind == "pulse" else 4 * abs(c - 0.5) - 1
        attack = min(1.0, i / (RATE * 0.04))
        release = min(1.0, (n - i) / (RATE * 0.02))
        out.append(v * volume * attack * release * math.exp(-decay * i / RATE))
    return out


def town_tune():
    bars = len(CHORDS)
    n = int(RATE * bars * 4 * BEAT)
    lead = voice(n, LEAD, lambda f, s: soft(f, s, "triangle", 0.22, 0.6, vibrato=2.0))
    bass = voice(n, [(root, 2) for root, _ in CHORDS for _ in range(2)], lambda f, s: soft(f, s * 0.95, "triangle", 0.18, 1.2))
    arp = voice(n, [(note, 0.5) for _, chord in CHORDS for _ in range(2) for note in chord.split()], lambda f, s: soft(f, s * 0.9, "triangle", 0.05, 3.0))
    return [a + b + c for a, b, c in zip(lead, bass, arp)]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, samples in SOUNDS.items():
        write(name, samples)
        print(f"{name}.wav: {len(samples) * 1000 // RATE} ms")
    tune = town_tune()
    write("town", tune)
    print(f"town.wav: {len(tune) * 1000 // RATE} ms, a loop")
    # Each effect's length, for the effects channel to know when one has finished.
    # Each effect's length, for the effects channel to know when one has finished, and every clip's peak, for the mix.
    lengths = "".join(f"  {name}: {math.ceil(len(samples) * 1000 / RATE)},\n" for name, samples in SOUNDS.items())
    peaks = "".join(f"  {name}: {max(abs(v) for v in samples):.3f},\n" for name, samples in [*SOUNDS.items(), ("town", tune)])
    with open(os.path.join(os.path.dirname(OUT), "hooks", "clips.ts"), "w") as f:
        f.write("// Written by tools/sounds.py with the clips in sounds/: run it again after changing a sound.\n")
        f.write("/** Each effect's length in milliseconds. */\n")
        f.write(f"export const CLIP_MS = {{\n{lengths}}} as const\n")
        f.write("/** Each clip's loudest sample, from 0 to 1. */\n")
        f.write(f"export const CLIP_PEAK = {{\n{peaks}}} as const\n")
        f.write("/** The town's tune, one round, in milliseconds: the pane starts each round itself, on time. */\n")
        f.write(f"export const TUNE_MS = {round(len(tune) * 1000 / RATE)}\n")
