#!/usr/bin/env bash
# tools/vendor-shepherd.sh — self-host di Shepherd.js (AUDIT 2026-07-19, falla #5).
#
# Perché: Shepherd.js è l'unica risorsa ancora servita da CDN (jsdelivr). Una CDN compromessa
# o un MITM su rete non fidata potrebbe iniettare uno script con pieni privilegi nella pagina.
# jsPDF è già stato self-hostato per lo stesso motivo (js/vendor/). Questo script scarica
# Shepherd in js/vendor/, calcola l'hash SRI e stampa i tag <link>/<script> pronti da incollare
# in index.html al posto dei due URL jsdelivr.
#
# ⚠️ Va eseguito da una macchina CON accesso a Internet (nella sandbox di Cowork il proxy blocca
# jsdelivr con 403, per questo non è stato fatto in automatico). Uso:
#   bash tools/vendor-shepherd.sh [versione]     # es. bash tools/vendor-shepherd.sh 11.2.0
set -euo pipefail

VER="${1:-11.2.0}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/js/vendor"
BASE="https://cdn.jsdelivr.net/npm/shepherd.js@${VER}/dist"

mkdir -p "$DIR"
echo "Scarico Shepherd.js ${VER} in ${DIR} ..."
curl -fSL "${BASE}/js/shepherd.min.js" -o "${DIR}/shepherd.min.js"
curl -fSL "${BASE}/css/shepherd.css"   -o "${DIR}/shepherd.css"

sri() { openssl dgst -sha384 -binary "$1" | openssl base64 -A; }
JS_SRI="sha384-$(sri "${DIR}/shepherd.min.js")"
CSS_SRI="sha384-$(sri "${DIR}/shepherd.css")"

cat <<EOF

Fatto. File salvati in js/vendor/. Sostituisci in index.html i due URL jsdelivr con:

  <link rel="stylesheet" href="js/vendor/shepherd.css?v=${VER}" integrity="${CSS_SRI}" crossorigin="anonymous" />
  <script src="js/vendor/shepherd.min.js?v=${VER}" integrity="${JS_SRI}" crossorigin="anonymous"></script>

Poi nella CSP di index.html puoi TOGLIERE https://cdn.jsdelivr.net da script-src e style-src
(tutto diventa 'self'), e in sw.js aggiungere i due file al PRECACHE per il funzionamento offline.
EOF
