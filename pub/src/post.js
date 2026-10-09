// Chaîne de post-traitement : rayons volumétriques, halo (bloom), onde de choc,
// aberration chromatique, vignette, grain, flash et volet "morphing".
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class GodRaysPass extends Pass {
  constructor(w, h) {
    super();
    this.needsSwap = true;
    const o = { type: THREE.HalfFloatType };
    this.rtA = new THREE.WebGLRenderTarget(w / 2, h / 2, o);
    this.rtB = new THREE.WebGLRenderTarget(w / 2, h / 2, o);
    this.params = { center: new THREE.Vector2(.5, .5), intensity: 0, threshold: .6, decay: .965, density: .9 };
    this.pre = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: .6 } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(max(c.r,c.g),c.b);
          gl_FragColor = vec4(c * smoothstep(threshold, threshold + .4, l), 1.); }`,
    }));
    this.blur = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, center: { value: new THREE.Vector2() }, decay: { value: .96 }, density: { value: .9 } },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 center; uniform float decay, density; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){ const int N = 56; vec2 d = (vUv - center) * density / float(N); vec2 uv = vUv - d * h(gl_FragCoord.xy); float w = 1.; vec3 acc = vec3(0.);
          for(int i=0;i<N;i++){ uv -= d; acc += texture2D(tDiffuse, uv).rgb * w; w *= decay; }
          gl_FragColor = vec4(acc / float(N) * 2.2, 1.); }`,
    }));
    this.comp = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tRays: { value: null }, intensity: { value: 0 } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse, tRays; uniform float intensity; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb + texture2D(tRays, vUv).rgb * intensity, 1.); }`,
    }));
  }
  render(renderer, writeBuffer, readBuffer) {
    const p = this.params;
    if (p.intensity <= 0.001) {
      this.comp.material.uniforms.tDiffuse.value = readBuffer.texture;
      this.comp.material.uniforms.intensity.value = 0;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.comp.render(renderer); return;
    }
    this.pre.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.pre.material.uniforms.threshold.value = p.threshold;
    renderer.setRenderTarget(this.rtA); this.pre.render(renderer);
    const b = this.blur.material.uniforms;
    b.tDiffuse.value = this.rtA.texture; b.center.value.copy(p.center); b.decay.value = p.decay; b.density.value = p.density;
    renderer.setRenderTarget(this.rtB); this.blur.render(renderer);
    const c = this.comp.material.uniforms;
    c.tDiffuse.value = readBuffer.texture; c.tRays.value = this.rtB.texture; c.intensity.value = p.intensity;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.comp.render(renderer);
  }
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, frame: { value: 0 }, aspect: { value: 1080 / 1920 },
    swCenter: { value: new THREE.Vector2(.5, .5) }, swRadius: { value: -1 }, swWidth: { value: .08 }, swStrength: { value: 0 },
    ca: { value: .002 }, vignette: { value: .35 }, grain: { value: .06 },
    flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) },
    quadA: { value: new THREE.Vector4(0, 0, 1, 0) }, quadB: { value: new THREE.Vector4(1, 1, 0, 1) }, quadAlpha: { value: 0 },
    exposure: { value: 1 }, blackLevel: { value: 0 },
  },
  vertexShader: VS,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, frame, aspect;
    uniform vec2 swCenter; uniform float swRadius, swWidth, swStrength;
    uniform float ca, vignette, grain, flash, quadAlpha, exposure, blackLevel; uniform vec3 flashColor;
    uniform vec4 quadA, quadB; // coins (x0,y0,x1,y1) et (x2,y2,x3,y3) dans l'ordre bg, bd, hd, hg
    varying vec2 vUv;
    float hash(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
    float cross2(vec2 a, vec2 b){ return a.x*b.y - a.y*b.x; }
    float inQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d){
      float s1 = cross2(b-a, p-a), s2 = cross2(c-b, p-b), s3 = cross2(d-c, p-c), s4 = cross2(a-d, p-d);
      bool pos = s1>=0. && s2>=0. && s3>=0. && s4>=0.; bool neg = s1<=0. && s2<=0. && s3<=0. && s4<=0.;
      return (pos || neg) ? 1. : 0.;
    }
    void main(){
      vec2 uv = vUv;
      vec2 asp = vec2(1., 1. / aspect);
      // onde de choc : anneau qui déforme l'image
      float ring = 0.;
      if (swRadius > 0.) {
        vec2 d = (uv - swCenter) * asp; float dist = length(d);
        float x = (dist - swRadius) / swWidth;
        float bump = x * exp(-x * x * 2.);
        uv -= normalize(d + 1e-5) / asp * bump * swStrength;
        ring = exp(-x * x * 3.) * swStrength * 6.;
      }
      // aberration chromatique radiale
      vec2 cdir = (uv - .5);
      float cak = ca * (1. + ring * 4.);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + cdir * cak).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - cdir * cak).b;
      col += vec3(.75, 1., .85) * ring * .25;
      col *= exposure;
      // volet "morphing" : quadrilatère blanc qui part du plein écran vers l'écran de l'ordinateur
      if (quadAlpha > 0.) {
        float q = inQuad(vUv, quadA.xy, quadA.zw, quadB.xy, quadB.zw);
        col = mix(col, vec3(1.), q * quadAlpha);
      }
      // vignette
      vec2 v = (vUv - .5) * vec2(1., 1.15);
      col *= 1. - vignette * smoothstep(.25, .85, length(v) * 1.25);
      // flash
      col = mix(col, flashColor, clamp(flash, 0., 1.));
      // grain argentique (déterministe)
      float n = hash(vec3(gl_FragCoord.xy, frame)) - .5;
      col += n * grain * (.35 + .65 * (1. - smoothstep(0., .8, dot(col, vec3(.333)))));
      col = max(col, vec3(blackLevel));
      // conversion linéaire -> sRGB (remplace la passe de sortie)
      col = clamp(col, 0., 1.);
      vec3 lo = col * 12.92, hi = 1.055 * pow(col, vec3(1. / 2.4)) - .055;
      col = mix(lo, hi, step(vec3(.0031308), col));
      gl_FragColor = vec4(col, 1.);
    }`,
};

export class Post {
  constructor(renderer, w, h) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: window.MSAA ?? 2 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.rays = new GodRaysPass(w, h);
    this.composer.addPass(this.rays);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), .8, .55, .7);
    { const setSize = this.bloom.setSize.bind(this.bloom); this.bloom.setSize = (sw, sh) => setSize(sw / 2, sh / 2); }
    this.composer.addPass(this.bloom);
    this.final = new (class extends Pass {
      constructor() {
        super();
        this.material = new THREE.ShaderMaterial(FinalShader);
        this.quad = new FullScreenQuad(this.material);
        this.uniforms = this.material.uniforms;
      }
      render(renderer, writeBuffer, readBuffer) {
        this.uniforms.tDiffuse.value = readBuffer.texture;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this.quad.render(renderer);
      }
    })();
    this.composer.addPass(this.final);
    this.u = this.final.uniforms;
  }
  reset() {
    const u = this.u;
    u.swRadius.value = -1; u.swStrength.value = 0; u.ca.value = .0018; u.vignette.value = .38; u.grain.value = .055;
    u.flash.value = 0; u.flashColor.value.setRGB(1, 1, 1); u.quadAlpha.value = 0; u.exposure.value = 1; u.blackLevel.value = 0;
    this.rays.params.intensity = 0;
    this.bloom.strength = .8; this.bloom.radius = .55; this.bloom.threshold = .7;
  }
  render(scene, camera, frame) {
    this.rays.enabled = this.rays.params.intensity > .001;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.u.frame.value = frame;
    this.composer.render();
  }
}
