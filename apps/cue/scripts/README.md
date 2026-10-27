# Cue native build preparation

The app's npm postinstall runs patch-speech.cjs to preserve its on-device-only speech promise. It checks the selected locale's native recognizer and stops before preparing audio if offline recognition is unavailable; Apple's requiresOnDeviceRecognition flag alone is not honored on unsupported recognizers. The patch is idempotent and fails closed if the dependency changes. Node checks verify the guard and the Mac build verifies compilation. This folder serves APPS A2 release preparation.
