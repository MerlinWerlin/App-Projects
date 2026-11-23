# Store captures

.github/workflows/screedline-capture.yml builds Release simulator apps and runs `store-flow.yaml` (6.9-inch, light and dark) and `check-flow.yaml` (small iPhone, largest text). Build B sets EXPO_PUBLIC_SCREEDLINE_CAPTURE=1: every tool open and invented demo jobs from src/state/capture.ts. Captions are added on the PC with `compose.py`.
