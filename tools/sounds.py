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


SOUNDS = {
    "hit": tone(320, 180, 70, "noise", 0.3) + tone(220, 160, 50, "square", 0.2),
    "crit": tone(660, 440, 60, "square") + tone(880, 520, 90, "square"),
    "kill": tone(440, 660, 70, "square") + tone(660, 990, 120, "square"),
    "hurt": tone(200, 90, 140, "square", 0.3),
    "coin": tone(988, 988, 50, "square", 0.25) + tone(1319, 1319, 120, "square", 0.25),
    "chest": tone(392, 392, 60, "triangle", 0.4) + tone(523, 523, 60, "triangle", 0.4) + tone(784, 784, 160, "triangle", 0.4),
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
