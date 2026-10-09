#!/bin/bash
# Planche de revue : tools/review.sh video.mp4 sortie.jpg t1 t2 t3 ...
V=$1; OUT=$2; shift 2
D=$(mktemp -d)
i=0
for t in "$@"; do
  ffmpeg -loglevel error -y -ss $t -i "$V" -frames:v 1 -vf "drawtext=text='$t s':x=20:y=20:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.6" "$D/$(printf %02d $i).png"
  i=$((i+1))
done
N=$i; COLS=${COLS:-8}; ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -loglevel error -y -pattern_type glob -i "$D/*.png" -vf "scale=${W:-240}:-1,tile=${COLS}x${ROWS}:padding=4:color=0x303030" -frames:v 1 -q:v 3 "$OUT"
rm -rf "$D"
