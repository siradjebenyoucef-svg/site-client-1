const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', 'src'), THREE_DIR = path.join(__dirname, '..', 'node_modules', 'three');
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/three/') ? path.join(THREE_DIR, u.slice(7)) : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); s.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('LOG', m.text()));
  await p.goto(`http://localhost:${srv.address().port}/test-photos.html`); await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const { out, ms } = await p.evaluate(() => ({ out: window.out, ms: window.ms }));
  console.log('ms', ms.toFixed(0));
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(process.argv[2], k + '.png'), Buffer.from(v.split(',')[1], 'base64'));
  await b.close(); srv.close(); });
