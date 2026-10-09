#!/usr/bin/env python3
"""Bruitages de la pub, entièrement synthétisés et calés sur l'instant de chaque mot.

Usage : python3 tools/sfx.py sortie.wav [timings.json]
Produit un fichier stéréo 48 kHz (bruitages + nappe discrète), sans la voix.
"""
import json
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000

WORDS = [
    ('votre', 0.00), ('commerce', 0.32), ('na', 0.68), ('toujours', 0.93), ('pas', 1.24), ('de', 1.36),
    ('site1', 1.44), ('internet1', 1.84), ('pendant', 2.37), ('ce', 2.64), ('temps', 2.80), ('vos1', 3.20),
    ('clients', 3.44), ('trouvent', 3.68), ('vos2', 4.00), ('concurrents', 4.16), ('sur1', 4.59), ('google', 4.72),
    ('site2', 5.60), ('internet2', 5.76), ('cle', 6.24), ('en', 6.52), ('main', 6.64), ('un', 7.01), ('site3', 7.12),
    ('pro', 7.48), ('moderne', 7.92), ('pret', 8.52), ('a', 8.72), ('vendre', 8.85), ('devis', 9.36), ('gratuit', 9.68),
    ('sur2', 10.08), ('whatsapp', 10.24),
]
T = dict(WORDS)
if len(sys.argv) > 2:
    for wid, _txt, t in json.load(open(sys.argv[2])):
        T[wid] = t
# même règle que le rendu : au moins 13 s, et 2,4 s d'image finale après « WhatsApp »
import math
DUR = min(14.0, max(13.0, math.ceil((T['whatsapp'] + 2.4) * 30) / 30))
N = int(SR * DUR)

rng = np.random.default_rng(2024)
L = np.zeros(N)
Rr = np.zeros(N)


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(x, t0, gain=1.0, pan=0.0):
    """Ajoute le son x (mono) à l'instant t0, panoramique -1..1 (loi à puissance constante)."""
    i0 = int(round(t0 * SR))
    if i0 < 0:
        x = x[-i0:]
        i0 = 0
    n = min(len(x), N - i0)
    if n <= 0:
        return
    a = (pan + 1) * np.pi / 4
    L[i0:i0 + n] += x[:n] * gain * np.cos(a)
    Rr[i0:i0 + n] += x[:n] * gain * np.sin(a)


def place_st(xl, xr, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    n = min(len(xl), N - i0)
    L[i0:i0 + n] += xl[:n] * gain
    Rr[i0:i0 + n] += xr[:n] * gain


def bp(x, f, q=1.0):
    b, a = signal.iirpeak(min(f, SR / 2 * .95) / (SR / 2), q)
    return signal.lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f, SR / 2 * .95) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def sweep_filter(x, f0, f1, q=2.0, curve=1.0):
    """Passe-bande dont la fréquence glisse de f0 à f1 (traitement par blocs)."""
    out = np.zeros_like(x)
    blk = 256
    nb = len(x) // blk + 1
    zi = None
    for k in range(nb):
        u = (k / max(1, nb - 1)) ** curve
        f = f0 * (f1 / f0) ** u
        b, a = signal.iirpeak(min(f, SR / 2 * .95) / (SR / 2), q)
        seg = x[k * blk:(k + 1) * blk]
        if len(seg) == 0:
            break
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        y, zi = signal.lfilter(b, a, seg, zi=zi)
        out[k * blk:k * blk + len(seg)] = y
    return out


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def reverb(x, dur=1.2, damp=3500, mix=.3, seed=1):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 6.0 / dur)
    ir = lp(ir, damp)
    ir[0] = 0
    wet = signal.fftconvolve(x, ir)
    wet = norm(wet, np.max(np.abs(x)) * .9)
    out = np.zeros(len(wet))
    out[:len(x)] += x
    out += wet * mix
    return out


# ------------------------------------------------------------------ sons de base
def hit(dur=.9, f0=140, f1=42, sub=1.0, click=.6, body=.6, seed=0):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 4.2) * sub
    r = np.random.default_rng(seed)
    nz = r.standard_normal(len(t))
    c = hp(nz, 2500) * np.exp(-t * 160) * click
    b = lp(nz, 900) * np.exp(-t * 22) * body
    return norm(s + c + b)


def whoosh(dur=.6, f0=300, f1=3500, q=1.3, seed=0, shape='swell'):
    t = tt(dur)
    r = np.random.default_rng(seed)
    nz = r.standard_normal(len(t))
    y = lp(sweep_filter(nz, f0, f1, q), 7500, 2)
    u = t / dur
    if shape == 'swell':
        env = np.sin(np.pi * u) ** 1.6
    elif shape == 'in':
        env = u ** 2.2 * (1 - np.clip((u - .94) / .06, 0, 1))
    else:
        env = (1 - u) ** 2
    return norm(y * env)


def pop(f=700, dur=.14, drop=1.6):
    t = tt(dur)
    fr = f * (1 + (drop - 1) * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = np.sin(ph) * np.exp(-t * 32)
    y += .3 * np.sin(2 * ph) * np.exp(-t * 50)
    y[:int(.002 * SR)] *= np.linspace(0, 1, int(.002 * SR))
    return norm(y)


def tick(f=3800, dur=.05, seed=0):
    t = tt(dur)
    nz = np.random.default_rng(seed).standard_normal(len(t))
    y = bp(nz, f, 8) * np.exp(-t * 140) + .4 * np.sin(2 * np.pi * f * .5 * t) * np.exp(-t * 90)
    return norm(y)


def bell(f, dur=1.2, partials=((1, 1), (2.76, .45), (5.4, .25), (8.93, .12)), decay=3.2):
    t = tt(dur)
    y = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * decay * (1 + k * .35)) for k, a in partials)
    y[:int(.003 * SR)] *= np.linspace(0, 1, int(.003 * SR))
    return norm(y)


def glitch(dur=.32, seed=3):
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    i = 0
    while i < len(out):
        seg = int(r.uniform(.008, .035) * SR)
        kind = r.integers(0, 3)
        tt_ = np.arange(seg) / SR
        if kind == 0:
            x = np.sign(np.sin(2 * np.pi * r.uniform(150, 1800) * tt_))
        elif kind == 1:
            x = r.standard_normal(seg)
            x = np.round(x * 3) / 3
        else:
            x = np.zeros(seg)
        out[i:i + seg] = x[:len(out) - i] * r.uniform(.3, 1)
        i += seg
    out = hp(out, 300)
    return norm(out * np.linspace(1, .6, len(out)))


def power_down(dur=.42):
    t = tt(dur)
    f = 60 + 900 * np.exp(-t * 9)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / dur) ** 1.5
    return norm(y)


def shimmer(dur=.7, n=40, fmin=2200, fmax=6500, seed=5):
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR) + SR // 4)
    for _ in range(n):
        f = r.uniform(fmin, fmax)
        g = bell(f, .22, partials=((1, 1), (2.0, .2)), decay=18)
        i0 = int(r.uniform(0, dur) * SR)
        out[i0:i0 + len(g)] += g * r.uniform(.3, 1)
    return norm(out)


def riser(dur=.75, seed=7):
    t = tt(dur)
    u = t / dur
    nz = np.random.default_rng(seed).standard_normal(len(t))
    y = sweep_filter(nz, 250, 7000, 1.5, curve=1.6) * u ** 2.4
    f = 180 * (4.5 ** (u ** 1.5))
    y += .35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * u ** 2
    return norm(y)


def metal(dur=.35, f=1180, seed=9):
    t = tt(dur)
    parts = [(1, 1), (2.21, .6), (3.47, .45), (5.13, .3)]
    y = sum(a * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (14 + k * 4)) for k, a in parts)
    nz = np.random.default_rng(seed).standard_normal(len(t))
    y += hp(nz, 4000) * np.exp(-t * 120) * .8
    return norm(y)


def slide(dur=.16, seed=11):
    t = tt(dur)
    nz = np.random.default_rng(seed).standard_normal(len(t))
    y = sweep_filter(nz, 2500, 6000, 6) * np.sin(np.pi * t / dur)
    return norm(y)


def buzz(dur=.13, f=175):
    t = tt(dur)
    y = np.tanh(3 * np.sin(2 * np.pi * f * t)) * np.sin(np.pi * t / dur) ** .5
    return norm(lp(y, 900))


# ------------------------------------------------------------------ partition
def at(k):
    return T[k]


# temps 1 : le problème
place(reverb(hit(1.1, 160, 40, sub=1.0, click=.8, body=.7, seed=1), 1.4, mix=.25), at('votre') - .005, .78)
place(whoosh(.32, 600, 4200, 1.8, seed=2, shape='in'), at('commerce') - .2, .22, pan=-.3)
place(pop(520), at('commerce'), .32)
place(tick(3200, seed=3), at('na'), .12, pan=.3)
place(tick(3600, seed=4), at('toujours'), .1, pan=-.3)
place(glitch(.34), at('pas') - .01, .32, pan=.15)
place(power_down(.45), at('pas') + .05, .3)
place(hit(.6, 110, 50, sub=.8, click=.4, body=.3, seed=5), at('pas'), .38)
place(pop(760), at('internet1'), .28)
place(pop(980, .12), at('internet1') + .26, .16)
# grue : on s'envole + la nuit tombe (tic-tac rapide)
place(whoosh(.75, 200, 2600, 1.2, seed=6), 2.18, .45, pan=-.2)
for i, tk in enumerate(np.arange(at('pendant'), at('vos1') - .02, .135)):
    place(tick(3000 if i % 2 else 3900, .06, seed=20 + i), tk, .14 * (1 - i * .06), pan=.4 if i % 2 else -.4)
# clients : scintillement, puis épingles des concurrents qui surgissent
place(shimmer(.9, 46, seed=8), at('vos1') - .02, .18)
place(whoosh(.9, 400, 1800, 1.0, seed=9), at('clients') - .1, .16, pan=.3)
for i, f in enumerate([660, 830, 990]):
    place(pop(f, .16), at('concurrents') + i * .14, .3, pan=(-.6, .6, 0)[i])
place(pop(1180, .18), at('google'), .3)
place(bell(1568, .9, decay=4.5), at('google') + .02, .1, pan=.2)
# plongeon dans la serrure
place(whoosh(.55, 3200, 180, 1.4, seed=10, shape='swell'), at('google') + .32, .5)
place(hit(.5, 90, 40, sub=.7, click=.2, body=.2, seed=11), at('site2') - .04, .3)
# temps 3 : la clé
place(riser(at('cle') - at('site2') + .02), at('site2') - .02, .35)
place(whoosh(.45, 900, 5000, 2, seed=12), at('site2'), .3, pan=.5)
place(shimmer(.4, 18, 3000, 7000, seed=13), at('internet2'), .12, pan=.3)
place(slide(.16), at('cle') - .19, .3)
place(metal(.4, 1180), at('cle'), .42)
place(metal(.3, 1560, seed=14), at('cle') + .035, .3)
big = reverb(hit(1.6, 120, 34, sub=1.0, click=1.0, body=.9, seed=15), 2.2, mix=.45, seed=16)
place(big, at('cle') - .004, .95)
place(whoosh(.9, 2000, 120, .9, seed=17, shape='out'), at('cle') + .02, .32)
place(shimmer(.6, 30, 2500, 8000, seed=18), at('main') - .05, .14)
place(whoosh(.35, 300, 6000, 1.3, seed=19, shape='in'), at('un') - .3, .4)
# temps 4 : la preuve
for i, dt in enumerate([.03, .14, .26, .36, .46]):
    place(tick(2600 + i * 300, .04, seed=40 + i), at('un') + dt, .1, pan=(i % 2) * .6 - .3)
place(pop(880), at('pro'), .32)
place(shimmer(.5, 20, 3500, 8000, seed=21), at('pro') + .02, .14, pan=.4)
for i in range(4):
    place(tick(4200, .03, seed=50 + i), at('pro') + .14 + i * .07, .08)
place(whoosh(.42, 500, 3800, 1.6, seed=22), at('moderne') - .1, .34, pan=.6)
place(hit(.35, 160, 70, sub=.5, click=.3, body=.3, seed=23), at('moderne') + .2, .2, pan=.4)
tap = at('a') + .06
place(tick(1800, .05, seed=24), tap, .3, pan=.3)
place(bell(2093, .9, decay=5), at('vendre'), .2, pan=.25)
place(bell(2637, .9, decay=5), at('vendre') + .07, .2, pan=.35)
place(bell(3136, 1.0, decay=4.5), at('vendre') + .14, .18, pan=.45)
place(shimmer(.7, 40, 3000, 9000, seed=25), at('vendre') + .05, .16, pan=.4)
# temps 5 : l'appel à l'action
place(whoosh(.5, 250, 5000, 1.1, seed=26), at('devis') - .2, .55, pan=-.2)
place(reverb(hit(.9, 150, 45, sub=.9, click=.7, body=.6, seed=27), 1.2, mix=.25), at('devis') - .005, .6)
place(pop(700), at('gratuit'), .3)
place(whoosh(.3, 800, 4500, 2, seed=28, shape='in'), at('gratuit') - .25, .2, pan=.3)
place(buzz(.13), at('whatsapp') - .02, .16)
place(buzz(.13), at('whatsapp') + .2, .12)
place(bell(1318.5, 1.3, decay=3.0), at('whatsapp'), .34)
place(bell(1760, 1.5, decay=2.6), at('whatsapp') + .1, .32)
place(shimmer(.8, 30, 2500, 7000, seed=29), at('whatsapp') + .42, .1)

# nappe discrète : tension (avant la clé) puis résolution lumineuse (après)
t = np.arange(N) / SR
pre = np.clip(1 - (t - at('cle')) / .05, 0, 1)
post = 1 - pre
fade_in = np.clip(t / .4, 0, 1)
fade_out = np.clip((DUR - t) / .9, 0, 1)
lfo = .75 + .25 * np.sin(2 * np.pi * .35 * t)
dr = (np.sin(2 * np.pi * 55 * t) * .5 + np.sin(2 * np.pi * 82.41 * t) * .3 + np.sin(2 * np.pi * 110 * t + .3) * .2)
dr *= (.55 + .45 * np.clip((t - 2.3) / 3.5, 0, 1)) * pre
pad = sum(a * np.sin(2 * np.pi * f * t + i) for i, (f, a) in enumerate([(110, .35), (164.81, .25), (220, .25), (277.18, .18), (329.63, .14)]))
pad *= post * np.clip((t - at('cle')) / .6, 0, 1)
air = lp(np.random.default_rng(99).standard_normal(N), 1400) * .06
bed = (dr * .55 + pad * .35 + air) * lfo * fade_in * fade_out
bed = lp(bed, 2400)
place_st(bed, np.roll(bed, int(.012 * SR)), 0, .05)

mix = np.stack([L, Rr], axis=1)
mix *= np.clip((DUR - t) / .25, 0, 1)[:, None]  # pas de clic en fin de fichier
peak = np.max(np.abs(mix))
mix = mix / peak * .89
pcm = (mix * 32767 + np.random.default_rng(1).uniform(-.5, .5, mix.shape)).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', sys.argv[1], f'crête avant normalisation {peak:.2f}')
