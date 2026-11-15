"""Invented extra plans for the store capture of "Paste it here", in Satchel's copy-in format, dated inside the
seeded trip (seed.py: day 0 is yesterday unless --start is given). Prints the text for `xcrun simctl pbcopy`."""
import argparse
import datetime as dt

ap = argparse.ArgumentParser()
ap.add_argument('--start')
a = ap.parse_args()
start = dt.date.fromisoformat(a.start) if a.start else dt.date.today() - dt.timedelta(days=1)
day = lambda n: (start + dt.timedelta(days=n)).strftime('%a %-d %b')
print('\n'.join([
    f'{day(1)} · 18:30 · Food: Ramen dinner in Shinjuku · Omoide Yokocho',
    f'{day(2)} · 10:00–12:00 · Tour: Yanaka old town walk · Nippori Station',
    f'{day(3)} · 13:00–16:00 · Free time: Akihabara and Kanda · Akihabara Station',
    f'{day(5)} · 18:00 · Food: Kaiseki dinner in Pontocho · Pontocho · PT-5521',
    f'{day(6)} · 15:00–17:00 · Tour: Nishiki Market tasting · Nishiki Market',
]))
