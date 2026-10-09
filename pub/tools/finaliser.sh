#!/bin/bash
# Fabrique les deux livrables à partir d'une voix off.
#   tools/finaliser.sh chemin/voix-off.mp3 [musique.mp3]
# 1. mesure l'instant de chaque mot dans la voix (reconnaissance vocale hors ligne)
# 2. rend la vidéo image par image calée sur ces instants (flou de bougé 3 sous-images)
# 3. synthétise les bruitages calés sur les mêmes instants
# 4. assemble : pub-site-internet.mp4 (avec voix) et pub-site-internet-sans-voix.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
VOICE=$(realpath "$1")
MUSIC=${2:-}
OUTDIR=$(realpath ..)
MODEL=${MODEL:-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8}
export NODE_PATH=$(npm root -g)
mkdir -p build models

if [ ! -d "$MODEL" ]; then
  echo "Téléchargement du modèle de reconnaissance vocale (≈490 Mo)…"
  curl -sSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2 | tar xj -C models
fi
python3 -c "import sherpa_onnx, scipy" 2>/dev/null || pip install --quiet sherpa-onnx scipy

echo "1/4 Mesure des mots…"
python3 tools/align.py "$VOICE" build/timings.json "$MODEL"

echo "2/4 Rendu de la vidéo (≈20 min)…"
TIMINGS=build/timings.json node tools/render.cjs video build/video.mp4 --sub 3

echo "3/4 Bruitages…"
python3 tools/sfx.py build/sfx.wav build/timings.json

echo "4/4 Assemblage…"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 build/video.mp4)
MUS=(); [ -n "$MUSIC" ] && MUS=(--music "$(realpath "$MUSIC")")
G=$(python3 tools/assemble.py build/video.mp4 build/sfx.wav "$OUTDIR/pub-site-internet.mp4" --voice "$VOICE" "${MUS[@]}" --duration "$DUR" | python3 -c "import json,sys; print(json.load(sys.stdin)['gain_db'])")
python3 tools/assemble.py build/video.mp4 build/sfx.wav "$OUTDIR/pub-site-internet-sans-voix.mp4" "${MUS[@]}" --duration "$DUR" --ref-gain-db "$G" >/dev/null
echo "Terminé : $OUTDIR/pub-site-internet.mp4 et $OUTDIR/pub-site-internet-sans-voix.mp4"
