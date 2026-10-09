// Le site de la boulangerie (version ordinateur et version mobile), dessiné au canvas
// et animé élément par élément. Aucun mot lisible : pictogrammes, photos, blocs de texte.
import { clamp, lerp, prog, eOut, eOut5, eBack, eInOut, eExpo, rng } from './timeline.js';
import { roundRect, croissant, wheat, bag, cart, menu, magnifier, star, check, user, pin, fauxText, forkKnife, carIcon, hammerIcon } from './icons.js';

// plusieurs métiers : chaque commerçant s'y reconnaît
export const TRADES = {
  garage: { hero: 'heroGarage', cards: ['car2', 'wheel', 'wrench', 'heroGarage'], icon: carIcon },
  resto: { hero: 'heroResto', cards: ['burger', 'pizza', 'fries', 'eclair'], icon: forkKnife },
  artisan: { hero: 'heroArtisan', cards: ['hammer', 'screwdrivers', 'tape', 'wrench'], icon: hammerIcon },
  boulangerie: { hero: 'hero', cards: ['croissant', 'baguette', 'boule', 'eclair'], icon: croissant },
};
const FULL = { nav: 1, hero: 1, h1: 1, h2: 1, cta: 1, stars: 1, sec: 1, cards: [1, 1, 1, 1], info: 1 };

const BG = '#f4f4f2', INK = '#0e0e0e', G1 = '#8e8e8e', G2 = '#d7d7d4', G3 = '#e9e9e6', GREEN = '#16ff6e';

function cover(ctx, img, x, y, w, h, zoom = 1, fx = .5, fy = .5) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) * fx, y + (h - ih) * fy, iw, ih);
}
function clipRound(ctx, x, y, w, h, r, fn) {
  ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip(); fn(); ctx.restore();
}
function block(ctx, x, y, w, h, color) { ctx.fillStyle = color; roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); }
function emblem(ctx, cx, cy, r, bg, fg, icon = croissant) {
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  icon(ctx, cx, cy + r * .06, r * 1.25, fg);
}
// apparition : opacité + glissement
function appear(ctx, k, dy, fn) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.6); ctx.translate(0, (1 - eOut(k)) * dy); fn(); ctx.restore();
}
function grow(ctx, k, x, y, w, h, color) { if (k > 0) block(ctx, x, y, Math.max(h, w * eOut5(k)), h, color); }

// ---------------------------------------------------------------- ordinateur
export function drawDesktop(ctx, W, H, s, ph) {
  const cur = TRADES[s.trade || 'boulangerie'];
  if (s.next && s.swipe > 0) {
    // passage d'un métier à l'autre : la page glisse vers la gauche
    const x = -W * eInOut(clamp(s.swipe));
    ctx.save(); ctx.translate(x, 0); drawDesktopPage(ctx, W, H, s, ph, cur); ctx.restore();
    ctx.save(); ctx.translate(x + W, 0); drawDesktopPage(ctx, W, H, { ...FULL, scroll: s.scroll, badge: s.badge }, ph, TRADES[s.next]); ctx.restore();
  } else drawDesktopPage(ctx, W, H, s, ph, cur);
  // reflet de lumière qui balaie l'écran
  if (s.shine > 0 && s.shine < 1) {
    const x = lerp(-600, W + 600, s.shine);
    const gr = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setTransform(1, 0, -.35, 1, 0, 0); ctx.fillStyle = gr; ctx.fillRect(x - 400, 0, 800 + H, H); ctx.restore();
  }
}

function drawDesktopPage(ctx, W, H, s, ph, tr) {
  const R = rng(5);
  ctx.save();
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const sc = s.scroll || 0;
  ctx.translate(0, -sc);

  // barre de navigation
  appear(ctx, s.nav, -60, () => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = G3; ctx.fillRect(0, 91, W, 1);
    emblem(ctx, 70, 46, 26, INK, '#fff', tr.icon);
    block(ctx, 108, 34, 150, 15, INK); block(ctx, 108, 56, 96, 8, G1);
    [[560, 70], [660, 86], [776, 64], [870, 92]].forEach(([x, w]) => block(ctx, x, 41, w, 10, '#555'));
    magnifier(ctx, 1040, 46, 30, INK, .11);
    bag(ctx, 1100, 46, 30, INK, .1);
    const bp = s.badge || 0;
    if (bp > 0) { ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(1114, 34, 9 * eBack(clamp(bp), 3), 0, Math.PI * 2); ctx.fill(); }
    block(ctx, 1160, 24, 220, 44, GREEN); bag(ctx, 1194, 46, 24, INK, .12); block(ctx, 1216, 41, 128, 10, INK);
  });

  // héros : grande photo + accroche
  if (s.hero > 0) {
    const k = eOut5(s.hero);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 92, W * k + 1, 468); ctx.clip();
    cover(ctx, ph[tr.hero], 0, 92, W, 468, 1.18 - .18 * k, .5, .55);
    const gr = ctx.createLinearGradient(0, 0, W * .75, 0);
    gr.addColorStop(0, 'rgba(0,0,0,.78)'); gr.addColorStop(.55, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 92, W, 468);
    ctx.restore();
  }
  grow(ctx, s.h1, 90, 200, 470, 46, '#fff');
  grow(ctx, s.h2, 90, 262, 360, 46, '#fff');
  if (s.h2 > 0) { ctx.save(); ctx.globalAlpha = clamp(s.h2 * 2); block(ctx, 90, 336, 380, 12, 'rgba(255,255,255,.75)'); block(ctx, 90, 358, 300, 12, 'rgba(255,255,255,.75)'); ctx.restore(); }
  if (s.cta > 0) {
    const k = eBack(clamp(s.cta), 2.4);
    ctx.save(); ctx.translate(90 + 120, 430); ctx.scale(k, k); ctx.translate(-(90 + 120), -430);
    block(ctx, 90, 404, 240, 54, GREEN); cart(ctx, 128, 431, 28, INK, .11); block(ctx, 154, 425, 140, 12, INK);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; roundRect(ctx, 350, 404, 190, 54, 27); ctx.stroke(); block(ctx, 384, 425, 120, 12, '#fff');
    ctx.restore();
  }
  if (s.stars > 0) { for (let i = 0; i < 5; i++) { const k = eBack(clamp(s.stars * 5 - i), 3); if (k > 0) star(ctx, 100 + i * 30, 500, 26 * k, GREEN); } block(ctx, 260, 494, 110, 12, 'rgba(255,255,255,.7)'); }

  // produits
  appear(ctx, s.sec, 30, () => { block(ctx, W / 2 - 130, 600, 260, 22, INK); ctx.fillStyle = GREEN; ctx.fillRect(W / 2 - 30, 636, 60, 5); });
  const prods = tr.cards;
  prods.forEach((p, i) => {
    const k = s.cards ? s.cards[i] : 0;
    appear(ctx, k, 80, () => {
      const x = 70 + i * 335, y = 670, w = 300, h = 300;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#fff'; roundRect(ctx, x, y, w, h, 20); ctx.fill(); ctx.restore();
      clipRound(ctx, x, y, w, 190, 20, () => { cover(ctx, ph[p], x, y, w, 210, 1.05); });
      block(ctx, x + 22, y + 212, 150 + R() * 40, 16, INK);
      block(ctx, x + 22, y + 240, 110, 10, G1);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; roundRect(ctx, x + 22, y + 262, 84, 26, 13); ctx.stroke(); block(ctx, x + 40, y + 271, 48, 8, INK);
      ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(x + w - 38, y + 270, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + w - 48, y + 270); ctx.lineTo(x + w - 28, y + 270); ctx.moveTo(x + w - 38, y + 260); ctx.lineTo(x + w - 38, y + 280); ctx.stroke();
    });
  });
  // bandeau infos pratiques (icônes)
  appear(ctx, s.info, 40, () => {
    ctx.fillStyle = INK; ctx.fillRect(0, 1010, W, 160);
    [[220, pin], [720, user], [1220, star]].forEach(([x, f]) => { f(ctx, x - 70, 1090, 46, GREEN); block(ctx, x - 30, 1074, 160, 14, '#fff'); block(ctx, x - 30, 1098, 110, 10, '#777'); });
  });
  ctx.restore();
}

// ---------------------------------------------------------------- mobile
export function drawMobile(ctx, W, H, s, ph) {
  const tr = TRADES[s.trade || 'resto'];
  ctx.save();
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const sc = s.scroll || 0;

  // contenu défilant
  ctx.save(); ctx.translate(0, -sc);
  if (s.hero > 0) {
    const k = eOut5(s.hero);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 150, W, 620 * k); ctx.clip();
    cover(ctx, ph[tr.hero], 0, 150, W, 620, 1.25 - .15 * k, .42, .5);
    const gr = ctx.createLinearGradient(0, 150, 0, 770);
    gr.addColorStop(0, 'rgba(0,0,0,.1)'); gr.addColorStop(.45, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.85)');
    ctx.fillStyle = gr; ctx.fillRect(0, 150, W, 620); ctx.restore();
  }
  grow(ctx, s.h1, 44, 520, 470, 44, '#fff');
  grow(ctx, s.h2, 44, 578, 330, 44, '#fff');
  if (s.cta > 0) {
    const k = eBack(clamp(s.cta), 2.4);
    ctx.save(); ctx.translate(160, 690); ctx.scale(k, k); ctx.translate(-160, -690);
    block(ctx, 44, 662, 250, 58, GREEN); cart(ctx, 84, 691, 30, INK, .11); block(ctx, 112, 685, 150, 12, INK); ctx.restore();
  }
  // catégories
  appear(ctx, s.chips, 30, () => {
    block(ctx, 32, 800, 150, 52, GREEN); tr.icon(ctx, 72, 828, 44, INK); block(ctx, 98, 821, 64, 10, INK);
    [[200, 160], [380, 150], [550, 160]].forEach(([x, w]) => { ctx.strokeStyle = G2; ctx.lineWidth = 3; roundRect(ctx, x, 800, w, 52, 26); ctx.stroke(); block(ctx, x + 30, 821, w - 60, 10, G1); });
  });
  // liste de produits
  tr.cards.forEach((p, i) => {
    const k = s.cards ? s.cards[i] : 0;
    appear(ctx, k, 70, () => {
      const y = 890 + i * 222;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.1)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#fff'; roundRect(ctx, 28, y, W - 56, 196, 26); ctx.fill(); ctx.restore();
      clipRound(ctx, 44, y + 16, 210, 164, 18, () => cover(ctx, ph[p], 44, y + 16, 210, 164, 1.1));
      block(ctx, 280, y + 40, 220 - i * 18, 18, INK);
      block(ctx, 280, y + 74, 170, 10, G1); block(ctx, 280, y + 94, 120, 10, G1);
      for (let j = 0; j < 5; j++) star(ctx, 292 + j * 28, y + 140, 24, j < 4 + (i % 2) ? GREEN : G2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(W - 78, y + 138, 28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GREEN; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W - 90, y + 138); ctx.lineTo(W - 66, y + 138); ctx.moveTo(W - 78, y + 126); ctx.lineTo(W - 78, y + 150); ctx.stroke();
    });
  });
  ctx.restore();

  // barre du haut (fixe)
  appear(ctx, s.nav, -40, () => {
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fillRect(0, 0, W, 150);
    // icônes de statut (sans chiffres)
    for (let i = 0; i < 4; i++) { ctx.fillStyle = INK; ctx.fillRect(W - 150 + i * 12, 44 - i * 5, 8, 10 + i * 5); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; roundRect(ctx, W - 92, 32, 46, 24, 6); ctx.stroke(); ctx.fillStyle = INK; ctx.fillRect(W - 87, 37, 30, 14);
    menu(ctx, 64, 108, 44, INK);
    emblem(ctx, W / 2, 106, 30, INK, '#fff', tr.icon);
    bag(ctx, W - 66, 106, 42, INK, .1);
    const bp = s.badge || 0;
    if (bp > 0) { ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(W - 46, 88, 13 * eBack(clamp(bp), 3), 0, Math.PI * 2); ctx.fill(); }
  });

  // bouton "commander" collant en bas
  if (s.buy > 0) {
    const k = eOut5(s.buy);
    const y = H - 150 + (1 - k) * 160;
    ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.fillRect(0, y - 16, W, 170);
    const press = s.press || 0;
    const done = s.done || 0;
    ctx.save();
    const sc2 = 1 - .05 * press;
    ctx.translate(W / 2, y + 52); ctx.scale(sc2, sc2); ctx.translate(-W / 2, -(y + 52));
    block(ctx, 36, y, W - 72, 104, GREEN);
    if (done < .5) {
      ctx.globalAlpha = 1 - clamp(done * 2);
      cart(ctx, 130, y + 52, 46, INK, .1); block(ctx, 180, y + 44, 300, 16, INK);
    } else {
      ctx.globalAlpha = clamp(done * 2 - 1);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(W / 2, y + 52, 34, 0, Math.PI * 2); ctx.fill();
      check(ctx, W / 2, y + 52, 50, GREEN, .16);
    }
    ctx.restore();
    // onde du tapotement
    if (s.ripple > 0 && s.ripple < 1) {
      ctx.save(); roundRect(ctx, 36, y, W - 72, 104, 52); ctx.clip();
      ctx.fillStyle = `rgba(255,255,255,${.6 * (1 - s.ripple)})`;
      ctx.beginPath(); ctx.arc(W * .62, y + 52, 40 + eOut(s.ripple) * 520, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  // notification "commande reçue" qui descend
  if (s.toast > 0) {
    const k = eBack(clamp(s.toast), 1.6);
    const y = lerp(-150, 168, k);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = INK; roundRect(ctx, 30, y, W - 60, 120, 30); ctx.fill(); ctx.restore();
    ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(96, y + 60, 34, 0, Math.PI * 2); ctx.fill();
    check(ctx, 96, y + 60, 44, INK, .16);
    block(ctx, 150, y + 38, 260, 16, '#fff'); block(ctx, 150, y + 68, 190, 11, '#8a8a8a');
  }
  // doigt (cercle de toucher)
  if (s.touchA > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${.55 * s.touchA})`; ctx.strokeStyle = `rgba(0,0,0,${.4 * s.touchA})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(s.touchX, s.touchY, s.touchR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
