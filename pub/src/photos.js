// "Photos" noir et blanc générées par le code : viennoiseries et pains modélisés en 3D,
// éclairés comme en studio, puis développés (grain, vignettage) dans des canvas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .35;
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
  const M = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .5, metalness: 0, ...o });
  const mat = {
    paint: M(0x161616, { metalness: .6, roughness: .22, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 2.2 }),
    glass: M(0x030303, { roughness: .05, metalness: .2, clearcoat: 1, envMapIntensity: 2.5 }),
    tire: M(0x141414, { roughness: .9 }), rim: M(0xcfcfcf, { metalness: 1, roughness: .18, envMapIntensity: 2 }),
    steel: M(0xc8c8c8, { metalness: 1, roughness: .28, envMapIntensity: 2 }), rubber: M(0x232323, { roughness: .7 }),
    wood: M(0x8c8c8c, { roughness: .6, map: crustTex(R) }), light: M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 2 }),
    bun: M(0xb4b4b4, { roughness: .45, map: crustTex(R) }), patty: M(0x353535, { roughness: .85, map: crustTex(R, .3) }),
    cheese: M(0xe2e2e2, { roughness: .3 }), salad: M(0x9c9c9c, { roughness: .55 }), tomato: M(0x6e6e6e, { roughness: .25 }),
    plate: M(0xf2f2f2, { roughness: .15, clearcoat: 1 }), sesame: M(0xf0f0f0, { roughness: .4 }),
    dough: M(0xc6c6c6, { roughness: .6, map: crustTex(R, .4) }), sauce: M(0x575757, { roughness: .35 }),
    pep: M(0x333333, { roughness: .4 }), carton: M(0x1c1c1c, { roughness: .6 }), band: M(0xe8e8e8, { roughness: .5 }),
    fry: M(0xd6d6d6, { roughness: .55, map: crustTex(R) }), tape: M(0xe6e6e6, { roughness: .4 }),
  };
  const G = new THREE.Group();
  const part = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || group).add(o); return o; };
  function car(x, z, ry, sc = 1) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; c.scale.setScalar(sc); group.add(c);
    part(new RoundedBoxGeometry(4.6, .78, 2.0, 6, .32), mat.paint, 0, .78, 0, c);
    part(new RoundedBoxGeometry(2.5, .78, 1.78, 6, .36), mat.glass, -.25, 1.42, 0, c);
    part(new RoundedBoxGeometry(2.2, .12, 1.7, 4, .06), mat.paint, -.3, 1.83, 0, c);
    part(new RoundedBoxGeometry(.08, .2, 1.4, 2, .04), mat.rubber, 2.3, .7, 0, c);
    for (const zz of [-.72, .72]) part(new RoundedBoxGeometry(.12, .14, .42, 2, .05), mat.light, 2.28, .92, zz, c);
    for (const [wx, wz] of [[1.45, 1.0], [-1.45, 1.0], [1.45, -1.0], [-1.45, -1.0]]) {
      const t = part(new THREE.TorusGeometry(.42, .2, 16, 40), mat.tire, wx, .55, wz, c);
      const r = part(new THREE.CylinderGeometry(.34, .34, .14, 28), mat.rim, wx, .55, wz + Math.sign(wz) * .06, c); r.rotation.x = Math.PI / 2;
      void t;
    }
    return c;
  }
  function wheel(x, y, z, ry, sc = 1) {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = ry; w.scale.setScalar(sc); group.add(w);
    part(new THREE.TorusGeometry(1.05, .48, 24, 64), mat.tire, 0, 0, 0, w);
    const rim = part(new THREE.CylinderGeometry(.9, .9, .3, 48), mat.rim, 0, 0, 0, w); rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const sp = part(new THREE.BoxGeometry(.16, .82, .12), mat.steel, 0, 0, .2, w); sp.rotation.z = i * Math.PI * 2 / 5; sp.position.set(Math.sin(i * Math.PI * 2 / 5) * .4, Math.cos(i * Math.PI * 2 / 5) * .4, .2); }
    const cap = part(new THREE.CylinderGeometry(.22, .22, .3, 24), mat.steel, 0, 0, .22, w); cap.rotation.x = Math.PI / 2;
    return w;
  }
  function wrench(x, z, ry, sc = 1) {
    const w = new THREE.Group(); w.position.set(x, .1, z); w.rotation.y = ry; w.scale.setScalar(sc); group.add(w);
    part(new RoundedBoxGeometry(3.2, .12, .42, 3, .05), mat.steel, 0, 0, 0, w);
    const h1 = part(new THREE.TorusGeometry(.42, .16, 12, 32, Math.PI * 1.55), mat.steel, 1.9, 0, 0, w); h1.rotation.set(-Math.PI / 2, 0, Math.PI * .22);
    const h2 = part(new THREE.TorusGeometry(.36, .14, 12, 32), mat.steel, -1.85, 0, 0, w); h2.rotation.x = -Math.PI / 2;
    return w;
  }
  function hammer(x, z, ry, sc = 1) {
    const h = new THREE.Group(); h.position.set(x, .22, z); h.rotation.y = ry; h.scale.setScalar(sc); group.add(h);
    const handle = part(new THREE.CylinderGeometry(.14, .17, 3.4, 16), mat.wood, 0, 0, 0, h); handle.rotation.z = Math.PI / 2;
    const grip = part(new THREE.CylinderGeometry(.2, .2, 1.2, 16), mat.rubber, -1.1, 0, 0, h); grip.rotation.z = Math.PI / 2;
    part(new RoundedBoxGeometry(.5, .5, 1.5, 3, .06), mat.steel, 1.75, .02, .1, h);
    return h;
  }
  function screwdriver(x, z, ry, sc = 1) {
    const d = new THREE.Group(); d.position.set(x, .2, z); d.rotation.y = ry; d.scale.setScalar(sc); group.add(d);
    const hd = part(new THREE.CylinderGeometry(.22, .2, 1.2, 8), mat.rubber, -.8, 0, 0, d); hd.rotation.z = Math.PI / 2;
    const sh = part(new THREE.CylinderGeometry(.06, .06, 1.7, 12), mat.steel, .65, 0, 0, d); sh.rotation.z = Math.PI / 2;
    part(new THREE.BoxGeometry(.18, .03, .1), mat.steel, 1.52, 0, 0, d);
    return d;
  }
  function tapeMeasure(x, z, ry, sc = 1) {
    const t = new THREE.Group(); t.position.set(x, .5, z); t.rotation.y = ry; t.scale.setScalar(sc); group.add(t);
    part(new RoundedBoxGeometry(1.2, 1.2, .55, 5, .22), mat.rubber, 0, 0, 0, t);
    const c = part(new THREE.CylinderGeometry(.32, .32, .6, 24), mat.steel, 0, 0, 0, t); c.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(2.4, .02, .26), mat.tape, 1.6, -.48, 0, t);
    return t;
  }
  function burger(x, z, sc = 1) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.scale.setScalar(sc); group.add(b);
    const bot = part(new THREE.SphereGeometry(1.6, 64, 32), mat.bun, 0, .32, 0, b); bot.scale.y = .26;
    const pg = new THREE.CylinderGeometry(1.75, 1.75, .44, 64, 4); { const p = pg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + .05 * n(v.x * 3, v.y * 3, v.z * 3); p.setXYZ(i, v.x * k, v.y, v.z * k); } pg.computeVertexNormals(); }
    part(pg, mat.patty, 0, .74, 0, b);
    const cg = new THREE.BoxGeometry(3.3, .05, 3.3, 30, 1, 30); { const p = cg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = Math.hypot(v.x, v.z); if (d > 1.55) v.y -= (d - 1.55) * .7; p.setXYZ(i, v.x, v.y, v.z); } cg.computeVertexNormals(); }
    part(cg, mat.cheese, 0, 1.0, 0, b).rotation.y = Math.PI / 4;
    const lg = new THREE.CylinderGeometry(1.95, 1.95, .07, 120, 1); { const p = lg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), d = Math.hypot(v.x, v.z); if (d > .1) { const k = 1 + .08 * Math.sin(a * 11); v.x *= k; v.z *= k; v.y += Math.sin(a * 7) * .07 * (d / 1.95); } p.setXYZ(i, v.x, v.y, v.z); } lg.computeVertexNormals(); }
    part(lg, mat.salad, 0, 1.08, 0, b);
    part(new THREE.CylinderGeometry(.85, .85, .14, 32), mat.tomato, .5, 1.17, .2, b); part(new THREE.CylinderGeometry(.8, .8, .14, 32), mat.tomato, -.6, 1.16, -.3, b);
    const top = part(new THREE.SphereGeometry(1.72, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), mat.bun, 0, 1.22, 0, b); top.scale.y = .66;
    for (let i = 0; i < 46; i++) {
      const th = R() * Math.PI * 2, ph = Math.acos(1 - R() * .82);
      const sx = Math.sin(ph) * Math.cos(th) * 1.72, sz = Math.sin(ph) * Math.sin(th) * 1.72, sy = Math.cos(ph) * 1.72 * .66 + 1.22;
      const sd = part(new THREE.SphereGeometry(.07, 8, 6), mat.sesame, sx, sy, sz, b); sd.scale.set(.7, .45, 1.4); sd.rotation.y = R() * 3;
    }
    return b;
  }
  function plate(x, z, r = 3.2) { part(new THREE.CylinderGeometry(r, r * .86, .14, 96), mat.plate, x, .07, z); }
  function pizza(x, z, sc = 1) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(sc); group.add(p);
    part(new THREE.CylinderGeometry(2.7, 2.7, .1, 96), mat.dough, 0, .08, 0, p);
    const cr = part(new THREE.TorusGeometry(2.58, .22, 16, 96), mat.dough, 0, .16, 0, p); cr.rotation.x = Math.PI / 2;
    part(new THREE.CylinderGeometry(2.42, 2.42, .03, 96), mat.sauce, 0, .15, 0, p);
    for (let i = 0; i < 22; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 2.1; const c = part(new THREE.SphereGeometry(.42 + R() * .25, 16, 10), mat.cheese, Math.cos(a) * d, .17, Math.sin(a) * d, p); c.scale.y = .12; }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R() * .3, d = i % 3 === 0 ? .6 : 1.6; part(new THREE.CylinderGeometry(.34, .34, .05, 24), mat.pep, Math.cos(a) * d, .22, Math.sin(a) * d, p); }
    return p;
  }
  function fries(x, z, sc = 1) {
    const f = new THREE.Group(); f.position.set(x, 0, z); f.scale.setScalar(sc); group.add(f);
    const box = part(new THREE.CylinderGeometry(1.0, .72, 1.7, 4, 1, true), mat.carton, 0, .85, 0, f); box.rotation.y = Math.PI / 4; box.material.side = THREE.DoubleSide;
    const band = part(new THREE.CylinderGeometry(.92, .84, .4, 4, 1, true), mat.band, 0, .9, 0, f); band.rotation.y = Math.PI / 4; band.scale.setScalar(1.02);
    for (let i = 0; i < 30; i++) { const fr = part(new THREE.BoxGeometry(.13, 1.7, .13), mat.fry, (R() - .5) * 1.0, 1.55 + R() * .35, (R() - .5) * 1.0, f); fr.rotation.set((R() - .5) * .5, R() * 3, (R() - .5) * .5); }
    return f;
  }

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
    heroGarage: { w: 1400, h: 640, cam: [4.4, 1.5, 6.6], look: [-.4, .85, 0], fov: 34, build() { car(0, 0, .3); } },
    car2: { w: 520, h: 400, cam: [-6.4, 3, 6.4], look: [0, .9, 0], fov: 34, build() { car(0, 0, -.3); } },
    wheel: { w: 520, h: 400, cam: [2.4, 2.2, 6.2], look: [0, 1.4, 0], fov: 34, build() { wheel(0, 1.53, 0, .45); } },
    wrench: { w: 520, h: 400, cam: [0, 5.2, 4.4], look: [0, 0, 0], fov: 36, build() { wrench(0, -.3, .35); screwdriver(-.2, .9, -.25); } },
    heroResto: { w: 1400, h: 640, cam: [0, 5.6, 9.2], look: [0, .9, 0], fov: 34, build() { plate(-.4, .4); burger(-.4, .4, .95); fries(-4.2, -.6, 1.1); pizza(4.2, -.4, .95); } },
    burger: { w: 520, h: 400, cam: [0, 3.4, 6.2], look: [0, 1.0, 0], fov: 34, build() { plate(0, 0); burger(0, 0, 1); } },
    pizza: { w: 520, h: 400, cam: [0, 6.2, 4.8], look: [0, 0, 0], fov: 38, build() { pizza(0, 0, 1); } },
    fries: { w: 520, h: 400, cam: [0, 3.2, 6.0], look: [0, 1.4, 0], fov: 34, build() { fries(0, 0, 1.2); } },
    heroArtisan: { w: 1400, h: 640, cam: [0, 4.4, 5.2], look: [-.4, 0, .3], fov: 36, build() { hammer(-2.4, .3, .4); wrench(1.6, -.6, -.3, .9); screwdriver(2.0, 1.3, .2); tapeMeasure(-4.6, -1.2, .6, .9); screwdriver(-.6, 1.8, -.1, .9); } },
    hammer: { w: 520, h: 400, cam: [0, 4.6, 5.2], look: [0, 0, 0], fov: 36, build() { hammer(0, 0, .45); } },
    screwdrivers: { w: 520, h: 400, cam: [0, 4.6, 4.6], look: [0, 0, 0], fov: 36, build() { screwdriver(0, -.6, .2); screwdriver(.1, 0, .15, .9); screwdriver(.2, .6, .1, .8); } },
    tape: { w: 520, h: 400, cam: [1, 3.4, 4.8], look: [.6, .4, 0], fov: 36, build() { tapeMeasure(0, 0, .3); } },
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
