# Satchel notification sounds

Original audio, made for Satchel. No samples, loops or recordings from anywhere else: every file here is
synthesised from scratch by `tools/sounds/make_sounds.py` (additive bell, marimba and vibraphone-like partials with
exponential decays and a small room reverb). Own work, released under CC0 1.0 (public domain dedication).

| File | Sound | Used for |
| --- | --- | --- |
| `satchel_chime.wav` | soft bell chime, two gentle strikes | activities and other plans |
| `satchel_depart.wav` | bright rising three-note marimba | flight, train, ferry and bus departures |
| `satchel_checkin.wav` | warm two-note vibraphone | hotel check-in and check-out, car pick-up |

Format: 16-bit PCM, mono, 44.1 kHz WAV, 1.3 to 1.7 s, peaks at about -6 dBFS, soft attack, tails faded to silence
(iOS plays custom notification sounds up to 30 s).

To change them, edit the script and run `python tools/sounds/make_sounds.py` from `apps/satchel` (numpy only).
The files are bundled by the `expo-notifications` plugin `sounds` list in `app.json`; a new native build is needed
for changed sounds to reach the phone.
