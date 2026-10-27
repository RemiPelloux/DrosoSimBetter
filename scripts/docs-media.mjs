// =============================================================================
// Régénère les médias du README et de la documentation (docs/assets/)
//   npm run docs:media          → démarre le serveur de production, capture, l'arrête
// Produit : ecran-*.jpg (captures), demo.mp4 et demo.gif (parcours de 25 s).
// Prérequis : build (npm run build), Chromium, ffmpeg et ImageMagick (magick).
// =============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BASE_URL, launchBrowser } from './lib/harness.mjs';

const OUT = process.env.MEDIA_OUT ?? 'docs/assets';
const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };
for (const cmd of ['ffmpeg', 'magick']) if (!has(cmd)) { console.error(`✗ « ${cmd} » est requis.`); process.exit(2); }

const browser = await launchBrowser();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drososim-media-'));
const toJpg = (png, name) => { execFileSync('magick', [png, '-quality', '84', path.join(OUT, `${name}.jpg`)]); console.log(`  ✓ ${name}.jpg`); };

try {
  // ---------------------------------------------------------------- captures
  console.log('▶ Captures');
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const capture = async name => { const f = path.join(tmp, `${name}.png`); await p.screenshot({ path: f }); toJpg(f, name); };
  await p.goto(BASE_URL); await p.waitForTimeout(2800); await capture('ecran-accueil');
  await p.getByRole('button', { name: /Voir la démo/ }).first().click(); await p.waitForURL(/results/); await p.waitForTimeout(3500);
  await capture('ecran-resultats');
  for (const [id, name] of [['synthese', 'ecran-synthese'], ['territoire', 'ecran-territoire']]) {
    await p.locator(`a[href="#${id}"]`).first().click(); await p.waitForTimeout(2000); await capture(name);
  }
  await p.goto(`${BASE_URL}/simulator`); await p.waitForTimeout(2500); await capture('ecran-simulateur');
  await p.goto(`${BASE_URL}/docs/modele`); await p.waitForTimeout(1500); await capture('ecran-docs');
  await p.context().close();

  // ---------------------------------------------------------------- vidéo du parcours
  console.log('▶ Vidéo du parcours');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, recordVideo: { dir: tmp, size: { width: 1280, height: 760 } } });
  const v = await ctx.newPage();
  const wait = ms => v.waitForTimeout(ms);
  await v.goto(BASE_URL); await wait(4500);
  await v.getByRole('button', { name: /Protection intégrée/ }).first().click(); await wait(1800);
  await v.getByRole('button', { name: /Dessiner mon verger|Reprendre/ }).first().click(); await v.waitForURL(/simulator/); await wait(1200);
  const skip = v.getByRole('button', { name: 'Passer' }); if (await skip.isVisible().catch(() => false)) { await skip.click(); await wait(400); }
  await v.getByRole('button', { name: /Modèles/ }).first().click(); await wait(500); await v.getByText('Page blanche').click(); await wait(500);
  const box = await v.locator('div.grid.aspect-square').first().boundingBox(); const c = box.width / 20;
  const at = (x, y) => [box.x + c * (x + 0.5), box.y + c * (y + 0.5)];
  const rect = async (key, a, b) => { await v.keyboard.press(key); await v.keyboard.press('r'); await v.mouse.move(...at(...a)); await v.mouse.down(); await v.mouse.move(...at(...b), { steps: 12 }); await v.mouse.up(); await wait(300); };
  await rect('1', [0, 0], [19, 2]); await rect('2', [2, 5], [8, 12]); await rect('4', [11, 5], [17, 12]);
  await v.keyboard.press('3'); await v.keyboard.press('b');
  await v.mouse.move(...at(2, 15)); await v.mouse.down(); for (let x = 2; x < 18; x++) await v.mouse.move(...at(x, 15 + (x % 2)), { steps: 2 }); await v.mouse.up(); await wait(900);
  await v.getByRole('button', { name: /^Filet$/ }).first().click(); await wait(700);
  await v.getByRole('button', { name: /^Prophylaxie$/ }).first().click(); await wait(1500);
  await v.getByRole('link', { name: /Voir l.analyse complète/ }).click(); await v.waitForURL(/results/); await wait(4200);
  await v.mouse.wheel(0, 900); await wait(2400); await v.mouse.wheel(0, 1100); await wait(2200);
  const video = await v.video().path();
  await ctx.close();

  console.log('▶ Encodage');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', path.join(OUT, 'demo.mp4')]);
  console.log('  ✓ demo.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-vf', 'fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle', path.join(OUT, 'demo.gif')]);
  console.log(`  ✓ demo.gif (${(fs.statSync(path.join(OUT, 'demo.gif')).size / 1e6).toFixed(1)} Mo)`);
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
