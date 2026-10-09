// Le texte à l'écran : uniquement les mots prononcés, chacun calé sur sa voix.
import { T } from './timeline.js';

export function beats() {
  return {
    b1: {
      tIn: -1, tOut: T.pendant + .1, anchor: 760, leading: .86, fadeTop: 400,
      lines: [
        { size: 280, stretch: 116, words: [{ id: 'votre', t: T.votre - .1, text: 'VOTRE', enter: 'slam' }] },
        { size: 240, stretch: 84, words: [{ id: 'commerce', text: 'COMMERCE', enter: 'stretch', green: true }] },
        { size: 180, stretch: 76, words: [{ id: 'na', text: 'N’A', enter: 'rise' }, { id: 'toujours', text: 'TOUJOURS', enter: 'push' }] },
        { size: 200, stretch: 80, words: [{ id: 'pas', text: 'PAS', enter: 'slam' }, { id: 'de', text: 'DE', enter: 'push' }, { id: 'site1', text: 'SITE', enter: 'push' }] },
        { size: 240, stretch: 84, words: [{ id: 'internet1', text: 'INTERNET', enter: 'stretch', green: true }, { id: 'q1', t: T.internet1 + .26, text: '?', enter: 'pop', green: true }], gap: .12 },
      ],
    },
    b2: {
      tIn: T.pendant - .1, tOut: T.site2, anchor: 620, leading: .86, fadeTop: 400,
      lines: [
        { size: 140, stretch: 76, words: [{ id: 'pendant', text: 'PENDANT', enter: 'rise' }, { id: 'ce', text: 'CE', enter: 'push' }, { id: 'temps', text: 'TEMPS,', enter: 'push' }] },
        { size: 210, stretch: 80, words: [{ id: 'vos1', text: 'VOS', enter: 'rise' }, { id: 'clients', text: 'CLIENTS', enter: 'push' }] },
        { size: 210, stretch: 90, words: [{ id: 'trouvent', text: 'TROUVENT', enter: 'slam' }] },
        { size: 160, stretch: 76, words: [{ id: 'vos2', text: 'VOS', enter: 'rise' }, { id: 'concurrents', text: 'CONCURRENTS', enter: 'push', green: true }] },
        { size: 220, stretch: 86, words: [{ id: 'sur1', text: 'SUR', enter: 'rise' }, { id: 'google', text: 'GOOGLE !', enter: 'slam', green: true }] },
      ],
    },
    b3: {
      tIn: T.site2 - .1, tOut: T.un - .02, fixed: [400, 1360],
      lines: [
        { size: 175, stretch: 92, words: [{ id: 'site2', text: 'SITE', enter: 'drop' }, { id: 'internet2', text: 'INTERNET', enter: 'push' }] },
        { size: 210, stretch: 108, words: [{ id: 'cle', text: 'CLÉ', enter: 'slam', green: true }, { id: 'en', text: 'EN', enter: 'push', green: true }, { id: 'main', text: 'MAIN', enter: 'push', green: true }] },
      ],
    },
    b4: {
      tIn: T.un - .1, tOut: T.devis - .03, fixed: [370, 555, 740],
      lines: [
        { size: 165, stretch: 82, words: [{ id: 'un', text: 'UN', enter: 'rise' }, { id: 'site3', text: 'SITE', enter: 'push' }, { id: 'pro', text: 'PRO,', enter: 'slam', green: true }] },
        { size: 200, stretch: 100, words: [{ id: 'moderne', text: 'MODERNE,', enter: 'rise' }] },
        { size: 165, stretch: 80, words: [{ id: 'pret', text: 'PRÊT', enter: 'rise' }, { id: 'a', text: 'À', enter: 'push' }, { id: 'vendre', text: 'VENDRE.', enter: 'slam', green: true }] },
      ],
    },
    b5: {
      tIn: T.devis - .03, tOut: 99, fixed: [420, 640, 870, 1445],
      lines: [
        { size: 255, stretch: 104, words: [{ id: 'devis', text: 'DEVIS', enter: 'slam' }] },
        { size: 255, stretch: 86, words: [{ id: 'gratuit', text: 'GRATUIT', enter: 'stretch', green: true }] },
        { size: 150, stretch: 84, words: [{ id: 'sur2', text: 'SUR', enter: 'rise' }, { id: 'whatsapp', text: 'WHATSAPP !', enter: 'slam', pill: true }] },
        { size: 78, stretch: 92, gap: .28, words: [{ id: 'brand1', t: T.whatsapp + .42, text: 'SITE INTERNET', enter: 'rise' }, { id: 'brand2', t: T.whatsapp + .5, text: 'CLÉ EN MAIN', enter: 'rise', green: true }] },
      ],
    },
  };
}
