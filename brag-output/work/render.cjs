// Usage:
//   node render.cjs stills <outdir> t1 t2 ...     → PNG stills at given times (seconds)
//   node render.cjs video <out.mp4>               → pipes every frame into ffmpeg (silent video)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'video.html'));
  await page.evaluate(() => window.__ready);
  const FPS = 30;
  const duration = await page.evaluate(() => window.DURATION);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const s of rest) {
      const t = parseFloat(s);
      await page.evaluate(t => window.render(t), t);
      await settle();
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`) });
    }
  } else if (mode === 'video') {
    const N = Math.round(duration * FPS);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < N; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      await settle();
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`frame ${f}/${N}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done', N, 'frames');
  }
  await browser.close();
})();
