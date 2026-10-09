// Point d'entrée : construit les scènes et expose renderFrame(t) pour le rendu image par image.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H, FPS, DURATION, T, setWords, clamp, lerp, prog, eOut, eIn, eInOut, eExpo, eInExpo, pulse, noise1, rng, smooth } from './timeline.js';
import { Post } from './post.js';
import { Stack } from './type.js';
import { beats } from './copy.js';
import { createCity } from './scenes/city.js';

async function boot() {
  // timings recalés sur la vraie voix si disponibles
  try {
    const r = await fetch('timings.json');
    if (r.ok) setWords(await r.json());
  } catch (e) { /* valeurs du brief */ }

  await document.fonts.load('900 100px Mona');
  await document.fonts.ready;

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  // ?preview : aperçu rapide en demi-résolution (même cadrage)
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const RW = PREVIEW ? W / 2 : W, RH = PREVIEW ? H / 2 : H;
  renderer.setPixelRatio(1);
  renderer.setSize(RW, RH, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  const post = new Post(renderer, RW, RH);
  const city = createCity(env);
  const mods = await Promise.all([
    import('./scenes/key.js').catch(() => null),
    import('./scenes/devices.js').catch(() => null),
    import('./scenes/cta.js').catch(() => null),
  ]);
  const key = mods[0] ? mods[0].createKey(env, renderer) : null;
  const devices = mods[1] ? await mods[1].createDevices(env, renderer) : null;
  const cta = mods[2] ? mods[2].createCta(env, renderer) : null;
  const empty = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), update() {} };

  // typographie
  const typeRoot = document.getElementById('type');
  const defs = document.getElementById('defs');
  const B = beats();
  const stacks = {};
  for (const [name, cfg] of Object.entries(B)) {
    stacks[name] = new Stack(typeRoot, defs, cfg);
    stacks[name].el.classList.add(name);
    stacks[name].measure();
  }

  const shade = document.getElementById('shade');
  const flash = document.getElementById('flash');
  const wipe = document.getElementById('wipe');
  const hud = document.getElementById('hud');
  const grain = document.getElementById('grain');
  const gctx = grain.getContext('2d');
  const gimg = gctx.createImageData(grain.width, grain.height);

  function drawGrain(frame) {
    const R = rng(frame * 7919 + 13);
    const d = gimg.data;
    for (let i = 0; i < d.length; i += 4) { const v = (R() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }

  const scenes = { city, key: key || empty, devices: devices || empty, cta: cta || empty };
  const kh = { x: 540, y: 960 };

  function sceneAt(t) {
    if (t < T.site2 - .02) return 'city';
    if (t < T.un - .01) return 'key';
    if (t < T.devis - .03) return 'devices';
    return 'cta';
  }

  window.renderFrame = (t, frame = Math.round(t * FPS)) => {
    post.reset();
    const name = sceneAt(t);
    const s = scenes[name];
    s.update(t, post, { hud });
    if ((window.DBG || {}).noPost) { renderer.setRenderTarget(null); renderer.render(s.scene, s.camera); }
    else post.render(s.scene, s.camera, frame);

    // ---------- typographie ----------
    for (const [n, st] of Object.entries(stacks)) {
      const cfg = B[n];
      const on = t >= cfg.tIn && t < cfg.tOut;
      st.el.style.display = on ? '' : 'none';
      if (!on) continue;
      st.el.style.opacity = 1; st.el.style.transform = ''; st.el.style.filter = '';
      st.update(t);
    }
    // sortie du temps 1 : on traverse le texte pendant que la caméra s'envole
    {
      const u = prog(t, T.pendant - .1, T.pendant + .1);
      const st = stacks.b1.el;
      if (u > 0) {
        st.style.transformOrigin = '540px 640px';
        st.style.transform = `translateY(${-eIn(u) * 260}px) scale(${1 + eIn(u) * 1.6})`;
        st.style.opacity = 1 - eIn(u);
        st.style.filter = `blur(${eIn(u) * 16}px)`;
      }
    }
    // sortie du temps 2 : le texte est aspiré dans la serrure
    {
      const u = prog(t, T.google + .38, T.site2 - .08);
      const st = stacks.b2.el;
      if (u > 0 && city.keyholeScreen) {
        city.keyholeScreen(Math.min(t, T.site2 - .1), kh);
        st.style.transformOrigin = `${kh.x}px ${kh.y}px`;
        st.style.transform = `scale(${1 - eInExpo(u) * .97})`;
        st.style.opacity = 1 - eIn(u);
        st.style.filter = `blur(${eIn(u) * 10}px)`;
      }
    }
    // secousse de la typo sur les impacts
    const shk = 10 * pulse(t, T.votre, 10) + 6 * pulse(t, T.pas, 12) + 14 * pulse(t, T.cle, 9) + 8 * pulse(t, T.devis, 10);
    typeRoot.style.transform = shk > .2 ? `translate(${noise1(t * 40, 3) * shk}px, ${noise1(t * 40, 4) * shk}px)` : '';

    // assombrissement derrière le texte au-dessus de la ville
    shade.style.opacity = name === 'city' ? clamp(prog(t, T.pendant - .07, T.pendant + .63)) * .95 + (t < T.pendant - .07 ? .35 : 0) : name === 'devices' ? .55 : 0;

    // flash plein écran (au-dessus de tout)
    let fl = 0;
    flash.style.background = '#fff';
    fl += .1 * pulse(t, T.pas, 20);
    flash.style.opacity = clamp(fl);

    // volet vert entre le temps 4 et le temps 5 : il couvre tout l'écran à l'instant du changement de scène
    {
      const tc = T.devis - .027;
      const u1 = prog(t, tc - .15, tc), u2 = prog(t, tc, tc + .17);
      const HB = 2400, SK = 260;
      const y = t < tc ? lerp(-HB - 300, -330, eIn(u1)) : lerp(-330, 2150, eOut(u2));
      const on = t > tc - .16 && t < tc + .18;
      wipe.style.display = on ? '' : 'none';
      if (on) {
        wipe.style.background = '#16ff6e';
        wipe.style.clipPath = `polygon(0px ${y + SK}px, 1080px ${y}px, 1080px ${y + HB}px, 0px ${y + HB + SK}px)`;
      }
    }
    if (scenes[name].overlay) scenes[name].overlay(t, { flash, wipe, hud, shade });

    const D = window.DBG || {};
    grain.style.display = D.noGrain ? 'none' : '';
    typeRoot.style.display = D.noType ? 'none' : '';
    if (!D.noGrain) drawGrain(frame);
  };

  window.DURATION = DURATION; // (mis à jour par setWords si timings.json est présent)
  // passages rapides où l'on calcule un vrai flou de bougé (plusieurs sous-images par image)
  window.FAST = [[T.pendant - .1, T.vos1 + .15], [T.google + .3, T.site2 + .35], [T.cle - .05, T.cle + .3],
    [T.un - .12, T.un + .3], [T.moderne - .05, T.moderne + .35], [T.devis - .22, T.devis + .15]];
  window.FPS = FPS;
  window.ready = true;
}

boot().catch(e => { console.error(e); window.bootError = String(e && e.stack || e); });
