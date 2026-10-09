// Horloge de la pub : tout est piloté par l'instant où chaque mot est prononcé.
// Les valeurs par défaut viennent du brief ; timings.json (même format) les remplace
// quand on recale sur le vrai fichier voix-off.mp3.

export const FPS = 30;
// durée : au moins 13 s, et toujours 2,4 s d'image finale après « WhatsApp »
export let DURATION = 13.0;
export const W = 1080, H = 1920;

export const GREEN = '#16ff6e';
export const GREEN_HEX = 0x16ff6e;

// [id, texte affiché, début en secondes]
export const DEFAULT_WORDS = [
  ['votre', 'Votre', 0.00], ['commerce', 'commerce', 0.32], ['na', "n'a", 0.68], ['toujours', 'toujours', 0.93],
  ['pas', 'pas', 1.24], ['de', 'de', 1.36], ['site1', 'site', 1.44], ['internet1', 'internet', 1.84],
  ['pendant', 'Pendant', 2.37], ['ce', 'ce', 2.64], ['temps', 'temps', 2.80], ['vos1', 'vos', 3.20],
  ['clients', 'clients', 3.44], ['trouvent', 'trouvent', 3.68], ['vos2', 'vos', 4.00], ['concurrents', 'concurrents', 4.16],
  ['sur1', 'sur', 4.59], ['google', 'Google', 4.72],
  ['site2', 'Site', 5.60], ['internet2', 'Internet', 5.76], ['cle', 'Clé', 6.24], ['en', 'en', 6.52], ['main', 'Main', 6.64],
  ['un', 'un', 7.01], ['site3', 'site', 7.12], ['pro', 'pro', 7.48], ['moderne', 'moderne', 7.92],
  ['pret', 'prêt', 8.52], ['a', 'à', 8.72], ['vendre', 'vendre', 8.85],
  ['devis', 'Devis', 9.36], ['gratuit', 'gratuit', 9.68], ['sur2', 'sur', 10.08], ['whatsapp', 'WhatsApp', 10.24],
];

export const T = {};
export function setWords(list) {
  for (const [id, , t] of list) T[id] = t;
  DURATION = Math.min(14, Math.max(13.0, Math.ceil((T.whatsapp + 2.4) * 30) / 30));
}
setWords(DEFAULT_WORDS);

// ---------- maths & courbes ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, x) => a + (b - a) * x;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = x => x * x * (3 - 2 * x);
export const eOut = x => 1 - Math.pow(1 - x, 3);
export const eOut5 = x => 1 - Math.pow(1 - x, 5);
export const eIn = x => x * x * x;
export const eInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const eExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
export const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
export const eBack = (x, s = 1.7) => { const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
// réponse d'un ressort amorti (0 -> 1 avec dépassement), dt en secondes
export function spring(dt, w = 22, z = 0.45) {
  if (dt <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
}
// impulsion qui retombe : 0 avant t0, pic à t0, décroissance exponentielle
export const pulse = (t, t0, k = 8) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
// interpolation par images-clés [[t, v], ...] avec courbe
export function keys(t, list, ease = eInOut) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t1, v1] = list[i];
    if (t <= t1) {
      const [t0, v0] = list[i - 1];
      const e = list[i][2] || ease;
      return lerp(v0, v1, e(prog(t, t0, t1)));
    }
  }
  return list[list.length - 1][1];
}
export function keysV3(t, list, ease = eInOut) {
  return [0, 1, 2].map(k => keys(t, list.map(e => [e[0], e[1][k], e[2]]), ease));
}

// aléatoire déterministe
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// bruit lisse 1D déterministe (pour tremblements de caméra)
export function noise1(x, seed = 0) {
  const h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}
