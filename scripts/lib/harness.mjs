// Utilitaires communs aux scripts de test et de génération de médias.
import fs from 'node:fs';

export const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
export const SHOTS_DIR = process.env.SHOTS_DIR ?? '.e2e-shots';

/** Chromium : $CHROMIUM_PATH, sinon navigateur fourni par Playwright, sinon navigateurs système courants. */
export async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  const candidates = [
    process.env.CHROMIUM_PATH,
    (() => { try { return chromium.executablePath(); } catch { return undefined; } })(),
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const executablePath = candidates.find(p => fs.existsSync(p));
  if (!executablePath) {
    console.error('✗ Aucun Chromium trouvé. Installez-en un (npx playwright install chromium) ou définissez CHROMIUM_PATH.');
    process.exit(2);
  }
  return chromium.launch({ executablePath });
}

/** Mini-harnais d'assertions : affiche ✓ / ✗ et fixe le code de sortie. */
export function createSuite(title) {
  const results = [];
  console.log(`\n▶ ${title}\n`);
  return {
    check(name, ok, detail = '') {
      results.push({ name, ok: !!ok });
      console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
      return !!ok;
    },
    done() {
      const failed = results.filter(r => !r.ok);
      console.log(`\n${failed.length ? '✗' : '✓'} ${results.length - failed.length}/${results.length} vérifications réussies\n`);
      process.exitCode = failed.length ? 1 : 0;
      return failed.length === 0;
    },
  };
}

/** Lit l'état persistant du store dans la page (clé localStorage de l'application). */
export const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('drososim-next-v2') ?? '{"state":{}}').state);
