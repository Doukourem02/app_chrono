#!/usr/bin/env bash
# Recrée public/assets/chrono-icon.png (512×512) à partir du logo portrait.
# À relancer si vous remplacez assets/chrono.png.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/chrono.png"
OUT="$ROOT/public/assets/chrono-icon.png"
TMP="$(mktemp /tmp/chrono-sq.XXXXXX.png)"
# Portrait 1609×2305 → carré centré min(côtés), puis 512×512
W=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/ {print $2}')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/ {print $2}')
SIDE=$(( W < H ? W : H ))
OFF_Y=$(( (H - SIDE) / 2 ))
OFF_X=$(( (W - SIDE) / 2 ))
sips -c "$SIDE" "$SIDE" --cropOffset "$OFF_Y" "$OFF_X" "$SRC" -o "$TMP"
sips -z 512 512 "$TMP" -o "$OUT"
rm -f "$TMP"
cp "$OUT" "$ROOT/app/icon.png"
cp "$OUT" "$ROOT/app/apple-icon.png"
cp "$OUT" "$ROOT/public/favicon.png"
echo "OK: $OUT (+ app/icon.png, apple-icon.png, public/favicon.png)"
