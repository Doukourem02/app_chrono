#!/usr/bin/env bash
# Vérifie que l’extension ExpoWidgets embarque le runtime JS (sinon îlot noir).
# Usage:
#   ./scripts/verify-expo-widgets-appex.sh
#   ./scripts/verify-expo-widgets-appex.sh /chemin/vers/Debug-iphoneos/Krono.app/PlugIns/ExpoWidgetsTarget.appex
set -euo pipefail

APPEX="${1:-}"

if [[ -z "$APPEX" ]]; then
  ROOT="${SRCROOT:-$(cd "$(dirname "$0")/../ios" && pwd)}"
  # Dernier build local typique Expo / Xcode
  CANDIDATES=(
    "${ROOT}/build/Build/Products/Debug-iphoneos/Krono.app/PlugIns/ExpoWidgetsTarget.appex"
    "${ROOT}/build/Build/Products/Release-iphoneos/Krono.app/PlugIns/ExpoWidgetsTarget.appex"
  )
  for c in "${CANDIDATES[@]}"; do
    if [[ -d "$c" ]]; then
      APPEX="$c"
      break
    fi
  done
fi

if [[ ! -d "${APPEX:-}" ]]; then
  echo "Aucun .appex trouvé. Lance un build iOS puis:"
  echo "  $0 \"\$(pwd)/ios/build/Build/Products/Debug-iphoneos/Krono.app/PlugIns/ExpoWidgetsTarget.appex\""
  exit 2
fi

INNER="${APPEX}/ExpoWidgets.bundle/ExpoWidgets.bundle"
echo "Appex: $APPEX"

if [[ ! -e "${APPEX}/ExpoWidgets.bundle" ]]; then
  echo "ERREUR: ExpoWidgets.bundle manquant dans l’appex."
  exit 1
fi

if [[ -f "$INNER" ]]; then
  SZ=$(wc -c <"$INNER" | tr -d ' ')
  echo "OK: fichier JS interne présent (${SZ} octets)."
  if [[ "$SZ" -lt 20000 ]]; then
    echo "ATTENTION: taille très petite — le bundle Metro est peut‑être vide ou tronqué."
    exit 1
  fi
  exit 0
fi

echo "ERREUR: pas de fichier interne ExpoWidgets.bundle/ExpoWidgets.bundle (souvent seulement Info.plist)."
echo "Contenu de ExpoWidgets.bundle:"
ls -la "${APPEX}/ExpoWidgets.bundle" || true
exit 1
