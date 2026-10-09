// Typographie cinétique (couche DOM au-dessus du WebGL) : police variable Mona Sans,
// chaque mot entre à l'instant exact où il est prononcé.
import { T, clamp, lerp, prog, eOut5, eExpo, eBack, eIn, eInOut, spring, smooth, GREEN } from './timeline.js';

const LEAD = 0.034; // le mot est déjà lisible sur l'image qui contient son début

let filterId = 0;
function makeBlurFilter(svgDefs) {
  const id = 'mb' + (filterId++);
  const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  f.setAttribute('id', id); f.setAttribute('x', '-50%'); f.setAttribute('y', '-50%');
  f.setAttribute('width', '200%'); f.setAttribute('height', '200%');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  g.setAttribute('stdDeviation', '0 0');
  f.appendChild(g); svgDefs.appendChild(f);
  return { id, node: g };
}

export class Line {
  constructor(parent, cfg, defs) {
    this.cfg = cfg;
    this.el = document.createElement('div');
    this.el.className = 'line';
    this.el.style.fontSize = cfg.size + 'px';
    this.el.style.fontStretch = (cfg.stretch || 100) + '%';
    if (cfg.tracking !== undefined) this.el.style.letterSpacing = cfg.tracking + 'em';
    parent.appendChild(this.el);
    this.words = cfg.words.map((w, i) => {
      const wrap = document.createElement('span');
      wrap.className = 'w';
      const inner = document.createElement('span');
      inner.className = 'wi' + (w.green ? ' green' : '') + (w.pill ? ' pill' : '');
      inner.textContent = w.text;
      if (w.stretch) inner.style.fontStretch = w.stretch + '%';
      if (i > 0 && w.enter === 'stretch') inner.style.transformOrigin = '0% 55%';
      wrap.appendChild(inner);
      this.el.appendChild(wrap);
      if (i < cfg.words.length - 1) wrap.style.marginRight = (cfg.gap ?? .2) + 'em';
      const blur = makeBlurFilter(defs);
      return { ...w, wrap, inner, blur, t0: w.t ?? T[w.id], natural: 0 };
    });
  }
  measure() {
    // ajuste la taille pour tenir dans la largeur utile, puis mémorise la largeur de chaque mot
    const maxW = this.cfg.maxW || 940;
    let width = this.el.scrollWidth;
    if (width > maxW) {
      const k = maxW / width;
      this.cfg.size = Math.floor(this.cfg.size * k);
      this.el.style.fontSize = this.cfg.size + 'px';
    }
    for (const w of this.words) w.natural = w.inner.getBoundingClientRect().width;
    this.width = this.el.scrollWidth;
  }
  update(t) {
    let any = false;
    const gap = this.cfg.gap ?? .2;
    // espaces entre mots : un mot "push" ouvre sa place (et l'espace qui le précède) progressivement
    this.words.forEach((w, i) => {
      const next = this.words[i + 1];
      if (!next) return;
      const kn = next.enter === 'push' ? eOut5(prog(t - next.t0 + LEAD, 0, .3)) : 1;
      w.wrap.style.marginRight = (gap * kn) + 'em';
    });
    for (const w of this.words) {
      const dt = t - w.t0 + LEAD;
      const s = w.inner.style;
      if (dt < 0) {
        s.opacity = 0;
        w.wrap.style.width = w.enter === 'push' ? '0px' : '';
        continue;
      }
      any = true;
      let sx = 1, sy = 1, tx = 0, ty = 0, op = 1, blurX = 0, blurY = 0, rot = 0;
      switch (w.enter) {
        case 'slam': {
          const k = spring(dt, 30, .62);
          const sc = 1 + 1.6 * (1 - k);
          sx = sy = sc; op = clamp(.45 + dt / .05);
          blurX = blurY = 9 * (1 - clamp(dt / .1));
          break;
        }
        case 'stretch': {
          const k = eOut5(prog(dt, 0, .38));
          sx = lerp(1.75, 1, k); sy = lerp(.86, 1, k);
          op = clamp(.4 + dt / .06);
          blurX = 30 * Math.pow(1 - k, 2);
          break;
        }
        case 'rise': {
          const k = eExpo(prog(dt, 0, .32));
          ty = (1 - k) * .55 * this.cfg.size; op = clamp(.35 + dt / .07);
          blurY = 14 * Math.pow(1 - k, 2);
          break;
        }
        case 'drop': {
          const k = spring(dt, 24, .55);
          ty = -(1 - k) * .9 * this.cfg.size; op = clamp(.4 + dt / .05);
          blurY = 18 * (1 - clamp(dt / .14));
          break;
        }
        case 'push': {
          const k = eOut5(prog(dt, 0, .3));
          w.wrap.style.width = (w.natural * k) + 'px';
          tx = (1 - k) * .45 * w.natural; sx = sy = lerp(.55, 1, eBack(prog(dt, 0, .3), 2.2));
          op = clamp(.4 + dt / .06); blurX = 22 * Math.pow(1 - k, 2);
          break;
        }
        case 'pop': {
          const k = eBack(prog(dt, 0, .28), 2.6);
          sx = sy = Math.max(0, k); op = clamp(dt / .05);
          break;
        }
        default: break;
      }
      if (w.enter === 'push' && eOut5(prog(dt, 0, .3)) >= 1) w.wrap.style.width = '';
      // impact lumineux sur les mots-clés verts
      const glow = w.green ? 1 + 1.3 * Math.exp(-dt * 9) : 0;
      s.opacity = op;
      s.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) rotate(${rot}deg)`;
      const bx = Math.max(0, blurX), by = Math.max(0, blurY);
      if (bx > .3 || by > .3) {
        w.blur.node.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
        s.filter = `url(#${w.blur.id})`;
      } else s.filter = '';
      if (w.green && !w.pill) {
        const g = glow;
        s.textShadow = `0 0 ${12 * g}px rgba(22,255,110,${.45 * Math.min(1, g)}), 0 0 ${40 * g}px rgba(22,255,110,${.22 * Math.min(1.5, g)}), 0 10px 40px rgba(0,0,0,.6)`;
      }
    }
    return any;
  }
}

// Une "pile" de lignes : la dernière ligne arrivée se cale sur l'ancre, les anciennes remontent et s'effacent.
export class Stack {
  constructor(root, defs, cfg) {
    this.cfg = cfg;
    this.el = document.createElement('div');
    this.el.className = 'stack';
    root.appendChild(this.el);
    this.inner = document.createElement('div');
    this.inner.className = 'stack-inner';
    this.el.appendChild(this.inner);
    this.lines = cfg.lines.map(l => new Line(this.inner, l, defs));
  }
  measure() {
    this.lines.forEach(l => l.measure());
    // positions verticales empilées (centres)
    let y = 0;
    this.lines.forEach((l, i) => {
      if (i > 0) {
        const prev = this.lines[i - 1];
        y += (prev.cfg.size + l.cfg.size) / 2 * (this.cfg.leading ?? .9) + (l.cfg.spaceBefore || 0);
      }
      l.y = y;
      l.ta = Math.min(...l.words.map(w => w.t0));
    });
  }
  update(t) {
    const c = this.cfg;
    if (c.fixed) {
      this.lines.forEach(l => { l.el.style.top = (c.fixed[this.lines.indexOf(l)] - l.cfg.size * .5) + 'px'; l.update(t); });
      return;
    }
    // défilement : chaque arrivée de ligne cale celle-ci sur l'ancre
    let scroll = c.anchor - this.lines[0].y;
    for (let i = 1; i < this.lines.length; i++) {
      const l = this.lines[i];
      const k = eOut5(prog(t, l.ta - LEAD - .02, l.ta - LEAD + .3));
      scroll = lerp(scroll, c.anchor - l.y, k);
    }
    for (const l of this.lines) {
      const yc = l.y + scroll;
      l.el.style.top = (yc - l.cfg.size * .5) + 'px';
      const top = c.fadeTop ?? 300;
      const vis = smooth(clamp((yc - (top - 120)) / 120));
      l.el.style.opacity = vis;
      l.update(t);
    }
  }
}
