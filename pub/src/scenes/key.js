// Temps 3 : la clé verte entre dans la serrure, tourne, et la lumière explose (révélation de la marque).
import * as THREE from 'three';
import { T, clamp, lerp, prog, eOut, eOut5, eIn, eInOut, eExpo, eInExpo, eBack, smooth, spring, pulse, rng, noise1, GREEN_HEX } from '../timeline.js';

const PLATE_R = 4;

function keyholeShape(scale = 1, dx = 0) {
  const s = new THREE.Shape();
  const r = .62 * scale, cy = .42 * scale;
  // cercle du haut + fente trapézoïdale vers le bas (tracé continu)
  const a0 = Math.asin((.27 * scale) / r);
  s.moveTo(dx - .27 * scale, cy - Math.cos(a0) * r);
  s.absarc(dx, cy, r, -Math.PI / 2 - a0 + Math.PI * 2, -Math.PI / 2 + a0, true);
  s.lineTo(dx + .46 * scale, -1.35 * scale);
  s.lineTo(dx - .46 * scale, -1.35 * scale);
  s.closePath();
  return s;
}

// moitié de la plaque (côté -1 gauche, +1 droit), découpée le long de l'axe et autour du trou de serrure
function halfPlateShape(side) {
  const s = new THREE.Shape();
  const R = PLATE_R, N = 72;
  const r = .62, cy = .42, w = .27, yb = -1.35, wb = .46;
  const yj = cy - Math.sqrt(r * r - w * w);
  s.moveTo(0, R);
  for (let i = 1; i <= N; i++) { const a = Math.PI / 2 - side * (i / N) * Math.PI; s.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
  s.lineTo(0, yb);
  s.lineTo(side * wb, yb);
  s.lineTo(side * w, yj);
  const aj = Math.atan2(yj - cy, side * w);
  const aEnd = side > 0 ? Math.PI / 2 : -3 * Math.PI / 2;
  for (let i = 1; i <= 28; i++) { const a = aj + (aEnd - aj) * i / 28; s.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r); }
  s.lineTo(0, R);
  return s;
}

export function createKey(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  const camera = new THREE.PerspectiveCamera(32, 1080 / 1920, .1, 400);
  const R = rng(31);

  // lumières
  scene.add(new THREE.AmbientLight(0xffffff, .05));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2); keyLight.position.set(6, 10, 12); scene.add(keyLight);
  const rimG = new THREE.PointLight(GREEN_HEX, 60, 30, 1.5); rimG.position.set(-7, 4, 2); scene.add(rimG);
  const rimW = new THREE.PointLight(0xffffff, 40, 30, 1.5); rimW.position.set(7, -5, 3); scene.add(rimW);

  const lock = new THREE.Group(); lock.rotation.y = .5; scene.add(lock);

  // ---------- plaque de serrure en deux battants ----------
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 1, roughness: .32, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: 1.1 });
  const ext = { depth: .55, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 3, curveSegments: 48 };
  const doors = [-1, 1].map(side => {
    const hinge = new THREE.Group(); hinge.position.set(side * PLATE_R, 0, 0); lock.add(hinge);
    const geo = new THREE.ExtrudeGeometry(halfPlateShape(side), ext);
    geo.translate(-side * PLATE_R, 0, -.55);
    const m = new THREE.Mesh(geo, metal); hinge.add(m);
    // anneau de cerclage (demi-tore)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PLATE_R + .02, .14, 16, 96, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xbfbfbf, metalness: 1, roughness: .18, envMapIntensity: 1.4 }));
    ring.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    ring.position.set(-side * PLATE_R, 0, .02); hinge.add(ring);
    // rivets
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + side * -(i + .5) / 5 * Math.PI;
      const rv = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 10), ring.material);
      rv.position.set(-side * PLATE_R + Math.cos(a) * (PLATE_R - .55) * (side < 0 ? 1 : 1) * 1, Math.sin(a) * (PLATE_R - .55), .04);
      rv.position.x = -side * PLATE_R + Math.cos(a) * (PLATE_R - .55);
      hinge.add(rv);
    }
    return { side, hinge };
  });

  // ---------- lumière derrière la plaque (éclipse puis explosion) ----------
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uK: { value: .4 }, uSpread: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uK, uSpread; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float rr = length(vUv - .5) * 2. * 9.;
        float halo = exp(-max(rr - 4.0, 0.) * 1.5 / uSpread);
        float wide = exp(-max(rr - 4.0, 0.) * .9) * .12;
        vec3 col = mix(vec3(.09, 1., .43), vec3(1.), smoothstep(5.2, 4.0, rr)) * (halo + wide) * uK;
        col += (h(gl_FragCoord.xy) - .5) / 128.;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), glowMat);
  glow.position.z = -2.2; lock.add(glow);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false });
  const core = new THREE.Mesh(new THREE.CircleGeometry(PLATE_R * .98, 64), coreMat);
  core.position.z = -2.0; lock.add(core);

  // ---------- la clé ----------
  const keyMat = new THREE.MeshPhysicalMaterial({ color: GREEN_HEX, metalness: .9, roughness: .24, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.25, emissive: GREEN_HEX, emissiveIntensity: .03 });
  const keyG = new THREE.Group(); lock.add(keyG);        // position / orientation dans le repère de la serrure
  const keySpin = new THREE.Group(); keyG.add(keySpin);   // rotation autour de l'axe de la clé (tour de clé)
  const keyBody = new THREE.Group(); keySpin.add(keyBody);
  // modélisée le long de +y (anneau en haut, panneton en bas, pointe en y = -2.05)
  const bow = new THREE.Mesh(new THREE.TorusGeometry(.95, .3, 28, 72), keyMat); bow.position.y = 2.15; keyBody.add(bow);
  const bowInner = new THREE.Mesh(new THREE.TorusGeometry(.5, .09, 16, 48), keyMat); bowInner.position.y = 2.15; keyBody.add(bowInner);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .26, 32), keyMat); collar.position.y = 1.0; keyBody.add(collar);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, 3.05, 24), keyMat); shaft.position.y = -.55; keyBody.add(shaft);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 12), keyMat); tip.position.y = -2.05; keyBody.add(tip);
  const bitShape = new THREE.Shape();
  bitShape.moveTo(0, 0); bitShape.lineTo(.78, 0); bitShape.lineTo(.78, .18); bitShape.lineTo(.56, .18); bitShape.lineTo(.56, .34);
  bitShape.lineTo(.78, .34); bitShape.lineTo(.78, .62); bitShape.lineTo(.44, .62); bitShape.lineTo(.44, .76); bitShape.lineTo(0, .76); bitShape.closePath();
  const bit = new THREE.Mesh(new THREE.ExtrudeGeometry(bitShape, { depth: .16, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 }), keyMat);
  bit.position.set(.08, -1.95, -.08); bit.rotation.z = 0; keyBody.add(bit);
  // la clé pointe vers -z : +y du modèle devient +z (anneau vers la caméra)
  keyBody.rotation.x = Math.PI / 2;

  // ---------- étincelles au déverrouillage ----------
  const NS = 420;
  const spos = new Float32Array(NS * 3), svel = new Float32Array(NS * 3), sseed = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    const a = R() * Math.PI * 2, el = (R() - .3) * 1.2, sp = 6 + R() * 22;
    svel[i * 3] = Math.cos(a) * Math.cos(el) * sp; svel[i * 3 + 1] = Math.sin(a) * Math.cos(el) * sp * 1.1; svel[i * 3 + 2] = Math.abs(Math.sin(el)) * sp * .9 + 3;
    sseed[i] = R();
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  sgeo.setAttribute('vel', new THREE.BufferAttribute(svel, 3));
  sgeo.setAttribute('seed', new THREE.BufferAttribute(sseed, 1));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uDt: { value: -1 } },
    vertexShader: `attribute vec3 vel; attribute float seed; uniform float uDt; varying float vA; varying float vG;
      void main(){
        float d = max(uDt, 0.) * (.7 + seed * .6);
        vec3 p = vec3(0., .2, .4) + vel * (1. - exp(-d * 2.2)) / 2.2 + vec3(0., -2.5, 0.) * d * d;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = (4. + seed * 9.) * (30. / -mv.z) * (uDt < 0. ? 0. : 1.);
        vA = exp(-d * (1.4 + seed * 1.6)); vG = seed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vG;
      void main(){ vec2 c = gl_PointCoord - .5; float a = smoothstep(.5, 0., length(c)) * vA;
        vec3 col = mix(vec3(1.), vec3(.09, 1., .43), step(.45, vG)) * 2.5; gl_FragColor = vec4(col, a); }`,
  });
  const sparks = new THREE.Points(sgeo, sparkMat); sparks.frustumCulled = false; lock.add(sparks);

  // poussière / brume légère en fond
  const NB = 300, bpos = new Float32Array(NB * 3);
  for (let i = 0; i < NB; i++) { bpos[i * 3] = (R() - .5) * 26; bpos[i * 3 + 1] = (R() - .5) * 40; bpos[i * 3 + 2] = -6 + R() * 22; }
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  const bmat = new THREE.PointsMaterial({ color: 0xffffff, size: .06, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(bgeo, bmat); scene.add(motes);

  const tKey = T.cle;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const kh = v(0, -.2, 0);

  function update(t, post) {
    // ---------- caméra ----------
    const back = eOut5(prog(t, T.site2 - .06, T.site2 + .45));
    let p = v(lerp(.3, -2.8, back), lerp(.1, 1.3, back), lerp(7, 36, back));
    p.x += prog(t, T.site2 + .4, tKey) * 1.2;
    p.z -= prog(t, T.site2 + .4, tKey) * 3.5;
    // impact : coup de poussée, puis plongée dans la lumière quand les battants s'ouvrent
    const push = eOut(prog(t, tKey, tKey + .3)) * 3 + eInExpo(prog(t, T.un - .16, T.un + .02)) * 24;
    p.z -= push; p.x *= 1 - eIn(prog(t, T.en, T.un)) * .7; p.y *= 1 - eIn(prog(t, T.en, T.un)) * .7;
    const shake = .02 + .45 * pulse(t, tKey, 10) + .12 * pulse(t, T.main, 12);
    p.x += noise1(t * 9, 11) * shake; p.y += noise1(t * 9, 12) * shake;
    camera.position.copy(p);
    camera.lookAt(v(1.25 * (1 - eIn(prog(t, T.en, T.un))), -.15 + noise1(t * 5, 13) * shake * .3, 0));
    camera.rotation.z += noise1(t * 2, 14) * .01 + pulse(t, tKey, 7) * .025;
    camera.fov = 32 + 5 * eInExpo(prog(t, T.un - .16, T.un)) - 2.5 * pulse(t, tKey, 8);
    camera.updateProjectionMatrix();

    // ---------- la clé : vol d'arrivée, alignement, insertion, tour ----------
    const fly = prog(t, T.site2 - .05, T.internet2 + .2);
    const fe = eOut5(fly);
    const from = v(8.5, 9.5, 9), to = v(0, -.05, 4.4);
    const pos = from.clone().lerp(to, fe);
    pos.x += Math.sin(fe * Math.PI) * -1.2;
    const ins = eInOut(prog(t, T.internet2 + .26, tKey - .02));
    pos.z = lerp(pos.z, 1.2, ins);
    keyG.position.copy(pos);
    // orientation : arrive en tournoyant, se présente face à la serrure
    keyG.rotation.set((1 - fe) * -1.6, (1 - fe) * 2.4, (1 - fe) * 3.0);
    // tour de clé sec sur "clé", léger dépassement
    const turn = spring(t - tKey, 34, .5);
    keySpin.rotation.z = -Math.PI / 2 + (t < tKey ? 0 : turn * Math.PI / 2) + (1 - fe) * 6;
    keyMat.emissiveIntensity = .03 + .45 * pulse(t, tKey, 9) + .35 * prog(t, T.en, T.un);
    keyG.visible = t > T.site2 - .06;

    // ---------- battants qui s'ouvrent ----------
    // les battants s'entrouvrent sur "en main", puis s'ouvrent d'un coup juste avant le passage au blanc
    const open = .1 * eInOut(prog(t, T.en, T.un - .12)) + .9 * eIn(prog(t, T.un - .12, T.un + .02));
    const crack = prog(t, tKey, tKey + .08);
    doors.forEach(d => {
      d.hinge.rotation.y = d.side * -(open * 1.95);
    });

    // ---------- lumière ----------
    const boom = pulse(t, tKey, 3);
    glowMat.uniforms.uK.value = t < tKey ? .28 + .14 * prog(t, T.site2, tKey) : .7 + .7 * boom + .8 * open;
    glowMat.uniforms.uSpread.value = 1 + .25 * boom + .6 * open;
    coreMat.color.setScalar(t < tKey ? .5 + .3 * prog(t, T.internet2, tKey) : .95 + .5 * boom + 1.6 * open);
    sparkMat.uniforms.uDt.value = t < tKey ? -1 : t - tKey;
    motes.rotation.y = t * .05;

    // ---------- post-traitement ----------
    lock.updateMatrixWorld(); camera.updateMatrixWorld();
    const khs = lock.localToWorld(kh.clone()).project(camera);
    const cx = khs.x * .5 + .5, cy = khs.y * .5 + .5;
    post.rays.params.center.set(cx, cy);
    post.rays.params.intensity = t < tKey ? .18 : .25 + .3 * boom + .4 * open;
    post.rays.params.threshold = .7; post.rays.params.density = .8; post.rays.params.decay = .955;
    post.bloom.strength = .65 + .3 * boom + .4 * open; post.bloom.radius = .65; post.bloom.threshold = .75;
    const sw = prog(t, tKey, tKey + .8);
    if (sw > 0 && sw < 1) {
      post.u.swCenter.value.set(cx, cy);
      post.u.swRadius.value = .03 + eOut(sw) * 1.15;
      post.u.swWidth.value = .045 + .07 * sw;
      post.u.swStrength.value = .07 * (1 - sw);
    }
    post.u.ca.value = .002 + .016 * pulse(t, tKey, 7);
    post.u.vignette.value = .55 * (1 - open);
    // entrée : on sort du noir du trou de serrure ; sortie : la lumière envahit tout
    post.u.exposure.value = eOut(prog(t, T.site2 - .06, T.site2 + .12));
    post.u.flash.value = .08 * pulse(t, tKey, 18) + eIn(prog(t, T.un - .075, T.un + .005));
  }

  return { scene, camera, update };
}
