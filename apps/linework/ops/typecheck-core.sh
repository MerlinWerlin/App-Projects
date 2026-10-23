#!/bin/sh
# Offline core typecheck (WORKFLOW step 4, registry unreachable). Uses any @types/node already on the machine.
cd "$(dirname "$0")/.." || exit 1
TYPES=""
for d in node_modules/@types /opt/npm-tools/node_modules/@types; do
  [ -d "$d/node" ] && { TYPES="--typeRoots $d --types node"; break; }
done
# direction.ts is the React Native side of layout direction (imports react-native), not pure.
FILES=$(ls src/core/*.ts src/i18n/*.ts src/i18n/en/*.ts src/i18n/locales/*.ts 2>/dev/null | grep -v "src/i18n/direction\.ts$")
[ -z "$TYPES" ] && FILES=$(echo "$FILES" | grep -v "\.test\.ts$")
exec tsc --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler \
  --allowImportingTsExtensions $TYPES $FILES
