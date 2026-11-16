"""Satchel notification sounds, synthesised from scratch (original audio, CC0).

Writes 16-bit PCM mono 44.1 kHz .wav files into apps/satchel/assets/sounds/:

  satchel_chime.wav    soft bell chime: upcoming activities and plans
  satchel_depart.wav   bright rising three-note marimba: flight / train / ferry / bus departures
  satchel_checkin.wav  warm two-note vibraphone: hotel check-in / check-out and car pick-up

Every note is additive synthesis: a few inharmonic partials (bell / bar ratios), each with its own exponential
decay, a soft raised-cosine attack, a short room reverb, then a gentle fade so the tail ends at true silence
(no click). Peaks are normalised to about -6 dBFS. iOS plays notification sounds under 30 s; these are 1-2 s.

Run from anywhere (only numpy needed):  python apps/satchel/tools/sounds/make_sounds.py
The output is deterministic, so re-running gives byte-identical files.
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

RATE = 44_100
PEAK_DBFS = -6.0
OUT = Path(__file__).resolve().parents[2] / "assets" / "sounds"


# ---------------------------------------------------------------- building blocks

def note(freq: float, dur: float, partials: list[tuple[float, float, float]], attack: float = 0.006) -> np.ndarray:
    """One struck note. partials: (frequency ratio, relative amplitude, decay time constant in s)."""
    t = np.arange(int(dur * RATE)) / RATE
    out = np.zeros_like(t)
    for ratio, amp, tau in partials:
        f = freq * ratio
        if f >= RATE / 2 * 0.9:  # keep well under Nyquist
            continue
        out += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    # Soft raised-cosine attack: no click, still reads as a strike.
    n = max(1, int(attack * RATE))
    out[:n] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / n)
    return out


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * RATE)
    j = min(len(buf), i + len(sig))
    buf[i:j] += gain * sig[: j - i]


def comb(x: np.ndarray, delay: int, g: float, damp: float) -> np.ndarray:
    """Feedback comb with a one-pole low-pass in the loop (Freeverb style), vectorised in blocks of `delay`."""
    y = np.zeros(len(x))
    prev_block = np.zeros(delay)
    lp = 0.0
    for start in range(0, len(x), delay):
        end = min(start + delay, len(x))
        fb = prev_block[: end - start]
        # Low-pass the fed-back block (cheap per-block approximation of the in-loop filter).
        smoothed = np.empty_like(fb)
        for k in range(len(fb)):
            lp = (1 - damp) * fb[k] + damp * lp
            smoothed[k] = lp
        y[start:end] = x[start:end] + g * smoothed
        prev_block = np.zeros(delay)
        prev_block[: end - start] = y[start:end]
    return y


def allpass(x: np.ndarray, delay: int, g: float = 0.5) -> np.ndarray:
    y = np.zeros(len(x))
    xd = np.concatenate([np.zeros(delay), x])[: len(x)]
    for start in range(0, len(x), delay):
        end = min(start + delay, len(x))
        yd = y[start - delay : end - delay] if start >= delay else np.zeros(end - start)
        y[start:end] = -g * x[start:end] + xd[start:end] + g * yd
    return y


def reverb(x: np.ndarray, mix: float = 0.16, size: float = 0.82) -> np.ndarray:
    """A small, soft room (Schroeder / Freeverb topology, tuned short so the sound stays clear)."""
    combs = [1116, 1188, 1277, 1356]
    wet = sum(comb(x, d, size, 0.3) for d in combs) / len(combs)
    for d in (556, 441, 341):
        wet = allpass(wet, d)
    return (1 - mix) * x + mix * wet


def finish(x: np.ndarray, fade: float = 0.25) -> np.ndarray:
    """Remove DC, fade the last `fade` s to exact zero, normalise the peak to PEAK_DBFS."""
    x = x - np.mean(x)
    n = int(fade * RATE)
    x[-n:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(n) / n)
    x[0] = 0.0
    x[-1] = 0.0
    peak = np.max(np.abs(x))
    return x * (10 ** (PEAK_DBFS / 20) / peak)


def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = np.round(np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- timbres

# Small handbell: slightly stretched, inharmonic partials; upper ones die away first.
BELL = [(1.0, 1.0, 0.55), (2.01, 0.42, 0.32), (2.76, 0.26, 0.22), (4.07, 0.12, 0.13), (5.43, 0.06, 0.08), (0.5, 0.10, 0.70)]
# Marimba bar: strong fundamental, the bar's 4x and ~10x modes, very quick upper decay. Bright but woody.
MARIMBA = [(1.0, 1.0, 0.30), (3.93, 0.32, 0.07), (9.2, 0.10, 0.025), (2.0, 0.08, 0.12)]
# Vibraphone-ish: warm, rounder, longer sustain with a soft 4x overtone and a hint of the octave.
VIBE = [(1.0, 1.0, 0.75), (4.0, 0.18, 0.16), (2.0, 0.12, 0.35), (10.0, 0.03, 0.03)]


def chime() -> np.ndarray:
    dur = 1.7
    buf = np.zeros(int(dur * RATE))
    place(buf, note(1046.5, 1.5, BELL, attack=0.008), 0.0)          # C6
    place(buf, note(1568.0, 1.3, BELL, attack=0.008), 0.16, 0.45)   # G6, a soft answering strike
    return finish(reverb(buf, mix=0.18), fade=0.35)


def depart() -> np.ndarray:
    dur = 1.3
    buf = np.zeros(int(dur * RATE))
    for i, (f, g) in enumerate([(783.99, 0.85), (987.77, 0.9), (1174.66, 1.0)]):  # G5 B5 D6, rising major triad
        place(buf, note(f, 1.0, MARIMBA, attack=0.004), i * 0.11, g)
    place(buf, note(2349.3, 0.8, BELL, attack=0.006), 0.22, 0.12)   # a little sparkle on the top note
    return finish(reverb(buf, mix=0.14), fade=0.3)


def checkin() -> np.ndarray:
    dur = 1.6
    buf = np.zeros(int(dur * RATE))
    t = np.arange(len(buf)) / RATE
    place(buf, note(587.33, 1.4, VIBE, attack=0.010), 0.0, 0.9)   # D5
    place(buf, note(739.99, 1.3, VIBE, attack=0.010), 0.20)       # F#5: a warm major third up
    buf *= 1 + 0.06 * np.sin(2 * np.pi * 5.2 * t)                  # gentle vibraphone tremolo
    return finish(reverb(buf, mix=0.2), fade=0.4)


SOUNDS = {"satchel_chime.wav": chime, "satchel_depart.wav": depart, "satchel_checkin.wav": checkin}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        x = make()
        write_wav(OUT / name, x)
        peak = 20 * np.log10(np.max(np.abs(x)))
        print(f"{name}: {len(x) / RATE:.2f} s, peak {peak:.1f} dBFS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
