// Temps 1 et 2 : la boutique éteinte, puis la ville où les clients filent chez les concurrents.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T, clamp, lerp, prog, eOut, eOut5, eIn, eInOut, eBack, eExpo, eInExpo, smooth, spring, pulse, rng, noise1, GREEN_HEX } from '../timeline.js';
import { bag, roundRect } from '../icons.js';

const P = 21, BLOCK = 14;               // pas de la grille et taille d'un îlot
const SHOP_Z = -2;                      // façade de notre boutique
const DOOR = new THREE.Vector3(2.15, 1.32, SHOP_Z + .1); // serrure de la porte

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.ctx = ctx; t.userData.canvas = c;
  return t;
}

// matériau "maquette blanche" avec fenêtres procédurales (éclairées la nuit)
function windowMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: .92, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uLit = uniforms.uLit;
    sh.uniforms.uCenter = uniforms.uCenter;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        wp4 = modelMatrix * wp4; vWPos = wp4.xyz;
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWNorm = normalize(mat3(modelMatrix) * wn);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNorm; uniform float uLit; uniform vec2 uCenter;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vWNorm.y) < .5) {
          float u = abs(vWNorm.x) > .5 ? vWPos.z : vWPos.x;
          vec2 g = vec2(u / 1.9, (vWPos.y - .6) / 2.6);
          vec2 f = fract(g); vec2 cell = floor(g);
          float win = step(.22, f.x) * step(f.x, .78) * step(.28, f.y) * step(f.y, .8) * step(1., cell.y);
          float side = abs(vWNorm.x) > .5 ? sign(vWNorm.x) * 7.1 : sign(vWNorm.z) * 3.3;
          float r = h21(cell + vec2(side, floor(vWPos.x * .07) + floor(vWPos.z * .07) * 13.));
          float dist = length(vWPos.xz - uCenter);
          float on = step(r, .42) * smoothstep(0., 1., clamp(uLit * 2.2 - dist / 70. - r * .6, 0., 1.));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.035), win);
          totalEmissiveRadiance += win * on * vec3(1.0, .98, .92) * (.55 + r);
        }`);
  };
  return m;
}

export function createCity(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, .0105);
  scene.environment = env;
  scene.environmentIntensity = .25;
  const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, .03, 600);
  const R = rng(7);
  const uniforms = { uLit: { value: 0 }, uCenter: { value: new THREE.Vector2(0, -10) } };

  // ---------- lumière ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, .22); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xffffff, 1.6);
  moon.position.set(-30, 60, 25); moon.target.position.set(0, 0, -12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1536, 1536);
  Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
  moon.shadow.bias = -.0006; moon.shadow.normalBias = .04;
  scene.add(moon, moon.target);

  // ---------- sol, rues, îlots ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: .55, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const slabMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .95 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xd2d2d2, roughness: .9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .55, metalness: .1 });
  const winMat = windowMaterial(uniforms);

  const blocks = [];
  for (let i = -3; i <= 3; i++) for (let j = -5; j <= 2; j++) blocks.push([i, j]);
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), slabMat, blocks.length);
  const mtx = new THREE.Matrix4();
  blocks.forEach(([i, j], k) => {
    mtx.compose(new THREE.Vector3(i * P, .08, j * P - BLOCK / 2), new THREE.Quaternion(), new THREE.Vector3(BLOCK, .16, BLOCK));
    slabs.setMatrixAt(k, mtx);
  });
  slabs.receiveShadow = true; scene.add(slabs);

  // marquages au sol (pointillés blancs)
  const dashes = [];
  for (let j = -5; j <= 2; j++) for (let x = -80; x <= 80; x += 3.2) dashes.push([x, j * P + 3.5, 0]);
  for (let i = -3; i <= 3; i++) for (let z = -115; z <= 50; z += 3.2) dashes.push([i * P + 10.5, z, 1]);
  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: .7 }), dashes.length);
  dashes.forEach(([x, z, v], k) => {
    mtx.compose(new THREE.Vector3(x, .012, z), new THREE.Quaternion(), v ? new THREE.Vector3(.16, .02, 1.4) : new THREE.Vector3(1.4, .02, .16));
    dashMesh.setMatrixAt(k, mtx);
  });
  scene.add(dashMesh);

  // ---------- immeubles génériques ----------
  const special = new Set(['0,0', '-1,-1', '1,-1', '0,-1']);
  const bld = [];
  for (const [i, j] of blocks) {
    const cx = i * P, cz = j * P - BLOCK / 2;
    const lots = [];
    const nx = 2 + (R() > .5 ? 1 : 0), nz = 2;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const w = (BLOCK - 4) / nx, d = (BLOCK - 4) / nz;
      lots.push([cx - (BLOCK - 4) / 2 + w * (a + .5), cz - (BLOCK - 4) / 2 + d * (b + .5), w - .35, d - .35, b === nz - 1, a]);
    }
    for (const [x, z, w, d, front, a] of lots) {
      if (special.has(`${i},${j}`) && front) continue; // façade réservée à une boutique
      if (i === 0 && j === 0) continue;
      if (j === 1 && Math.abs(i) <= 1) continue;          // place dégagée face à notre vitrine
      const far = Math.hypot(x, z + 15);
      const h = 5 + R() * 13 + (far > 50 ? R() * 10 : 0);
      bld.push([x, h / 2 + .16, z, w, h, d]);
    }
  }
  const bMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), winMat, bld.length);
  bld.forEach(([x, y, z, w, h, d], k) => { mtx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); bMesh.setMatrixAt(k, mtx); });
  bMesh.castShadow = true; bMesh.receiveShadow = true; scene.add(bMesh);

  // toits : petits volumes techniques pour la richesse de la maquette
  const roofs = [];
  bld.forEach(([x, y, z, w, h, d]) => { if (R() > .45) roofs.push([x + (R() - .5) * w * .4, y + h / 2 + .45, z + (R() - .5) * d * .4, w * .3, .9, d * .3]); });
  const rMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay, roofs.length);
  roofs.forEach(([x, y, z, w, h, d], k) => { mtx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); rMesh.setMatrixAt(k, mtx); });
  rMesh.castShadow = true; scene.add(rMesh);

  // arbres de la place (premier plan en parallaxe pour la caméra du temps 1)
  const trunkGeo = new THREE.CylinderGeometry(.12, .18, 2.6, 8), crownGeo = new THREE.IcosahedronGeometry(1.5, 1);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 1, flatShading: true });
  const treeSpots = [];
  for (let i = -1; i <= 1; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (i === 0 && !(b === 2 && a !== 1)) continue;     // axe de la caméra dégagé
    treeSpots.push([i * P - 4.6 + a * 4.6 + (R() - .5), 21 - BLOCK + 2.6 + b * 4.4 + (R() - .5)]);
  }
  for (const [x, z] of treeSpots) {
    const tr = new THREE.Mesh(trunkGeo, dark); tr.position.set(x, 1.45, z); tr.castShadow = true; scene.add(tr);
    const cr = new THREE.Mesh(crownGeo, crownMat); cr.position.set(x, 3.4, z); cr.scale.set(1, 1.15, 1); cr.castShadow = true; cr.receiveShadow = true; scene.add(cr);
  }

  // ---------- notre boulangerie (détaillée, vue de près) ----------
  const shop = new THREE.Group(); scene.add(shop);
  const add = (geo, mat, x, y, z, parent = shop) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

  const shopClay = new THREE.MeshStandardMaterial({ color: 0x7c7c7c, roughness: .9 }); // notre immeuble : éteint, plus sombre que la ville
  box(10, 9.4, 6, shopClay, 0, 4.86, SHOP_Z - 3);            // corps du bâtiment
  box(10, 6, 4, winMat, 0, 3.16 + 9.4, SHOP_Z - 7.5);         // immeuble derrière
  const panel = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: .45, metalness: .2 });
  box(10.2, 3.9, .3, panel, 0, 2.11, SHOP_Z + .1);            // devanture peinte
  box(10.5, .35, .7, shopClay, 0, 4.15, SHOP_Z + .2);         // corniche de devanture
  box(10.6, .5, .9, shopClay, 0, 9.7, SHOP_Z + .1);           // corniche haute
  // vitrine = écran (texture animée)
  const screenTex = canvasTex(1024, 512, () => {});
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(.8, .8, .8) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), screenMat);
  screen.position.set(-1.7, 1.95, SHOP_Z + .27); shop.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .06, metalness: 0, transparent: true, opacity: .35, envMapIntensity: 1.2 }));
  glass.position.set(-1.7, 1.95, SHOP_Z + .29); shop.add(glass);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: .6 });
  for (const [w, h, x, y] of [[5.5, .14, -1.7, .58], [5.5, .14, -1.7, 3.32], [.14, 2.85, -4.38, 1.95], [.14, 2.85, .98, 1.95], [.08, 2.6, -1.7, 1.95]])
    box(w, h, .12, frameMat, x, y, SHOP_Z + .3);
  // porte + serrure
  box(1.55, 2.95, .1, new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: .15, metalness: .3 }), 2.2, 1.63, SHOP_Z + .27);
  for (const [w, h, x, y] of [[1.75, .12, 2.2, 3.15], [.12, 3.0, 1.38, 1.65], [.12, 3.0, 3.02, 1.65]]) box(w, h, .14, frameMat, x, y, SHOP_Z + .3);
  box(.06, .5, .1, frameMat, 2.62, 1.55, SHOP_Z + .37);       // poignée
  const plate = add(new THREE.CylinderGeometry(.16, .16, .04, 32), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: .9, roughness: .25 }), DOOR.x, DOOR.y, SHOP_Z + .33);
  plate.rotation.x = Math.PI / 2;
  // trou de serrure (forme classique)
  const kh = new THREE.Shape();
  kh.absarc(0, .03, .05, 0, Math.PI * 2, false);
  const khBody = new THREE.Shape(); khBody.moveTo(-.025, .02); khBody.lineTo(.025, .02); khBody.lineTo(.045, -.09); khBody.lineTo(-.045, -.09); khBody.closePath();
  const khMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const kh1 = new THREE.Mesh(new THREE.ShapeGeometry(kh), khMat), kh2 = new THREE.Mesh(new THREE.ShapeGeometry(khBody), khMat);
  kh1.position.set(DOOR.x, DOOR.y, SHOP_Z + .356); kh2.position.copy(kh1.position); shop.add(kh1, kh2);
  // fenêtres des étages
  const glassDark = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: .1, metalness: .2, envMapIntensity: .8 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const x = -3.6 + c * 2.4, y = 5.6 + r * 2.6;
    box(1.3, 1.8, .1, glassDark, x, y, SHOP_Z + .02);
    box(1.6, .16, .4, shopClay, x, y - 1.0, SHOP_Z + .15);
    box(1.5, .12, .14, frameMat, x, y + .95, SHOP_Z + .07);
  }
  // store rayé
  const awnTex = canvasTex(512, 64, (ctx, w, h) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#0d0d0d' : '#bdbdbd'; ctx.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
  const awnMat = new THREE.MeshStandardMaterial({ map: awnTex, roughness: .8, side: THREE.DoubleSide });
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.9), awnMat);
  awn.position.set(-.45, 3.55, SHOP_Z + 1.0); awn.rotation.x = -1.05; awn.castShadow = true; shop.add(awn);
  const valTex = canvasTex(512, 64, (ctx, w, h) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#0d0d0d' : '#bdbdbd';
      ctx.beginPath(); ctx.moveTo(i * w / 16, 0); ctx.lineTo((i + 1) * w / 16, 0); ctx.lineTo((i + 1) * w / 16, h * .55);
      ctx.arc((i + .5) * w / 16, h * .55, w / 32, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
  });
  const val = new THREE.Mesh(new THREE.PlaneGeometry(8.6, .55), new THREE.MeshStandardMaterial({ map: valTex, transparent: true, alphaTest: .5, roughness: .8, side: THREE.DoubleSide }));
  val.position.set(-.45, 2.92, SHOP_Z + 1.84); shop.add(val);
  // enseigne drapeau avec croissant (sans texte)
  const signTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0c0c0c'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e9e9e9'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); ctx.stroke();
    bag(ctx, w / 2, h / 2 + 8, 128, '#e9e9e9', .11);
  });
  const sign = new THREE.Mesh(new THREE.CircleGeometry(.72, 48), new THREE.MeshStandardMaterial({ map: signTex, roughness: .5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0 }));
  sign.position.set(4.55, 5.1, SHOP_Z + 1.25); sign.rotation.y = Math.PI / 2; shop.add(sign);
  box(.08, .08, 1.5, frameMat, 4.55, 5.95, SHOP_Z + .9);
  // applique au-dessus de la porte (éteinte) + lampadaire de rue
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  box(.35, .22, .35, lampMat, 2.2, 3.7, SHOP_Z + .55);
  const post = new THREE.Group(); scene.add(post);
  add(new THREE.CylinderGeometry(.09, .13, 6.4, 12), dark, -6.6, 3.36, .9, post);
  add(new THREE.CylinderGeometry(.05, .05, 1.6, 8), dark, -6.0, 6.45, .9, post).rotation.z = Math.PI / 2;
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(6), toneMapped: false });
  add(new THREE.SphereGeometry(.16, 16, 12), bulbMat, -5.3, 6.3, .9, post);
  const streetLight = new THREE.SpotLight(0xffffff, 120, 18, .75, .6, 1.6);
  streetLight.position.set(-5.3, 6.25, .9); streetLight.target.position.set(-3.2, 1.2, -1.8);
  streetLight.castShadow = false;
  scene.add(streetLight, streetLight.target);
  // cône de lumière volumétrique sous le lampadaire
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uInt: { value: .55 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uInt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = pow(vUv.y, 1.8) * edge * uInt; gl_FragColor = vec4(vec3(1.), a); }`,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.12, 3.0, 6.2, 40, 1, true), coneMat);
  cone.position.set(-5.0, 3.15, .6); cone.rotation.z = -.22; scene.add(cone);
  // potelets le long du trottoir (premier plan bas de l'image)
  for (let x = -9; x <= 9; x += 1.8) {
    if (Math.abs(x - 2.2) < 1) continue;
    add(new THREE.CylinderGeometry(.09, .1, .95, 10), dark, x, .62, .55);
    add(new THREE.SphereGeometry(.11, 10, 8), frameMat, x, 1.1, .55);
  }
  // pot de fleurs / arbuste près de la porte
  add(new THREE.CylinderGeometry(.42, .34, .8, 20), dark, 3.9, .56, SHOP_Z + .9);
  add(new THREE.IcosahedronGeometry(.75, 1), crownMat, 3.9, 1.55, SHOP_Z + .9);

  // ---------- poussières en suspension, soufflées par les mots forts ----------
  const NDUST = 520;
  const dpos = new Float32Array(NDUST * 3), dseed = new Float32Array(NDUST);
  for (let i = 0; i < NDUST; i++) {
    dpos[i * 3] = (R() - .5) * 14; dpos[i * 3 + 1] = R() * 10; dpos[i * 3 + 2] = -1 + R() * 16; dseed[i] = R();
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dgeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uImp: { value: new THREE.Vector4(-9, -9, -9, -9) }, uAlpha: { value: 1 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `attribute float seed; uniform float uT; uniform vec4 uImp; uniform vec3 uCam; varying float vA;
      float imp(float t0){ float d = uT - t0; return d < 0. ? 0. : (1. - exp(-d * 5.)) * exp(-d * .6); }
      void main(){
        vec3 p = position;
        p += vec3(sin(uT * .7 + seed * 40.), cos(uT * .5 + seed * 23.) * .6 + uT * .12, sin(uT * .4 + seed * 17.)) * .35;
        vec3 away = normalize(vec3(p.x - uCam.x, p.y - 4.5, .25) + 1e-3);
        float k = imp(uImp.x) * 1.7 + imp(uImp.y) * 1.0 + imp(uImp.z) * 1.4 + imp(uImp.w) * .9;
        p += away * k * (1.2 + seed * 1.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = (2.5 + seed * 5.) * (40. / -mv.z);
        vA = (.25 + .75 * fract(seed * 7.13)) * smoothstep(0., 2., -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uAlpha; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, .0, d) * vA * uAlpha; gl_FragColor = vec4(vec3(1.), a * .55); }`,
  });
  const dust = new THREE.Points(dgeo, dustMat); dust.frustumCulled = false; scene.add(dust);

  // ---------- boutiques concurrentes ----------
  const comps = [
    { pos: new THREE.Vector3(-18.5, 0, -23), t: T.concurrents },
    { pos: new THREE.Vector3(18.5, 0, -23), t: T.concurrents + .14 },
    { pos: new THREE.Vector3(0, 0, -23), t: T.concurrents + .28 },
  ];
  const greenGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(GREEN_HEX), toneMapped: false });
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uInt: { value: 0 }, uCol: { value: new THREE.Color(GREEN_HEX) } },
    vertexShader: coneMat.vertexShader,
    fragmentShader: `uniform float uInt; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 2.); float a = pow(1. - vUv.y, 1.4) * edge * uInt; gl_FragColor = vec4(uCol * 1.6, a); }`,
  });
  const ringMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(GREEN_HEX).multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const pinTex = canvasTex(256, 320, (ctx) => {
    // halo
    const gr = ctx.createRadialGradient(128, 112, 60, 128, 112, 128);
    gr.addColorStop(0, 'rgba(22,255,110,.45)'); gr.addColorStop(1, 'rgba(22,255,110,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256);
    // silhouette d'épingle
    ctx.fillStyle = '#16ff6e';
    ctx.beginPath(); ctx.arc(128, 112, 92, Math.PI * .82, Math.PI * .18, false); ctx.lineTo(128, 312); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(128, 112, 40, 0, Math.PI * 2); ctx.fill();
  });
  for (const c of comps) {
    const g = new THREE.Group(); g.position.copy(c.pos); scene.add(g);
    // immeuble + devanture lumineuse verte + store vert/blanc
    box(5.6, 5.4, 6, clay, 0, 0, -3.1, g).position.y = 2.86;
    box(5.2, 3.6, .3, panel, 0, 1.96, .1, g);
    const win = box(4.2, 2.3, .1, greenGlow, -.2, 1.85, .3, g); win.castShadow = false;
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.4), new THREE.MeshStandardMaterial({ map: awnTex, roughness: .8, side: THREE.DoubleSide, color: 0xffffff }));
    aw.position.set(0, 3.5, .8); aw.rotation.x = -1.05; g.add(aw);
    const light = new THREE.PointLight(GREEN_HEX, 0, 14, 1.8); light.position.set(0, 1.6, 2.2); g.add(light);
    // épingle de carte : pictogramme toujours face à la caméra
    const pin = new THREE.Group(); pin.position.set(0, 6, 0); g.add(pin);
    const pinSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false, depthTest: false }));
    pinSprite.center.set(.5, 0); pinSprite.scale.set(6.4, 8); pinSprite.renderOrder = 5; pin.add(pinSprite);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, .35, 44, 32, 1, true), beamMat.clone());
    beam.position.set(0, 22, 0); g.add(beam);
    const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64), ringMat()); r.rotation.x = -Math.PI / 2; r.position.set(0, .2, 2.5); g.add(r); return r; });
    Object.assign(c, { g, pin, win, light, beam, rings, winMat: win.material });
    win.material = greenGlow.clone();
  }

  // ---------- clients : particules lumineuses qui filent chez les concurrents ----------
  const N = 190, TRAIL = 9;
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(4), toneMapped: false });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.3, 12, 8), headMat, N);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const trails = new THREE.InstancedMesh(new THREE.SphereGeometry(.24, 8, 6), trailMat, N * TRAIL);
  trails.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * TRAIL * 3), 3);
  heads.frustumCulled = trails.frustumCulled = false;
  scene.add(heads, trails);
  const doorOf = c => new THREE.Vector3(c.pos.x, 0, c.pos.z + 1.6);
  const clients = [];
  for (let k = 0; k < N; k++) {
    const fromLeft = k % 2 === 0;
    const target = k % 3;                  // 0: gauche, 1: droite, 2: fond
    const c = comps[target];
    const side = target === 0 ? -1 : target === 1 ? 1 : (fromLeft ? 1 : -1);
    const lane = (R() - .5) * 4.6;
    const sx = (fromLeft ? -1 : 1) * (14 + R() * 30);
    const pts = [new THREE.Vector3(sx, 0, 3.5 + lane)];
    // passent devant notre vitrine, sans s'arrêter
    pts.push(new THREE.Vector3((R() - .5) * 6, 0, 3.5 + lane));
    pts.push(new THREE.Vector3(side * 10.5 + lane * .6, 0, 3.5 + lane));
    pts.push(new THREE.Vector3(side * 10.5 + lane * .6, 0, -17.5 + lane * .5));
    pts.push(new THREE.Vector3(c.pos.x + lane * .3, 0, -17.5 + lane * .5));
    pts.push(doorOf(c).add(new THREE.Vector3(lane * .15, 0, 0)));
    // si le client vient du mauvais côté, il traverse (on garde le chemin, c'est un flux)
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push(l); L += l; }
    const ts = T.vos1 - .08 + R() * .55 + (k / N) * .5;
    const te = Math.max(c.t + R() * .55, ts + .95 + R() * .3);
    clients.push({ pts, segs, L, ts, te, h: .55 + R() * .5 });
  }
  const tmpV = new THREE.Vector3();
  function pathAt(c, u, out) {
    let d = clamp(u) * c.L;
    for (let i = 0; i < c.segs.length; i++) {
      if (d <= c.segs[i] || i === c.segs.length - 1) return out.lerpVectors(c.pts[i], c.pts[i + 1], clamp(d / c.segs[i]));
      d -= c.segs[i];
    }
    return out.copy(c.pts[c.pts.length - 1]);
  }
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // ---------- caméra ----------
  const camKeys = [
    // t, position, cible
    [0.00, [-3.4, 1.3, 17.6], [0.2, 4.45, -2]],
    [T.pendant - .04, [-1.0, 1.75, 13.2], [-0.1, 4.2, -2]],
    [T.vos1 + .1, [2, 70, 48], [0, 0, -34]],
    [T.sur1 - .04, [-2, 68, 45], [0, 0, -33]],
    [T.google + .3, [0, 92, 8], [0, 0, -25]],
  ];
  const v3 = a => new THREE.Vector3(...a);
  const bez = (a, m, b, e) => a.clone().multiplyScalar((1 - e) * (1 - e)).add(m.clone().multiplyScalar(2 * (1 - e) * e)).add(b.clone().multiplyScalar(e * e));
  function cameraAt(t) {
    // poussée lente, grue (recul + montée), dérive, bascule plongeante, puis plongeon dans la serrure
    const k = camKeys;
    let p, q;
    if (t < k[1][0]) {
      const u = eOut(prog(t, k[0][0], k[1][0]));
      p = v3(k[0][1]).lerp(v3(k[1][1]), u); q = v3(k[0][2]).lerp(v3(k[1][2]), u);
      p.z += 5.5 * Math.pow(1 - clamp(t / .55), 3);   // coup d'arrivée sur la première image
    }
    else if (t < k[2][0]) {
      const u = prog(t, k[1][0], k[2][0]);
      p = bez(v3(k[1][1]), new THREE.Vector3(1, 6, 44), v3(k[2][1]), eInOut(u));
      q = v3(k[1][2]).lerp(v3(k[2][2]), eInOut(clamp(u * 1.25)));
    } else if (t < k[3][0]) { const u = smooth(prog(t, k[2][0], k[3][0])); p = v3(k[2][1]).lerp(v3(k[3][1]), u); q = v3(k[2][2]).lerp(v3(k[3][2]), u); }
    else if (t < k[4][0]) { const u = eInOut(prog(t, k[3][0], k[4][0])); p = v3(k[3][1]).lerp(v3(k[4][1]), u); q = v3(k[3][2]).lerp(v3(k[4][2]), u); }
    else {
      // plongeon : de la vue de dessus jusqu'au trou de serrure de notre porte
      const u = prog(t, k[4][0], T.site2 - .02);
      const e = eInExpo(u) * .8 + eInOut(u) * .2;
      p = bez(v3(k[4][1]), new THREE.Vector3(DOOR.x + 3, 10, 30), new THREE.Vector3(DOOR.x, DOOR.y + .03, SHOP_Z + .4), e);
      q = v3(k[4][2]).lerp(new THREE.Vector3(DOOR.x, DOOR.y + .03, SHOP_Z - 2), eOut(clamp(u * 1.3)));
    }
    return [p, q];
  }

  // ---------- texture de la vitrine : un navigateur qui charge... puis meurt ----------
  function drawScreen(t) {
    const ctx = screenTex.userData.ctx, w = 1024, h = 512;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const dieT = T.pas;
    const life = 1 - prog(t, dieT + .05, dieT + .3);   // effondrement façon vieux téléviseur
    if (life <= 0) {
      const dotA = 1 - prog(t, dieT + .3, dieT + .5);
      if (dotA > 0) { ctx.fillStyle = `rgba(255,255,255,${dotA})`; ctx.beginPath(); ctx.arc(w / 2, h / 2, 6 * dotA + 2, 0, Math.PI * 2); ctx.fill(); }
      screenTex.needsUpdate = true; return;
    }
    ctx.save();
    const sy = life < 1 ? Math.max(.012, Math.pow(life, 3)) : 1;
    const sx = life < 1 ? Math.min(1, .3 + life) : 1;
    ctx.translate(w / 2, h / 2); ctx.scale(sx, sy); ctx.translate(-w / 2, -h / 2);
    const glitch = t > dieT - .02 ? 1 : (t > T.na && t < T.na + .12) || (t > T.toujours && t < T.toujours + .08) ? .5 : 0;
    // fenêtre de navigateur vide
    ctx.fillStyle = '#f2f2f2'; roundRect(ctx, 60, 50, w - 120, h - 100, 26); ctx.fill();
    ctx.fillStyle = '#d6d6d6'; ctx.fillRect(60, 104, w - 120, 3);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(104 + i * 34, 78, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#dcdcdc'; roundRect(ctx, 250, 64, 520, 28, 14); ctx.fill();
    // roue de chargement qui tourne dans le vide
    const a = t * 7.5;
    ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const ang = a + i * Math.PI / 6;
      ctx.strokeStyle = `rgba(30,30,30,${.12 + .88 * ((i + 12) % 12) / 12})`;
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(ang) * 40, 300 + Math.sin(ang) * 40); ctx.lineTo(w / 2 + Math.cos(ang) * 64, 300 + Math.sin(ang) * 64); ctx.stroke();
    }
    ctx.restore();
    if (glitch > 0) {
      // bandes décalées + neige
      const img = ctx.getImageData(0, 0, w, h);
      const R2 = rng(Math.floor(t * 60));
      for (let b = 0; b < 9 * glitch; b++) {
        const y0 = Math.floor(R2() * h), bh = 6 + Math.floor(R2() * 40), off = Math.floor((R2() - .5) * 220);
        for (let y = y0; y < Math.min(h, y0 + bh); y++) {
          const row = img.data.slice(y * w * 4, (y + 1) * w * 4);
          for (let x = 0; x < w; x++) { const sxp = ((x - off) % w + w) % w; for (let c = 0; c < 4; c++) img.data[(y * w + x) * 4 + c] = row[sxp * 4 + c]; }
        }
      }
      for (let i = 0; i < img.data.length; i += 4 * 3) if (R2() < .22 * glitch) { const v = R2() * 255; img.data[i] = img.data[i + 2] = v * .6; img.data[i + 1] = v; }
      ctx.putImageData(img, 0, 0);
    }
    screenTex.needsUpdate = true;
  }

  const keyholeWorld = new THREE.Vector3(DOOR.x, DOOR.y + .03, SHOP_Z + .36);

  function update(t, post) {
    const [p, q] = cameraAt(t);
    // tremblement à la main + impacts sur les mots forts
    const shake = .02 + .25 * pulse(t, T.votre, 9) + .12 * pulse(t, T.pas, 10) + .06 * pulse(t, T.trouvent, 10);
    p.x += noise1(t * 7, 1) * shake; p.y += noise1(t * 7, 2) * shake;
    camera.position.copy(p); camera.lookAt(q);
    camera.rotation.z += noise1(t * 3, 5) * .006;
    const P = T.pendant;
    camera.fov = t < P - .07 ? 46 - 9 * Math.exp(-t * 7) - 3 * prog(t, 0, P - .07) - 2.5 * pulse(t, T.pas, 9) : t < T.google ? lerp(43, 58, eInOut(prog(t, P - .04, T.vos1 + .1))) : lerp(58, 64, eIn(prog(t, T.google + .35, T.site2)));
    camera.updateProjectionMatrix();

    drawScreen(t);
    dustMat.uniforms.uT.value = t;
    dustMat.uniforms.uImp.value.set(T.votre, T.commerce, T.pas, T.internet1);
    dustMat.uniforms.uCam.value.copy(camera.position);
    dustMat.uniforms.uAlpha.value = 1 - prog(t, P - .02, P + .43);
    dust.visible = t < P + .48;
    screen.visible = t < P + .63;

    // nuit qui tombe : les fenêtres de la ville s'allument (sauf chez nous)
    uniforms.uLit.value = .25 + .75 * eOut(prog(t, T.pendant - .05, T.vos1 + .2));
    moon.intensity = lerp(.2, 1.0, eInOut(prog(t, T.pendant, T.vos1 + .2)));
    hemi.intensity = lerp(.05, .16, prog(t, T.pendant, T.vos1));
    moon.position.set(lerp(-30, 35, eInOut(prog(t, T.pendant, T.vos1 + .3))), 60, lerp(25, 30, prog(t, P - .07, T.vos1 + .2)));
    // le lampadaire grésille sur "pas" puis s'éteint quand la caméra s'envole : notre boutique reste dans le noir
    const flick = t > T.pas && t < T.pas + .1 ? .15 : 1;
    streetLight.intensity = 70 * flick * (1 - prog(t, P + .03, P + .53));
    coneMat.uniforms.uInt.value = .32 * flick * (1 - prog(t, P + .03, P + .53));
    bulbMat.color.setScalar(6 * flick * (1 - prog(t, P + .03, P + .53)) + .05);
    const signOn = t < T.pas ? (.35 + .25 * Math.sin(t * 40) * (t > T.toujours ? 1 : 0)) : 0;
    sign.material.emissiveIntensity = signOn;

    // clients
    const vis = t > T.vos1 - .12;
    heads.visible = trails.visible = vis;
    if (vis) {
      clients.forEach((c, k) => {
        const appear = eBack(prog(t, c.ts, c.ts + .22));
        const u = eInOut(prog(t, c.ts, c.te));
        const gone = t > c.te + .02;
        const s = gone ? 0 : appear;
        pathAt(c, u, tmpV);
        dummy.position.set(tmpV.x, .35 + c.h * .3, tmpV.z); dummy.scale.setScalar(s); dummy.updateMatrix();
        heads.setMatrixAt(k, dummy.matrix);
        for (let i = 0; i < TRAIL; i++) {
          const uu = Math.max(0, u - (i + 1) * .016 * (1 + 3 * Math.sin(Math.PI * clamp(u)) ));
          pathAt(c, uu, tmpV);
          dummy.position.set(tmpV.x, .35 + c.h * .3, tmpV.z);
          const f = (1 - i / TRAIL);
          dummy.scale.setScalar(gone ? 0 : s * (.5 + .5 * f)); dummy.updateMatrix();
          trails.setMatrixAt(k * TRAIL + i, dummy.matrix);
          col.setScalar(f * f * 1.6); trails.setColorAt(k * TRAIL + i, col);
        }
      });
      heads.instanceMatrix.needsUpdate = trails.instanceMatrix.needsUpdate = true;
      trails.instanceColor.needsUpdate = true;
    }

    // concurrents : épingles qui surgissent, vitrines qui s'allument, faisceaux sur "Google"
    for (const c of comps) {
      const k = spring(t - c.t, 18, .38);
      c.pin.scale.setScalar(Math.max(0, k) * (1 + .25 * pulse(t, T.google, 6)));
      c.pin.position.y = 6 + Math.sin(t * 3 + c.pos.x) * .35 + (1 - clamp(k)) * 5;
      const on = clamp((t - c.t + .1) / .15);
      c.win.material.color.setRGB(.09 + on * .0, 1, .43).multiplyScalar(.15 + on * 2.2);
      c.light.intensity = on * 60;
      c.beam.material.uniforms.uInt.value = .9 * eOut(prog(t, T.google - .05, T.google + .25)) * (1 - prog(t, T.google + .5, T.site2));
      c.beam.scale.set(1, eOut(prog(t, T.google - .05, T.google + .3)), 1);
      c.beam.position.y = 22 * c.beam.scale.y;
      c.rings.forEach((r, i) => {
        const t0 = c.t + i * .22 + (i === 2 ? T.google - c.t - .44 : 0);
        const u = prog(t, t0, t0 + .9);
        r.scale.setScalar(1 + eOut(u) * 11);
        r.material.opacity = u > 0 && u < 1 ? (1 - u) * .9 : 0;
      });
    }

    // post-traitement propre à la scène
    const b1 = t < P + .03;
    post.bloom.strength = b1 ? .6 : .9; post.bloom.radius = .6; post.bloom.threshold = b1 ? .78 : .62;
    post.u.vignette.value = b1 ? .62 : .5;
    // le plongeon finit dans le noir du trou de serrure
    post.u.exposure.value = 1 - eIn(prog(t, T.site2 - .12, T.site2 - .02));
    post.u.flash.value = .12 * pulse(t, T.pas, 18);
    // onde de choc sur le tout premier mot
    const sw0 = prog(t, -.06, .55);
    if (sw0 < 1) {
      post.u.swCenter.value.set(.5, 1 - 760 / 1920);
      post.u.swRadius.value = .02 + eOut(sw0) * .95;
      post.u.swWidth.value = .05 + .06 * sw0;
      post.u.swStrength.value = .05 * (1 - sw0);
    }
    post.u.ca.value = .002 + .012 * pulse(t, T.votre, 10) + .01 * pulse(t, T.pas, 12) + .008 * eIn(prog(t, T.google + .4, T.site2));
  }

  // position écran de la serrure (pour aspirer le texte dedans)
  function keyholeScreen(t, out) {
    const [p, q] = cameraAt(t);
    const cam = camera.clone(); cam.position.copy(p); cam.lookAt(q); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const v = keyholeWorld.clone().project(cam);
    out.x = (v.x * .5 + .5) * 1080; out.y = (-v.y * .5 + .5) * 1920;
    return out;
  }

  return { scene, camera, update, keyholeScreen };
}
