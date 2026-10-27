// =============================================================================
// Parcours navigateur de bout en bout (Playwright)
//   npm run test:e2e              → démarre le serveur de production, teste, l'arrête
//   BASE_URL=http://localhost:3000 node scripts/test-e2e.mjs   → contre un serveur existant
// Variables : BASE_URL, CHROMIUM_PATH, SHOTS_DIR (captures, par défaut .e2e-shots/)
// =============================================================================
import fs from 'node:fs';
import { BASE_URL, SHOTS_DIR, launchBrowser, createSuite, readState } from './lib/harness.mjs';

fs.mkdirSync(SHOTS_DIR, { recursive: true });
const t = createSuite(`Parcours navigateur — ${BASE_URL}`);
const shot = (page, name, full = false) => page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, fullPage: full });
const count = (state, type) => state.grid.filter(c => c === type).length;

const browser = await launchBrowser();
const errors = [];
const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text())); };

try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); watch(page);

  // 1. Accueil
  await page.goto(BASE_URL); await page.waitForTimeout(2500); await shot(page, '1-accueil');
  t.check('accueil : titre affiché', await page.getByText('éclairée.').first().isVisible());
  t.check('accueil : 6 logos partenaires', (await page.locator('section img[src*="partners"]').count()) >= 6);

  // 2. Simulateur : onboarding puis modèle
  await page.goto(`${BASE_URL}/simulator`); await page.waitForTimeout(1000); await shot(page, '2-onboarding');
  t.check('simulateur : visite guidée à la première visite', await page.getByText('Étape 1 sur 4').isVisible());
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Suivant|parti/ }).click();
  await page.waitForTimeout(1200); await shot(page, '3-simulateur', true);
  t.check('simulateur : modèle de verger chargé après la visite', (await readState(page)).grid.some(c => c !== 'neutral'));

  // 3. Dessin, annulation, gomme, menu d'édition
  const grid = page.locator('div.grid.aspect-square').first();
  const box = await grid.boundingBox(); const cell = box.width / 20;
  const at = (x, y) => [box.x + cell * (x + 0.5), box.y + cell * (y + 0.5)];
  const before = count(await readState(page), 'late-cherry');
  await page.keyboard.press('4');
  await page.mouse.move(...at(1, 19)); await page.mouse.down(); await page.mouse.move(...at(9, 19), { steps: 2 }); await page.mouse.up(); await page.waitForTimeout(300);
  const after = count(await readState(page), 'late-cherry');
  t.check('dessin : trait rapide interpolé (9 cases)', after - before === 9, `${after - before} cases`);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  t.check('annuler : le trait entier en une seule étape', count(await readState(page), 'late-cherry') === before);
  await page.keyboard.press('Control+y'); await page.waitForTimeout(300);
  await page.mouse.move(...at(5, 19)); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(200);
  t.check('clic droit : gomme', (await readState(page)).grid[19 * 20 + 5] === 'neutral');
  await page.keyboard.press('v'); await page.mouse.click(...at(4, 8)); await page.waitForTimeout(400); await shot(page, '4-menu');
  t.check('menu d’édition d’une parcelle', await page.getByText('Changer toute la parcelle').isVisible());
  await page.keyboard.press('Escape');

  // 4. Leviers et partage
  await page.getByRole('button', { name: /^Traitement$/ }).first().click(); await page.waitForTimeout(500);
  const st = await readState(page);
  const active = st.strategies.find(s => s.id === st.activeStrategyId);
  t.check('« Appliquer à toutes » active le traitement', Object.values(active.leversByParcel).some(l => l.treatment));
  await page.getByRole('button', { name: /Partager/ }).click(); await page.waitForTimeout(300);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  t.check('lien de partage copié', link.includes('?sim='), `${link.length} caractères`);

  // 5. Démo → résultats
  await page.goto(BASE_URL); await page.getByRole('button', { name: /Voir la démo/ }).first().click();
  await page.waitForURL(/results/); await page.waitForTimeout(2500); await shot(page, '5-resultats'); await shot(page, '6-resultats-complet', true);
  const verdict = await page.locator('h2').first().textContent();
  t.check('résultats : verdict calculé', !!verdict && verdict.length > 3, verdict);
  t.check('résultats : graphiques rendus', (await page.locator('.recharts-wrapper').count()) >= 6);
  await page.getByRole('button', { name: /Superposition/ }).click(); await page.waitForTimeout(500);
  t.check('mode superposition', (await page.locator('#dynamique .recharts-line').count()) >= 4);

  // 6. Lien de partage rejoué dans un navigateur vierge
  const p2 = await (await browser.newContext()).newPage(); watch(p2);
  await p2.goto(link); await p2.waitForTimeout(1500);
  t.check('lien de partage : scénario restauré', count(await readState(p2), 'late-cherry') === count(st, 'late-cherry'));

  // 7. Mobile
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); watch(m);
  await m.goto(BASE_URL); await m.waitForTimeout(1500); await shot(m, '7-mobile');
  t.check('mobile : pas de débordement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

  t.check('aucune erreur console', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  t.check('exécution du parcours', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
  t.done();
}
