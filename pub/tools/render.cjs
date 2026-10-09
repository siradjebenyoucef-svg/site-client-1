// Rendu déterministe image par image de src/index.html.
//   node tools/render.cjs stills out/dir 0.1 1.5 3.2 ...     -> images PNG aux instants donnés
//   node tools/render.cjs video out.mp4 [--sub 2] [--from 0 --to 13]
// --sub N : N sous-images par image moyennées (flou de bougé réel), rendu à 30 i/s.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', 'src');
const THREE_DIR = path.join(__dirname, '..', 'node_modules', 'three');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      let f = u.startsWith('/three/') ? path.join(THREE_DIR, u.slice(7)) : path.join(ROOT, u === '/' ? 'index.html' : u);
      // TIMINGS=fichier.json : instants des mots mesurés sur une voix (sinon valeurs du brief)
      if (u === '/timings.json') f = process.env.TIMINGS || '/nonexistent';
      fs.readFile(f, (e, d) => {
        if (e) { s.writeHead(404); s.end(); return; }
        s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        s.end(d);
      });
    }).listen(0, () => res(srv));
  });
}

async function open() {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const PREVIEW = !!process.env.PREVIEW;
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: PREVIEW ? .5 : 1 });
  page.on('console', m => { const x = m.text(); if (!/GPU stall|GL Driver/.test(x)) console.log('[page]', x); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${srv.address().port}/index.html${PREVIEW ? '?preview' : ''}`);
  await page.waitForFunction(() => window.ready || window.bootError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.bootError);
  if (err) { console.error(err); process.exit(1); }
  return { srv, browser, page };
}

let cdp = null;
async function shot(page, t, frame) {
  await page.evaluate(([t, f]) => window.renderFrame(t, f), [t, frame]);
  if (!cdp) cdp = await page.context().newCDPSession(page);
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const { srv, browser, page } = await open();
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const ts of rest) {
      const t = parseFloat(ts);
      const buf = await shot(page, t, Math.round(t * 30));
      fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`), buf);
      process.stdout.write('.');
    }
    console.log(' ok');
  } else if (mode === 'video') {
    const opt = k => { const i = rest.indexOf(k); return i >= 0 ? parseFloat(rest[i + 1]) : null; };
    const sub = opt('--sub') || 1, fps = 30;
    const dur = await page.evaluate(() => window.DURATION);
    const from = opt('--from') ?? 0, to = opt('--to') ?? dur;
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    // les sous-images sont fusionnées par ffmpeg (tmix) : on rend à fps*sub puis on moyenne
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-i', '-'];
    if (sub > 1) args.push('-vf', `tmix=frames=${sub}:weights='${Array(sub).fill(1).join(' ')}',select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB)`);
    args.push('-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    const adaptive = rest.includes('--blur');
    const FAST = adaptive ? await page.evaluate(() => window.FAST) : [];
    const { PNG } = require('pngjs');
    for (let f = f0; f < f1; f++) {
      if (adaptive) {
        // flou de bougé seulement sur les passages rapides : 3 sous-images moyennées (obturateur 180°)
        const tf = f / fps;
        const n = FAST.some(([a, b]) => tf >= a && tf <= b) ? 2 : 1;
        let buf;
        if (n === 1) buf = await shot(page, tf, f);
        else {
          let acc = null, img = null;
          for (let s = 0; s < n; s++) {
            const t = (f + ((s + .5) / n - .5) * .5) / fps;
            img = PNG.sync.read(await shot(page, Math.max(0, t), f));
            if (!acc) acc = new Float32Array(img.data.length);
            for (let i = 0; i < acc.length; i++) acc[i] += img.data[i];
          }
          for (let i = 0; i < acc.length; i++) img.data[i] = acc[i] / n + .5;
          buf = PNG.sync.write(img, { deflateLevel: 1 });
        }
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      } else for (let s = 0; s < sub; s++) {
        // obturateur à 180° : sous-images centrées sur l'instant de l'image
        const t = (f + ((s + .5) / sub - .5) * .5) / fps;
        const buf = await shot(page, Math.max(0, t), f);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if ((f - f0) % 30 === 0) console.log(`image ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('OK', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  await browser.close(); srv.close();
})();
