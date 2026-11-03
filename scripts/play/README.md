# Cue Play validation and listing capture

Codex maintains these helpers for APPS / Cue Android simulation and release.
The cue-play-validation workflow builds an isolated APK or reuses one only
after checking unchanged app source. Default mode validates real 4 KB / 16 KB
guests, persistence, trial, permission recovery, video metadata and Cue runtime
health. Optional store_captures mode uses one Pixel 2 profile for presentation
screenshots; it does not replace the functional validation. Original failures
and current receipts are archived under Apps/outputs/cue-google-play-20261104.
