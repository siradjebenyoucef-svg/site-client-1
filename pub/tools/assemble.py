#!/usr/bin/env python3
"""Assemble la vidéo muette et le son : voix (optionnelle), bruitages, musique (optionnelle).

  python3 tools/assemble.py video.mp4 sfx.wav sortie.mp4 [--voice voix.mp3] [--music musique.mp3]

- La voix est la référence : bruitages et musique passent dessous (compression déclenchée par la voix).
- Mixage final normalisé en deux passes à -14 LUFS, crête vraie à -1 dBTP (standard réseaux sociaux).
- Sans voix, les bruitages gardent exactement le même niveau que dans la version avec voix.
"""
import argparse
import json
import re
import subprocess

TARGET_I, TARGET_TP = -14.0, -1.0


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def measure(inputs, graph, label):
    """Mesure la loudness du graphe (première passe de loudnorm)."""
    cmd = ['ffmpeg', '-hide_banner', '-nostats']
    for i in inputs:
        cmd += ['-i', i]
    cmd += ['-filter_complex', graph + f';[{label}]loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json[o]', '-map', '[o]', '-f', 'null', '-']
    err = run(cmd).stderr
    js = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', err, re.S)[-1])
    return js


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('sfx'); ap.add_argument('out')
    ap.add_argument('--voice'); ap.add_argument('--music'); ap.add_argument('--duration', type=float)
    ap.add_argument('--sfx-gain', type=float, default=.5, help='niveau des bruitages par rapport à la voix')
    ap.add_argument('--ref-gain-db', type=float, help='gain final imposé (pour la version sans voix)')
    a = ap.parse_args()

    inputs = [a.sfx]
    parts = ['[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=%.3f[sfx0]' % a.sfx_gain]
    mixlabels = []
    if a.voice:
        inputs.append(a.voice)
        vi = len(inputs) - 1
        # voix : nettoyage léger, compression douce, puis niveau de référence
        parts.append(f'[{vi}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=80,'
                     'acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=1.6,apad,asplit=3[voice][key1][key2]')
        parts.append('[sfx0][key1]sidechaincompress=threshold=0.04:ratio=5:attack=4:release=220[sfx]')
        mixlabels.append('[voice]')
    else:
        parts.append('[sfx0]anull[sfx]')
    mixlabels.append('[sfx]')
    if a.music:
        inputs.append(a.music)
        mi = len(inputs) - 1
        parts.append(f'[{mi}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.22,afade=t=out:st={(a.duration or 13) - 1.2}:d=1.2[mus0]')
        if a.voice:
            parts.append('[mus0][key2]sidechaincompress=threshold=0.03:ratio=6:attack=8:release=300[mus]')
        else:
            parts.append('[mus0]anull[mus]')
        mixlabels.append('[mus]')
    elif a.voice:
        parts.append('[key2]anullsink')
    dur = a.duration or float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.video]).stdout)
    parts.append(''.join(mixlabels) + f'amix=inputs={len(mixlabels)}:normalize=0:duration=longest,apad,atrim=0:{dur:.3f}[mix]')
    graph = ';'.join(parts)

    if a.ref_gain_db is None:
        m = measure(inputs, graph, 'mix')
        gain = TARGET_I - float(m['input_i'])   # les crêtes sont tenues par le limiteur ci-dessous
    else:
        gain = a.ref_gain_db
    final = graph + f';[mix]volume={gain:.2f}dB,alimiter=limit={10 ** ((TARGET_TP - .6) / 20):.4f}:attack=2:release=60:level=disabled[out]'
    cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', a.video]
    for i in inputs:
        cmd += ['-i', i]
    # décale les index d'entrée audio (la vidéo est l'entrée 0)
    final = re.sub(r'\[(\d+):a\]', lambda mo: f'[{int(mo.group(1)) + 1}:a]', final)
    cmd += ['-filter_complex', final, '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
            '-movflags', '+faststart', '-shortest', a.out]
    r = run(cmd)
    if r.returncode:
        print(r.stderr); raise SystemExit(1)
    print(json.dumps({'out': a.out, 'gain_db': round(gain, 2)}))


if __name__ == '__main__':
    main()
