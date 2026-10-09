// Temps 5 : l'appel à l'action. Une bulle de messagerie verte en 3D sonne sur "WhatsApp",
// puis l'image finale reste lisible jusqu'au bout (la caméra continue de bouger doucement).
import * as THREE from 'three';
import { T, DURATION, clamp, lerp, prog, eOut, eOut5, eIn, eInOut, eBack, smooth, spring, pulse, rng, noise1, GREEN_HEX } from '../timeline.js';

function bubbleShape() {
  const s = new THREE.Shape();
  const r = 1;
  // cercle avec une petite queue en bas à gauche
  const a0 = Math.PI * 1.08, a1 = Math.PI * 1.32;
  s.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
  s.absarc(0, 0, r, a1, a0 + Math.PI * 2, false);
  s.lineTo(-1.12, -1.12);
  s.closePath();
  return s;
}

function handsetShape() {
  // combiné téléphonique simplifié (vu de face, incliné)
  const s = new THREE.Shape();
  const pts = [
    [-.34, .42], [-.18, .5], [-.08, .28], [-.18, .18], [-.12, .04], [.04, -.12], [.18, -.18], [.28, -.08], [.5, -.18], [.42, -.34],
    [.3, -.46], [.12, -.48], [-.08, -.4], [-.28, -.24], [-.42, -.04], [-.48, .14], [-.46, .3],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export function createCta(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = env;
  scene.environmentIntensity = .9;
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, .1, 200);
  const R = rng(55);

  scene.add(new THREE.AmbientLight(0xffffff, .08));
  const key = new THREE.DirectionalLight(0xffffff, .65); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(0xffffff, 40, 20, 1.6); rim.position.set(4, 2, -2); scene.add(rim);
  const rimG = new THREE.PointLight(GREEN_HEX, 50, 20, 1.6); rimG.position.set(-4, -3, -1); scene.add(rimG);

  // halo vert derrière la bulle
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uK; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ float d = length(vUv - .5) * 2.; vec3 c = vec3(.09, 1., .43) * exp(-d * d * 5.) * uK; c += (h(gl_FragCoord.xy) - .5) / 160.; gl_FragColor = vec4(c, 1.); }`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), glowMat); glow.position.set(0, 0, -4); scene.add(glow);

  // bulle 3D
  const bubbleG = new THREE.Group(); scene.add(bubbleG);
  const bubbleMat = new THREE.MeshPhysicalMaterial({ color: GREEN_HEX, roughness: .4, metalness: .0, clearcoat: .2, clearcoatRoughness: .3, emissive: GREEN_HEX, emissiveIntensity: .2, envMapIntensity: .25 });
  const bubble = new THREE.Mesh(new THREE.ExtrudeGeometry(bubbleShape(), { depth: .34, bevelEnabled: true, bevelThickness: .16, bevelSize: .14, bevelSegments: 8, curveSegments: 64 }), bubbleMat);
  bubble.geometry.center(); bubbleG.add(bubble);
  const hand = new THREE.Mesh(new THREE.ExtrudeGeometry(handsetShape(), { depth: .08, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 4 }),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .35, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: .12, envMapIntensity: .5 }));
  hand.position.set(.04, .05, .33); hand.scale.setScalar(1.05); bubbleG.add(hand);
  // pastille de notification (sans chiffre)
  const badge = new THREE.Mesh(new THREE.SphereGeometry(.24, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .2, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: .4 }));
  badge.position.set(.82, .8, .3); bubbleG.add(badge);

  // ondes de notification
  const rings = [0, 1, 2, 3, 4].map(i => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.3, .025, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(GREEN_HEX).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.z = -.3; scene.add(m); return m;
  });

  // particules qui montent
  const NP = 260, pp = new Float32Array(NP * 3), ps = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pp[i * 3] = (R() - .5) * 16; pp[i * 3 + 1] = (R() - .5) * 26; pp[i * 3 + 2] = -5 + R() * 9; ps[i] = R(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(ps, 1));
  const pmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uBurst: { value: -1 } },
    vertexShader: `attribute float seed; uniform float uT, uBurst; varying float vA; varying float vG;
      void main(){ vec3 p = position; p.y = mod(p.y + uT * (.6 + seed * 1.2) + 13., 26.) - 13.; p.x += sin(uT * .8 + seed * 30.) * .3;
        float b = uBurst < 0. ? 0. : (1. - exp(-uBurst * 4.)) * exp(-uBurst * .8);
        p.xy += normalize(p.xy + .001) * b * (1. + seed * 3.);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = (2. + seed * 5.) * (30. / -mv.z);
        vA = (.3 + .7 * seed); vG = step(.5, fract(seed * 7.7)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying float vG; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA * .6;
      gl_FragColor = vec4(mix(vec3(1.), vec3(.09, 1., .43) * 1.6, vG), a); }`,
  });
  const parts = new THREE.Points(pg, pmat); parts.frustumCulled = false; scene.add(parts);

  const tW = T.whatsapp;
  function update(t, post) {
    // caméra : lente poussée continue + légère orbite, jamais figée
    const u = prog(t, T.devis - .05, DURATION);
    const d = lerp(17, 15, smooth(u));
    const az = lerp(-.14, .12, smooth(u));
    camera.position.set(Math.sin(az) * d, noise1(t * .7, 41) * .03, Math.cos(az) * d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // la bulle monte, puis "sonne" sur WhatsApp
    const rise = eOut5(prog(t, T.devis + .05, T.gratuit + .35));
    const pop = spring(t - tW + .02, 20, .4);
    const ring = t > tW ? Math.sin((t - tW) * 55) * Math.exp(-(t - tW) * 7) : 0;
    const by = lerp(-6, -.98, rise) + Math.sin(t * 2.1) * .03;
    bubbleG.position.set(0, by, 0);
    bubbleG.rotation.set(Math.sin(t * 1.3) * .05, lerp(-1.2, 0, rise) + Math.sin(t * .9) * .16, ring * .2);
    const s = .66 * (t < tW ? 1 : 1 + .12 * (pop - 1) + .1 * Math.exp(-(t - tW) * 6));
    bubbleG.scale.setScalar(s);
    badge.scale.setScalar(t < tW ? 0 : Math.max(0, spring(t - tW - .05, 24, .4)));
    bubbleMat.emissiveIntensity = .16 + .3 * pulse(t, tW, 5);

    // ondes : sur WhatsApp puis régulièrement jusqu'à la fin
    rings.forEach((r, i) => {
      const t0 = tW + i * .6;
      const k = prog(t, t0, t0 + 1.2);
      r.position.y = bubbleG.position.y;
      r.scale.setScalar((.95 + eOut(k) * .75) * s);
      r.material.opacity = k > 0 && k < 1 ? Math.pow(1 - k, 1.5) * .6 : 0;
      r.rotation.set(0, 0, 0);
    });

    glowMat.uniforms.uK.value = (.07 + .12 * pulse(t, tW, 3)) * rise;
    glow.position.y = bubbleG.position.y;
    pmat.uniforms.uT.value = t;
    pmat.uniforms.uBurst.value = t < tW ? -1 : t - tW;
    parts.position.y = 0;

    post.bloom.strength = .5 + .3 * pulse(t, tW, 4); post.bloom.radius = .5; post.bloom.threshold = .88;
    post.u.vignette.value = .55;
    post.u.ca.value = .0018 + .01 * pulse(t, tW, 10) + .008 * pulse(t, T.devis, 10);
  }

  // le volet vert qui fait la transition depuis le temps 4 (couche DOM au-dessus de tout)
  function overlay(t, L) { void t; void L; }

  return { scene, camera, update, overlay };
}
