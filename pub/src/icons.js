// Pictogrammes dessinés au canvas (aucun texte) : utilisés sur l'enseigne, le site et l'appel à l'action.

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// croissant : segments arrondis le long d'un arc
export function croissant(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);              // 0..1
    const a = Math.PI * (1.12 - .24 - u * (1.12 - .24) * 1.0) ; // angle le long de l'arc
    const ang = Math.PI * (0.92 - u * 0.84);
    const r = s * .36;
    const x = Math.cos(ang) * r, y = -Math.sin(ang) * r * .55 + s * .12;
    const mid = 1 - Math.abs(u - .5) * 2;  // 0 aux bouts, 1 au centre
    const w = s * (.09 + .17 * mid), h = s * (.16 + .26 * mid);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-ang + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    void a;
  }
  ctx.restore();
}

// épi de blé
export function wheat(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * .06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, s * .5); ctx.lineTo(0, -s * .42); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = -s * .3 + i * s * .17;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * s * .1, y); ctx.rotate(side * .55);
      ctx.beginPath(); ctx.ellipse(0, 0, s * .075, s * .15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  ctx.beginPath(); ctx.ellipse(0, -s * .45, s * .06, s * .12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function bag(ctx, cx, cy, s, color, lw = .09) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.lineWidth = s * lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * .36, -s * .14); ctx.lineTo(s * .36, -s * .14); ctx.lineTo(s * .3, s * .42); ctx.lineTo(-s * .3, s * .42); ctx.closePath();
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -s * .16, s * .17, Math.PI, 0); ctx.stroke();
  ctx.restore();
}

export function cart(ctx, cx, cy, s, color, lw = .09) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * .45, -s * .35); ctx.lineTo(-s * .3, -s * .35); ctx.lineTo(-s * .18, s * .18); ctx.lineTo(s * .34, s * .18);
  ctx.lineTo(s * .44, -s * .2); ctx.lineTo(-s * .25, -s * .2);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(-s * .12, s * .36, s * .07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * .28, s * .36, s * .07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function menu(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  for (let i = -1; i <= 1; i++) { roundRect(ctx, -s * .4, i * s * .28 - s * .05, s * .8, s * .1, s * .05); ctx.fill(); }
  ctx.restore();
}

export function magnifier(ctx, cx, cy, s, color, lw = .12) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.lineWidth = s * lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-s * .08, -s * .08, s * .28, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * .13, s * .13); ctx.lineTo(s * .4, s * .4); ctx.stroke();
  ctx.restore();
}

export function star(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * .22 : s * .5, a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

export function check(ctx, cx, cy, s, color, lw = .14) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.lineWidth = s * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * .32, 0); ctx.lineTo(-s * .08, s * .24); ctx.lineTo(s * .36, -s * .24); ctx.stroke();
  ctx.restore();
}

export function phone(ctx, cx, cy, s, color) {
  // combiné téléphonique
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.1); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s * .34, -s * .3);
  ctx.quadraticCurveTo(-s * .42, -s * .1, -s * .26, s * .14);
  ctx.quadraticCurveTo(-s * .06, s * .38, s * .2, s * .42);
  ctx.quadraticCurveTo(s * .34, s * .44, s * .38, s * .3);
  ctx.lineTo(s * .22, s * .14);
  ctx.quadraticCurveTo(s * .12, s * .2, s * .04, s * .17);
  ctx.quadraticCurveTo(-s * .1, s * .06, -s * .14, -s * .06);
  ctx.quadraticCurveTo(-s * .16, -s * .14, -s * .06, -s * .2);
  ctx.lineTo(-s * .16, -s * .4);
  ctx.quadraticCurveTo(-s * .26, -s * .42, -s * .34, -s * .3);
  ctx.fill();
  ctx.restore();
}

// bulle de discussion avec combiné (pictogramme de messagerie générique)
export function chatBubble(ctx, cx, cy, s, ring, fill) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, s * .46, Math.PI * .72, Math.PI * .62 + Math.PI * 2 - .05);
  ctx.lineTo(-s * .47, s * .47);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.restore();
  phone(ctx, cx, cy, s * .62, ring);
}

export function pin(ctx, cx, cy, s, color, hole) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -s * .12, s * .3, Math.PI * .85, Math.PI * .15, false);
  ctx.lineTo(0, s * .45); ctx.closePath(); ctx.fill();
  if (hole) { ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(0, -s * .12, s * .12, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function user(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, -s * .15, s * .2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, s * .32, s * .36, s * .24, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
}

// lignes de "texte" stylisées : des mots de longueurs variées, jamais lisibles
export function fauxText(ctx, x, y, width, lineH, lines, color, rnd, opts = {}) {
  ctx.fillStyle = color;
  const h = lineH * (opts.thick ?? .5);
  for (let l = 0; l < lines; l++) {
    let cx = x;
    const lw = l === lines - 1 ? width * (opts.lastLine ?? .6) : width;
    while (cx < x + lw - h) {
      const ww = Math.min(x + lw - cx, h * (1.6 + rnd() * 4.2));
      roundRect(ctx, cx, y + l * lineH, ww, h, h / 2); ctx.fill();
      cx += ww + h * .7;
    }
  }
}

// couverts (restaurant)
export function forkKnife(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = s * .07;
  for (const dx of [-.2, -.12, -.04]) { ctx.beginPath(); ctx.moveTo(dx * s - s * .04, -s * .38); ctx.lineTo(dx * s - s * .04, -s * .12); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-s * .16, -s * .12); ctx.lineTo(-s * .16, s * .4); ctx.stroke();
  ctx.lineWidth = s * .08;
  ctx.beginPath(); ctx.moveTo(-s * .24, -s * .14); ctx.quadraticCurveTo(-s * .16, -s * .02, -s * .08, -s * .14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * .18, -s * .4); ctx.quadraticCurveTo(s * .34, -s * .2, s * .2, s * .02); ctx.lineTo(s * .18, s * .02); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * .19, -s * .02); ctx.lineTo(s * .19, s * .4); ctx.stroke();
  ctx.restore();
}
// voiture (garage)
export function carIcon(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color;
  roundRect(ctx, -s * .44, -s * .02, s * .88, s * .22, s * .07); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * .26, -s * .02); ctx.lineTo(-s * .16, -s * .2); ctx.lineTo(s * .16, -s * .2); ctx.lineTo(s * .28, -s * .02); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(-s * .24, s * .2, s * .11, 0, Math.PI * 2); ctx.arc(s * .24, s * .2, s * .11, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.arc(-s * .24, s * .2, s * .08, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(s * .24, s * .2, s * .08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// marteau (artisan)
export function hammerIcon(ctx, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.7); ctx.fillStyle = color;
  roundRect(ctx, -s * .05, -s * .2, s * .1, s * .62, s * .04); ctx.fill();
  roundRect(ctx, -s * .26, -s * .34, s * .52, s * .16, s * .04); ctx.fill();
  ctx.restore();
}
