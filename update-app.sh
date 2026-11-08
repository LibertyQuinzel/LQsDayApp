#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RUN_AFTER_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --run)
      RUN_AFTER_BUILD=true
      ;;
    -h|--help)
      echo "Usage: bash update-app.sh [--run]"
      echo
      echo "Builds the latest app bundle and verifies TypeScript/Electron syntax."
      echo "Use --run to launch the desktop app after a successful build."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: bash update-app.sh [--run]"
      exit 1
      ;;
  esac
done

echo "Checking TypeScript..."
npx tsc --project src/tsconfig.json

echo "Checking Electron main process syntax..."
node --check src/electron/main.cjs

echo "Building the app with the latest source..."
npm run build

echo
echo "Update complete."
echo "The desktop app will use the updated build on next launch."
echo "Your saved app data is stored outside src/dist, so rebuilding will not delete it."

if [ "$RUN_AFTER_BUILD" = true ]; then
  echo
  echo "Launching the desktop app..."
  npm run electron
else
  echo "Run it now with: bash update-app.sh --run"
fi
