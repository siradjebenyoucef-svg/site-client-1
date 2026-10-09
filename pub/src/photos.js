// "Photos" noir et blanc générées par le code : viennoiseries et pains modélisés en 3D,
// éclairés comme en studio, puis développés (grain, vignettage) dans des canvas.
import * as THREE from 'three';
import { rng } from './timeline.js';

function noise3(R) {
  // bruit de valeur 3D déterministe, suffisant pour la croûte
  const P = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const V = new Float32Array(256).map(() => R() * 2 - 1);
  const f = t => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = f(x - X), v = f(y - Y), w = f(z - Z);
    const h = (i, j, k) => V[P[(P[(P[(X + i) & 255] + Y + j) & 255] + Z + k) & 255]];
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
}

function croissantGeo(n) {
  // tube en croissant de lune, rayon modulé par des rouleaux en spirale
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (.08 + .84 * i / 40);
    pts.push(new THREE.Vector3(Math.cos(a) * 2.1, 0, -Math.sin(a) * 1.25));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const TS = 260, RS = 72;
  const geo = new THREE.TubeGeometry(curve, TS, 1, RS, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    const u = i / TS;
    curve.getPointAt(u, c);
    const mid = Math.sin(Math.PI * u);
    for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j;
      const th = j / RS * Math.PI * 2;
      p.fromBufferAttribute(pos, k).sub(c);
      // rouleaux : sillons en spirale
      const roll = Math.pow(Math.abs(Math.sin(u * 7 * Math.PI + th * 1.0)), .45);
      let r = (.16 + .86 * Math.pow(mid, .85)) * (.82 + .18 * roll);
      r *= 1 + .025 * n(p.x * 3 + u * 9, p.y * 3, p.z * 3) + .012 * n(u * 90, th * 3, 0);
      p.multiplyScalar(r);
      p.y *= 1.05;
      if (p.y < 0) p.y *= .55;         // dessous aplati
      p.add(c);
      p.y += mid * .25;
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function loafGeo(len, ry, rz, n, sculpt) {
  const geo = new THREE.SphereGeometry(1, 220, 96);
  geo.rotateZ(Math.PI / 2); // pôles sur l'axe x
  const pos = geo.attributes.position, p = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    p.fromBufferAttribute(pos, k);
    const u = p.x; // -1..1 le long du pain
    const dir = Math.hypot(p.y, p.z) || 1e-6;
    const r = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 7)), .5) * (1 - .1 * Math.pow(Math.abs(u), 2));
    let y = p.y / dir * r * ry, z = p.z / dir * r * rz;
    if (y < 0) y *= .45;
    p.set(u * len, y, z);
    sculpt && sculpt(p, u);
    p.multiplyScalar(1 + .012 * n(p.x * 5, p.y * 5, p.z * 5));
    pos.setXYZ(k, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function baguetteGeo(n) {
  return loafGeo(3.7, .55, .5, n, (p) => {
    if (p.y > .08) {
      for (let s = -2; s <= 2; s++) {
        const d = ((p.x - s * 1.3) - p.z * 2.1) * .9;
        if (Math.abs(p.x - s * 1.3) > .9) continue;
        const g = Math.exp(-d * d * 18);
        const lip = Math.exp(-(d + .22) * (d + .22) * 40);
        p.y -= g * .2 * (p.y / .55);
        p.y += lip * .07;
      }
    }
  });
}

function eclairGeo(n) {
  return loafGeo(1.75, .5, .46, n, null);
}

function bouleGeo(n) {
  const geo = new THREE.SphereGeometry(1.7, 160, 96);
  const pos = geo.attributes.position, p = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    p.fromBufferAttribute(pos, k);
    p.y *= .62;
    if (p.y < -.3) p.y = -.3 + (p.y + .3) * .25;
    if (p.y > .2) {
      // entaille en croix qui s'ouvre
      const a = Math.min(Math.abs(p.x), Math.abs(p.z));
      const g = Math.exp(-a * a * 40);
      const lip = Math.exp(-(a - .16) * (a - .16) * 70);
      p.y -= g * .22 * (p.y / 1.05); p.y += lip * .06;
    }
    p.multiplyScalar(1 + .018 * n(p.x * 5, p.y * 5, p.z * 5));
    pos.setXYZ(k, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// texture de croûte (variations de teinte, farine)
function crustTex(R, flour = .0) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 110 + R() * 90 | 0; ctx.fillStyle = `rgba(${v},${v},${v},.25)`;
    ctx.beginPath(); ctx.arc(R() * 512, R() * 512, 1 + R() * 6, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 900 * flour; i++) {
    ctx.fillStyle = `rgba(255,255,255,${.2 + R() * .4})`; ctx.beginPath(); ctx.arc(R() * 512, R() * 512, .5 + R() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function woodTex(R) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 2) {
    const v = 26 + Math.sin(y * .05 + Math.sin(y * .013) * 4) * 6 + R() * 8 | 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, y, 1024, 2);
  }
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, i * 114 + 112, 1024, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function makePhotos(renderer) {
  const R = rng(99);
  const n = noise3(R);
  const crust = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, map: crustTex(R, .2), roughness: .62, metalness: 0 });
  const glazed = new THREE.MeshStandardMaterial({ color: 0xa8a8a8, map: crustTex(R), roughness: .38, metalness: 0 });
  const floury = new THREE.MeshStandardMaterial({ color: 0xc4c4c4, map: crustTex(R, 1), roughness: .8 });
  const choc = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .22 });
  const geos = { croissant: croissantGeo(n), baguette: baguetteGeo(n), boule: bouleGeo(n), eclair: eclairGeo(n) };
  const chocGeo = loafGeo(1.62, .3, .4, n, null);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: woodTex(R), roughness: .7 }));
  table.material.map.repeat.set(3, 3);
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(-7, 7, 2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); key.shadow.radius = 6; key.shadow.bias = -.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2.6); rim.position.set(6, 5, -8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, .18));
  const group = new THREE.Group(); scene.add(group);

  const mk = (geo, mat, x, y, z, ry = 0, s = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(s);
    m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  };
  const shots = {
    hero: { w: 1400, h: 640, cam: [0, 5.2, 9.5], look: [0, .4, 0], fov: 34, build() {
      mk(geos.baguette, crust, -1.2, .45, -1.4, .35, 1);
      mk(geos.baguette, crust, -.6, .45, -.3, .18, 1);
      mk(geos.croissant, glazed, 2.4, .32, .9, -.5, .95);
      mk(geos.croissant, glazed, -2.6, .32, 1.6, 2.6, .85);
      mk(geos.boule, floury, 3.6, .58, -1.8, .3, .9);
      mk(geos.eclair, glazed, .6, .3, 2.2, -.2, .9); mk(chocGeo, choc, .6, .62, 2.2, -.2, .9).scale.y = .4;
    } },
    croissant: { w: 520, h: 400, cam: [0, 4.6, 5.4], look: [0, .3, -.1], fov: 36, build() { mk(geos.croissant, glazed, 0, .32, .3, 0, 1.1); } },
    baguette: { w: 520, h: 400, cam: [0, 5.4, 6.4], look: [0, .3, 0], fov: 38, build() { mk(geos.baguette, crust, 0, .45, -.5, .5, 1); mk(geos.baguette, crust, .2, .45, .7, .42, 1); } },
    boule: { w: 520, h: 400, cam: [0, 4.4, 5.4], look: [0, .4, 0], fov: 36, build() { mk(geos.boule, floury, 0, .58, 0, .4, 1.05); } },
    eclair: { w: 520, h: 400, cam: [0, 3.6, 4.6], look: [0, .3, 0], fov: 36, build() {
      mk(geos.eclair, glazed, 0, .3, .5, -.3, 1); mk(chocGeo, choc, 0, .62, .5, -.3, 1).scale.y = .4;
      mk(geos.eclair, glazed, .3, .3, -.9, -.25, 1); mk(chocGeo, choc, .3, .62, -.9, -.25, 1).scale.y = .4;
    } },
  };
  const out = {};
  const prevTarget = renderer.getRenderTarget();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = true;
  for (const [name, s] of Object.entries(shots)) {
    while (group.children.length) group.remove(group.children[0]);
    s.build();
    const cam = new THREE.PerspectiveCamera(s.fov, s.w / s.h, .1, 100);
    cam.position.set(...s.cam); cam.lookAt(new THREE.Vector3(...s.look));
    const rt = new THREE.WebGLRenderTarget(s.w, s.h, { samples: 4 });
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const buf = new Uint8Array(s.w * s.h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, s.w, s.h, buf);
    const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(s.w, s.h);
    // retournement vertical + passage en niveaux de gris + courbe "argentique" + grain
    const RR = rng(name.length * 77);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const si = ((s.h - 1 - y) * s.w + x) * 4, di = (y * s.w + x) * 4;
      let v = (buf[si] * .3 + buf[si + 1] * .59 + buf[si + 2] * .11) / 255;
      v = Math.pow(v, 1 / 2.2);                         // linéaire -> écran
      v = v * v * (3 - 2 * v) * .85 + v * .15;           // contraste en S
      const dx = x / s.w - .5, dy = y / s.h - .5;
      v *= 1 - .55 * Math.pow(Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.35), 2.2);
      v += (RR() - .5) * .06;
      const g = Math.max(0, Math.min(255, v * 255));
      img.data[di] = img.data[di + 1] = img.data[di + 2] = g; img.data[di + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blur = document.createElement('canvas'); blur.width = s.w; blur.height = s.h;
    const bctx = blur.getContext('2d'); bctx.filter = `blur(${Math.round(s.w / 130)}px)`; bctx.drawImage(c, 0, 0);
    const mask = document.createElement('canvas'); mask.width = s.w; mask.height = s.h;
    const mctx = mask.getContext('2d');
    const gr = mctx.createLinearGradient(0, 0, 0, s.h); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.42, 'rgba(0,0,0,0)'); gr.addColorStop(.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)');
    mctx.fillStyle = gr; mctx.fillRect(0, 0, s.w, s.h);
    mctx.globalCompositeOperation = 'source-in'; mctx.drawImage(blur, 0, 0);
    ctx.drawImage(mask, 0, 0);
    out[name] = c;
    rt.dispose();
  }
  renderer.setRenderTarget(prevTarget);
  renderer.shadowMap.enabled = prevShadow;
  return out;
}
