#!/bin/sh
# Offline typecheck of src/core (non-test files; tests use import.meta and need @types/node, T96) (used when the npm registry is unreachable; WORKFLOW step 4).
cd "$(dirname "$0")/.." || exit 1
TYPES=""
[ -d /opt/npm-tools/node_modules/@types/node ] && TYPES="--typeRoots /opt/npm-tools/node_modules/@types --types node"
[ -d node_modules/@types/node ] && TYPES=""
exec tsc --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions $TYPES $(ls src/core/*.ts | grep -v "\.test\.ts$")
