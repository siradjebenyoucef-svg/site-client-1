#!/usr/bin/env python3
"""Mesure l'instant où chaque mot du texte est prononcé dans un fichier voix.

Reconnaissance vocale française hors ligne (sherpa-onnx, modèle zipformer), puis
alignement du résultat sur le texte connu de la pub. Écrit un timings.json lu par le rendu.

Usage : python3 tools/align.py voix.mp3 sortie.json [dossier_du_modele]
"""
import json
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher

import numpy as np
import sherpa_onnx

OFFSET = 0.0  # correction éventuelle de l'horodatage du modèle (calée sur les pauses)

SCRIPT = [
    ('votre', 'Votre'), ('commerce', 'commerce'), ('na', "n'a"), ('toujours', 'toujours'), ('pas', 'pas'), ('de', 'de'),
    ('site1', 'site'), ('internet1', 'internet'), ('pendant', 'Pendant'), ('ce', 'ce'), ('temps', 'temps'), ('vos1', 'vos'),
    ('clients', 'clients'), ('trouvent', 'trouvent'), ('vos2', 'vos'), ('concurrents', 'concurrents'), ('sur1', 'sur'),
    ('google', 'Google'), ('site2', 'Site'), ('internet2', 'Internet'), ('cle', 'Clé'), ('en', 'en'), ('main', 'Main'),
    ('un', 'un'), ('site3', 'site'), ('pro', 'pro'), ('moderne', 'moderne'), ('pret', 'prêt'), ('a', 'à'), ('vendre', 'vendre'),
    ('devis', 'Devis'), ('gratuit', 'gratuit'), ('sur2', 'sur'), ('whatsapp', 'WhatsApp'),
]


def silences(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.05', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    st, res = None, []
    for line in out.splitlines():
        if 'silence_start:' in line:
            st = float(line.split('silence_start:')[1].split()[0])
        elif 'silence_end:' in line and st is not None:
            res.append((st, float(line.split('silence_end:')[1].split()[0]))); st = None
    # fusionne les pauses contiguës
    merged = []
    for s0, s1 in res:
        if merged and s0 - merged[-1][1] < .02:
            merged[-1] = (merged[-1][0], s1)
        else:
            merged.append((s0, s1))
    return merged


def norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    w = ''.join(c for c in w if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in w if c.isalnum())


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def recognize(samples, model_dir):
    import os
    p = model_dir.rstrip('/') + '/'
    if os.path.exists(p + 'encoder.int8.onnx'):
        # modèle hors ligne (Parakeet TDT, multilingue) : horodatage précis des jetons
        rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=p + 'encoder.int8.onnx', decoder=p + 'decoder.int8.onnx', joiner=p + 'joiner.int8.onnx',
            tokens=p + 'tokens.txt', num_threads=4, sample_rate=16000, feature_dim=80, model_type='nemo_transducer',
            decoding_method='greedy_search')
        s = rec.create_stream()
        s.accept_waveform(16000, np.concatenate([np.zeros(8000, np.float32), samples, np.zeros(8000, np.float32)]))
        rec.decode_stream(s)
        r = s.result
        words = []
        for tok, ts in zip(r.tokens, r.timestamps):
            ts -= .5
            if tok.startswith(('▁', ' ')) or not words:
                words.append([tok.lstrip('▁ '), ts])
            else:
                words[-1][0] += tok
        return [(w, t) for w, t in words if norm(w)]
    rec = sherpa_onnx.OnlineRecognizer.from_transducer(
        tokens=p + 'tokens.txt',
        encoder=p + 'encoder-epoch-29-avg-9-with-averaged-model.onnx',
        decoder=p + 'decoder-epoch-29-avg-9-with-averaged-model.onnx',
        joiner=p + 'joiner-epoch-29-avg-9-with-averaged-model.onnx',
        num_threads=4, sample_rate=16000, feature_dim=80, decoding_method='greedy_search')
    s = rec.create_stream()
    s.accept_waveform(16000, samples)
    s.accept_waveform(16000, np.zeros(int(16000 * .8), dtype=np.float32))
    s.input_finished()
    while rec.is_ready(s):
        rec.decode_stream(s)
    r = rec.get_result_all(s)
    words = []
    for tok, ts in zip(r.tokens, r.timestamps):
        if tok.startswith(('▁', ' ')) or not words:
            words.append([tok.lstrip('▁ '), ts])
        else:
            words[-1][0] += tok
    return [(w, t) for w, t in words if norm(w)]


def align(rec_words):
    """Alignement mot à mot (programmation dynamique avec similarité de chaînes)."""
    A = [norm(t) for _, t in SCRIPT]
    B = [norm(w) for w, _ in rec_words]
    n, m = len(A), len(B)
    sim = lambda a, b: SequenceMatcher(None, a, b).ratio()
    D = np.zeros((n + 1, m + 1)); P = np.zeros((n + 1, m + 1), dtype=int)
    D[:, 0] = -np.arange(n + 1) * .6; D[0, :] = -np.arange(m + 1) * .6
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            opts = [D[i - 1, j - 1] + (sim(A[i - 1], B[j - 1]) * 2 - 1), D[i - 1, j] - .6, D[i, j - 1] - .6]
            P[i, j] = int(np.argmax(opts)); D[i, j] = max(opts)
    i, j, match = n, m, {}
    while i > 0 and j > 0:
        if P[i, j] == 0:
            if sim(A[i - 1], B[j - 1]) > .34:
                match[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif P[i, j] == 1:
            i -= 1
        else:
            j -= 1
    return match


def main():
    audio, out = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else 'models/sherpa-onnx-streaming-zipformer-fr-2023-04-14'
    samples = load(audio)
    rec = recognize(samples, model)
    match = align(rec)
    times = [None] * len(SCRIPT)
    for i, j in match.items():
        times[i] = max(0.0, rec[j][1] + OFFSET)
    # mots non reconnus : interpolation entre voisins
    known = [i for i, t in enumerate(times) if t is not None]
    for i in range(len(times)):
        if times[i] is None:
            lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
            if lo is not None and hi is not None:
                times[i] = times[lo] + (times[hi] - times[lo]) * (i - lo) / (hi - lo)
            else:
                times[i] = times[lo] + .25 * (i - lo) if lo is not None else 0.0
    # recalage : un mot qui commence pendant une pause démarre en fait à la fin de cette pause
    sil = silences(audio)
    for i, t in enumerate(times):
        for s0, s1 in sil:
            if s0 - .05 <= t <= s1 + .12 and s1 - s0 > .09:
                times[i] = s1
                break
    # monotonie
    for i in range(1, len(times)):
        times[i] = max(times[i], times[i - 1] + .03)
    res = [[sid, txt, round(t, 3)] for (sid, txt), t in zip(SCRIPT, times)]
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
    print('reconnu :', ' '.join(w for w, _ in rec))
    print(f'mots alignés : {len(match)}/{len(SCRIPT)}')
    for (sid, txt, t) in res:
        print(f'  {txt:12s} {t:6.2f}' + ('' if SCRIPT.index((sid, txt)) in match else '  (interpolé)'))


if __name__ == '__main__':
    main()
