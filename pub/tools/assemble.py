#!/usr/bin/env python3
"""Assemble la vidéo muette et le son : voix (optionnelle), bruitages, musique (optionnelle).

  python3 tools/assemble.py video.mp4 sfx.wav sortie.mp4 [--voice voix.mp3] [--music musique.mp3] [--ref-gain-db G]

- La voix est la référence : bruitages et musique baissent automatiquement quand elle parle.
- Mixage final normalisé à -14 LUFS, crête vraie sous -1 dBTP (standard réseaux sociaux).
- Sans voix, --ref-gain-db reprend le gain de la version avec voix : bruitages au même niveau.
"""
import argparse
import json
import re
import subprocess
import tempfile
import wave

import numpy as np

SR = 48000
TARGET_I, TARGET_TP = -14.0, -1.0


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def fit(x, n):
    out = np.zeros((n, 2))
    m = min(n, len(x))
    out[:m] = x[:m]
    return out


def envelope(x, attack=.004, release=.22):
    """Enveloppe de niveau de la voix (montée rapide, retombée lente)."""
    a = np.abs(x).max(axis=1)
    ka, kr = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    env = np.zeros_like(a)
    e = 0.0
    for i, v in enumerate(a):
        k = ka if v > e else kr
        e = k * e + (1 - k) * v
        env[i] = e
    return env


def duck(env, depth_db=9.0, thresh=.03):
    """Gain appliqué sous la voix : jusqu'à -depth_db quand la voix est présente."""
    amount = np.clip((env - thresh) / (thresh * 3), 0, 1)
    return 10 ** (-depth_db * amount / 20)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def loudness(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                          f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', err, re.S)[-1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('sfx'); ap.add_argument('out')
    ap.add_argument('--voice'); ap.add_argument('--music'); ap.add_argument('--duration', type=float)
    ap.add_argument('--sfx-gain', type=float, default=.5, help='niveau des bruitages par rapport à la voix')
    ap.add_argument('--ref-gain-db', type=float, help='gain final imposé (version sans voix)')
    a = ap.parse_args()

    dur = a.duration or float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.video],
                                             capture_output=True, text=True).stdout)
    n = int(round(dur * SR))
    mix = fit(decode(a.sfx), n) * a.sfx_gain
    if a.voice:
        v = fit(decode(a.voice), n)
        v = v / (np.abs(v).max() + 1e-9) * .9
        mix = mix * duck(envelope(v))[:, None] + v
    if a.music:
        m = fit(decode(a.music), n) * .22
        if a.voice:
            m *= duck(envelope(fit(decode(a.voice), n)), 12)[:, None]
        mix += m * np.clip((dur - np.arange(n) / SR) / 1.2, 0, 1)[:, None]
    mix *= np.clip((dur - np.arange(n) / SR) / .03, 0, 1)[:, None]   # pas de clic en fin de fichier
    mix /= max(1.0, np.abs(mix).max() / .98)

    with tempfile.TemporaryDirectory() as tmp:
        raw = f'{tmp}/mix.wav'
        write_wav(raw, mix)
        gain = a.ref_gain_db if a.ref_gain_db is not None else TARGET_I - float(loudness(raw)['input_i'])
        limit = 10 ** ((TARGET_TP - .7) / 20)
        cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', a.video, '-i', raw,
               '-filter_complex', f'[1:a]volume={gain:.2f}dB,alimiter=limit={limit:.4f}:attack=2:release=60:level=disabled,aresample=48000[out]',
               '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
               '-movflags', '+faststart', '-t', f'{dur:.3f}', a.out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            print(r.stderr); raise SystemExit(1)
    print(json.dumps({'out': a.out, 'gain_db': round(gain, 2)}))


if __name__ == '__main__':
    main()
