#!/bin/bash
# planche contact : tools/sheet.sh dossier sortie.jpg [colonnes] [largeur_vignette]
DIR=$1; OUT=$2; COLS=${3:-6}; WD=${4:-360}
N=$(ls $DIR/*.png | wc -l); ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -y -loglevel error -pattern_type glob -i "$DIR/*.png" -vf "scale=$WD:-1,drawbox=x=0:y=0:w=iw:h=ih:color=gray@0.6:t=1,tile=${COLS}x${ROWS}:padding=6:color=0x202020" -frames:v 1 -q:v 3 $OUT
