# Archived SDK microphone experiment — 4 November 2026

Codex tested Google's authenticated emulator injectAudio API while preparing the APPS Backspin Android release. The installed SDK emulator segfaulted before Backspin was installed in both run41717696727 (unpaced mono) and run41718822479 (paced stereo). Neither run is an app result or a passing test. The prototype is retained for investigation and is disconnected from the release workflow. Do not restore it as a supported test route without validating the SDK behavior. No authentication token is saved here.

Protocol reference: the installed Android SDK emulator/lib/emulator_controller.proto and https://developer.android.com/studio/run/emulator-console. Runtime source and signed production bundle are unchanged by this experiment.
