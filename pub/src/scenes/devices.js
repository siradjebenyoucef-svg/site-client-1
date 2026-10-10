// Temps 4 : la preuve. Un ordinateur et un téléphone, le site de la boulangerie se construit,
// puis une commande est passée ("prêt à vendre").
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T, clamp, lerp, prog, eOut, eOut5, eIn, eInOut, eExpo, eInExpo, eBack, smooth, spring, pulse, rng, noise1, GREEN_HEX } from '../timeline.js';
import { makePhotos } from '../photos.js';
import { drawDesktop, drawMobile } from '../site.js';
import { roundRect } from '../icons.js';

function canvasTexture(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { c, ctx: c.getContext('2d'), t };
}

export async function createDevices(env, renderer) {
  const ph = makePhotos(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = env;
  scene.environmentIntensity = .55;
  scene.fog = new THREE.Fog(0x000000, 46, 78);
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, .1, 300);
  const R = rng(17);

  // ---------- studio ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: .55, metalness: 0, clearcoat: .15, clearcoatRoughness: .5, envMapIntensity: .04 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-8, 16, 10); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  key.shadow.radius = 8; key.shadow.bias = -.0004; scene.add(key);
  const rimG = new THREE.SpotLight(GREEN_HEX, 900, 60, .5, .8, 1.6); rimG.position.set(-10, 12, -14); rimG.target.position.set(0, 3, 0); scene.add(rimG, rimG.target);
  const rimW = new THREE.SpotLight(0xffffff, 500, 60, .45, .8, 1.6); rimW.position.set(14, 10, -8); rimW.target.position.set(2, 3, 0); scene.add(rimW, rimW.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, .12));

  // halo vert derrière les appareils (lumière volumétrique de studio)
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: .5 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uK; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 p = (vUv - vec2(.5, .42)) * vec2(1.3, 1.); float d = length(p);
        vec3 c = vec3(.09, 1., .43) * exp(-d * d * 22.) * uK + vec3(1.) * exp(-d * d * 90.) * uK * .1;
        c += (h(gl_FragCoord.xy) - .5) / 160.; gl_FragColor = vec4(c, 1.); }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), haloMat); halo.position.set(-1, 7, -16); scene.add(halo);

  // ---------- ordinateur portable ----------
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, metalness: .7, roughness: .28, envMapIntensity: 1.0 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: .2, roughness: .12, clearcoat: 1, envMapIntensity: 1 });
  const laptop = new THREE.Group(); scene.add(laptop);
  const base = new THREE.Mesh(new RoundedBoxGeometry(14, .42, 9.6, 6, .2), alu); base.position.y = .21; base.castShadow = true; base.receiveShadow = true; laptop.add(base);
  const kbTex = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 560; const ctx = c.getContext('2d');
    ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, 1024, 560);
    const rows = [14, 14, 13, 12, 11];
    rows.forEach((n, r) => { const kw = 1024 / 14.6; for (let i = 0; i < n; i++) { const w = (r === 4 && i === 5) ? kw * 4 : kw - 8; const x = 18 + i * kw + (14 - n) * kw / 2; ctx.fillStyle = '#000'; roundRect(ctx, x, 20 + r * 76, w - 6, 66, 9); ctx.fill(); ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 2; ctx.stroke(); } });
    ctx.fillStyle = '#2a2b2d'; roundRect(ctx, 330, 410 + 200, 360, 140, 14);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 4.4), new THREE.MeshStandardMaterial({ map: kbTex, roughness: .7 }));
  kb.rotation.x = -Math.PI / 2; kb.position.set(0, .425, -1.6); laptop.add(kb);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.9), new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: .25, metalness: .5 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, .426, 2.75); laptop.add(pad);
  const lid = new THREE.Group(); lid.position.set(0, .42, -4.75); laptop.add(lid);
  const lidBody = new THREE.Mesh(new RoundedBoxGeometry(14, 9.3, .26, 6, .12), alu); lidBody.position.set(0, 4.65, -.13); lidBody.castShadow = true; lid.add(lidBody);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(13.7, 9.0), black); bezel.position.set(0, 4.65, .005); lid.add(bezel);
  const desk = canvasTexture(1440, 900);
  const dispMat = new THREE.MeshBasicMaterial({ map: desk.t, toneMapped: false, color: new THREE.Color(.8, .8, .8) });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(12.96, 8.1), dispMat); display.position.set(0, 4.78, .012); lid.add(display);
  lid.rotation.x = -.26;
  laptop.position.set(-1.0, 0, 0); laptop.rotation.y = .32;

  // ---------- téléphone ----------
  const phone = new THREE.Group(); scene.add(phone);
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, metalness: 1, roughness: .2, envMapIntensity: 1.4 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(3.7, 7.7, .4, 8, .5), frameMat); body.castShadow = true; phone.add(body);
  const front = new THREE.Mesh(new RoundedBoxGeometry(3.62, 7.62, .42, 8, .48), black); phone.add(front);
  const mob = canvasTexture(720, 1560);
  const mobMat = new THREE.MeshBasicMaterial({ map: mob.t, toneMapped: false, color: new THREE.Color(.84, .84, .84) });
  const mobScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.38, 7.32), mobMat); mobScreen.position.z = .215; phone.add(mobScreen);
  // coins arrondis de l'écran : masque alpha
  mobMat.alphaMap = (() => {
    const c = document.createElement('canvas'); c.width = 180; c.height = 390; const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 180, 390); ctx.fillStyle = '#fff'; roundRect(ctx, 0, 0, 180, 390, 22); ctx.fill();
    return new THREE.CanvasTexture(c);
  })();
  mobMat.transparent = true;
  const island = new THREE.Mesh(new RoundedBoxGeometry(1.0, .26, .02, 4, .12), new THREE.MeshBasicMaterial({ color: 0x000000 })); island.position.set(0, 3.38, .23); phone.add(island);

  // ---------- confettis de vente ----------
  const NC = 140;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), NC);
  conf.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NC * 3), 3);
  const cdat = [];
  for (let i = 0; i < NC; i++) {
    const a = R() * Math.PI * 2, sp = 4 + R() * 9;
    cdat.push({ v: new THREE.Vector3(Math.cos(a) * sp * .7, 5 + R() * 8, Math.sin(a) * sp * .35 + 1.5), r: new THREE.Vector3(R() * 9, R() * 9, R() * 9), g: R() < .6 });
    conf.setColorAt(i, cdat[i].g ? new THREE.Color(GREEN_HEX).multiplyScalar(1.6) : new THREE.Color(2, 2, 2));
  }
  conf.frustumCulled = false; scene.add(conf);
  const dummy = new THREE.Object3D();

  // ---------- état du site selon le temps ----------
  const tU = T.un, tPro = T.pro, tMod = T.moderne, tVend = T.vendre;
  // l'ordinateur enchaîne les métiers : garage, restaurant, artisan, boulangerie
  const SW = [[tPro + .22, 'garage', 'resto'], [tMod + .08, 'resto', 'artisan'], [T.pret - .1, 'artisan', 'boulangerie']];
  function deskState(t) {
    let trade = 'garage', next = null, swipe = 0;
    for (const [t0, a, b] of SW) {
      if (t >= t0 + .24) trade = b;
      else if (t >= t0) { trade = a; next = b; swipe = (t - t0) / .24; }
    }
    return {
      trade, next, swipe,
      nav: prog(t, tU + .02, tU + .22),
      hero: prog(t, T.site3 - .02, T.site3 + .34),
      h1: prog(t, T.site3 + .2, T.site3 + .42), h2: prog(t, T.site3 + .28, T.site3 + .5),
      cta: prog(t, tPro - .03, tPro + .25),
      stars: prog(t, tPro + .05, tPro + .4),
      sec: prog(t, tPro + .08, tPro + .3),
      cards: [0, 1, 2, 3].map(i => prog(t, tPro + .12 + i * .07, tPro + .42 + i * .07)),
      info: prog(t, tPro + .4, tPro + .7),
      scroll: 180 * eInOut(prog(t, tMod + .1, tMod + .6)),
      shine: prog(t, tPro - .02, tPro + .5),
      badge: prog(t, tVend + .12, tVend + .3),
    };
  }
  function mobState(t) {
    const trade = 'resto';
    const tapT = T.a + .06;
    const tx = lerp(560, 430, eInOut(prog(t, T.pret, tapT)));
    const ty = lerp(1150, 1462, eInOut(prog(t, T.pret, tapT)));
    return {
      trade,
      nav: prog(t, tMod - .02, tMod + .2),
      hero: prog(t, tMod, tMod + .3),
      h1: prog(t, tMod + .14, tMod + .34), h2: prog(t, tMod + .2, tMod + .4),
      cta: prog(t, tMod + .24, tMod + .44),
      chips: prog(t, tMod + .28, tMod + .48),
      cards: [0, 1, 2, 3].map(i => prog(t, tMod + .3 + i * .06, tMod + .55 + i * .06)),
      buy: prog(t, tMod + .34, tMod + .58),
      scroll: 330 * eInOut(prog(t, tMod + .45, T.pret + .05)),
      touchA: prog(t, T.pret - .05, T.pret + .08) * (1 - prog(t, tVend + .12, tVend + .3)),
      touchX: tx, touchY: ty, touchR: 46 * (1 - .25 * (prog(t, tapT, tapT + .06) - prog(t, tapT + .1, tapT + .2))),
      press: prog(t, tapT, tapT + .05) - prog(t, tapT + .08, tapT + .2),
      ripple: prog(t, tapT, tapT + .45),
      done: prog(t, tVend + .02, tVend + .2),
      toast: prog(t, tVend + .08, tVend + .4),
      badge: prog(t, tVend + .16, tVend + .36),
    };
  }

  const corners = [new THREE.Vector3(-6.48, .73, .02), new THREE.Vector3(6.48, .73, .02), new THREE.Vector3(6.48, 8.83, .02), new THREE.Vector3(-6.48, 8.83, .02)];
  const tmp = new THREE.Vector3();

  function update(t, post) {
    // ---------- caméra : d'abord l'ordinateur seul, puis le téléphone passe au premier plan ----------
    const toB = eInOut(prog(t, tMod - .02, tMod + .45));
    const az = lerp(lerp(-.5, -.34, smooth(prog(t, tU, tMod))), lerp(-.16, -.08, smooth(prog(t, tMod, T.devis))), toB);
    const el = lerp(.2, .16, toB);
    const d = lerp(lerp(55, 49, eOut(prog(t, tU, tMod))), lerp(42, 36.5, smooth(prog(t, tMod + .3, T.devis))), toB);
    const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(-3.37, 8.04, -5.66), new THREE.Vector3(2.87, 6.92, 3.58), toB);
    const p = tgt.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
    const shake = .015 + .25 * pulse(t, tPro, 12) + .15 * pulse(t, tVend, 12);
    p.x += noise1(t * 7, 21) * shake; p.y += noise1(t * 7, 22) * shake;
    camera.position.copy(p); camera.lookAt(tgt);
    camera.fov = 30 - 1.0 * pulse(t, tPro, 9);
    camera.updateProjectionMatrix();

    // ---------- ordinateur : arrive depuis la lumière ----------
    const lIn = eOut5(prog(t, tU - .02, tU + .5));
    laptop.position.set(-1.0, 0, lerp(-3, 0, lIn));
    laptop.rotation.y = .32 + (1 - lIn) * .25;
    lid.rotation.x = -.26 - (1 - eOut(prog(t, tU, tU + .45))) * .5;

    // ---------- téléphone : entre sur "moderne" en tournoyant ----------
    const k = spring(t - tMod + .03, 13, .62);
    const pin = clamp(k);
    phone.visible = t > tMod - .06;
    phone.position.set(lerp(12, 4.7, k), lerp(-2, 4.15, k) + Math.sin(t * 2.2) * .08, lerp(8, 3.4, k));
    phone.rotation.set(-.12 + (1 - pin) * .6, -.42 + (1 - pin) * 1.9, (1 - pin) * -.7 + .04);
    // pression du doigt : le téléphone recule légèrement
    const tapT = T.a + .06;
    phone.position.z -= .12 * (prog(t, tapT, tapT + .05) - prog(t, tapT + .08, tapT + .25));

    // ---------- écrans ----------
    drawDesktop(desk.ctx, 1440, 900, deskState(t), ph); desk.t.needsUpdate = true;
    if (phone.visible) { drawMobile(mob.ctx, 720, 1560, mobState(t), ph); mob.t.needsUpdate = true; }
    // l'ordinateur passe au second plan quand le téléphone arrive
    dispMat.color.setScalar((.8 + .15 * pulse(t, tPro, 6)) * (1 - .45 * toB));

    // ---------- confettis sur "vendre" ----------
    const cd = t - tVend - .05;
    conf.visible = cd > 0;
    if (cd > 0) {
      const origin = phone.localToWorld(new THREE.Vector3(0, -3.1, .3));
      cdat.forEach((c, i) => {
        dummy.position.set(origin.x + c.v.x * cd, origin.y + c.v.y * cd - 9 * cd * cd, origin.z + c.v.z * cd);
        dummy.rotation.set(c.r.x * cd * 2, c.r.y * cd * 2, c.r.z * cd * 2);
        dummy.scale.setScalar(clamp(cd * 8) * (1 - prog(cd, .8, 1.3)));
        dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
      });
      conf.instanceMatrix.needsUpdate = true;
    }

    haloMat.uniforms.uK.value = .3 + .15 * pulse(t, tPro, 4) + .3 * pulse(t, tVend, 3);

    // ---------- passage depuis le blanc : le flash se rétracte dans l'écran de l'ordinateur ----------
    const m = prog(t, tU - .01, tU + .3);
    if (m < 1) {
      laptop.updateMatrixWorld(true); camera.updateMatrixWorld();
      const uv = corners.map(c => { tmp.copy(c); lid.localToWorld(tmp); tmp.project(camera); return [tmp.x * .5 + .5, tmp.y * .5 + .5]; });
      const full = [[0, 0], [1, 0], [1, 1], [0, 1]];
      // le haut se rétracte plus vite pour libérer le texte
      const e = [eOut5(m), eOut5(m), eOut5(clamp(m * 1.6)), eOut5(clamp(m * 1.6))];
      const q = uv.map((c, i) => [lerp(full[i][0], c[0], e[i]), lerp(full[i][1], c[1], e[i])]);
      post.u.quadA.value.set(q[0][0], q[0][1], q[1][0], q[1][1]);
      post.u.quadB.value.set(q[2][0], q[2][1], q[3][0], q[3][1]);
      post.u.quadAlpha.value = 1 - eIn(prog(m, .55, 1));
    }
    post.bloom.strength = .5 + .25 * pulse(t, tVend, 4); post.bloom.radius = .55; post.bloom.threshold = .9;
    post.u.vignette.value = .5;
    post.u.ca.value = .0018 + .006 * pulse(t, tPro, 10);
  }

  return { scene, camera, update };
}
