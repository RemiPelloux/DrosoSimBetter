import { chromium } from 'playwright-core';
import fs from "fs"; fs.mkdirSync("./.e2e-shots", { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
const U = 'http://localhost:3100';
await page.goto(U); await page.waitForTimeout(3500);
await page.screenshot({ path: './.e2e-shots/1-welcome.png' });
// simulator fresh -> onboarding
await page.goto(U + '/simulator'); await page.waitForTimeout(1200);
await page.screenshot({ path: './.e2e-shots/2-onboarding.png' });
for (let i=0;i<4;i++) await page.getByRole('button', { name: /Suivant|parti/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: './.e2e-shots/3-simulator.png', fullPage: true });
// draw a stroke on grid with late cherry
const grid = page.locator('div.grid.aspect-square').first();
const box = await grid.boundingBox();
const cell = box.width/20;
const at = (x,y)=>[box.x+cell*(x+.5), box.y+cell*(y+.5)];
await page.keyboard.press('4'); // late
await page.mouse.move(...at(1,19)); await page.mouse.down();
for (let x=1;x<10;x++) await page.mouse.move(...at(x,19));
await page.mouse.up();
await page.waitForTimeout(300);
const countAfterStroke = await page.evaluate(() => JSON.parse(localStorage.getItem('drososim-next-v2')).state.grid.filter(c=>c==='late-cherry').length);
// undo once should remove whole stroke
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
const countAfterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('drososim-next-v2')).state.grid.filter(c=>c==='late-cherry').length);
await page.keyboard.press('Control+y'); await page.waitForTimeout(300);
// right-click erase
await page.mouse.move(...at(5,19)); await page.mouse.down({button:'right'}); await page.mouse.up({button:'right'});
await page.waitForTimeout(200);
const afterErase = await page.evaluate(() => JSON.parse(localStorage.getItem('drososim-next-v2')).state.grid[19*20+5]);
// select tool menu
await page.keyboard.press('v'); await page.mouse.click(...at(4,8)); await page.waitForTimeout(400);
await page.screenshot({ path: './.e2e-shots/4-menu.png' });
const menuVisible = await page.getByText('Changer toute la parcelle').isVisible();
await page.keyboard.press('Escape');
// toggle treatment for a parcel via "Appliquer à toutes"
await page.getByRole('button', { name: /^Traitement$/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: './.e2e-shots/5-levers.png' });
// share link
await page.getByRole('button', { name: /Partager/ }).click(); await page.waitForTimeout(300);
const link = await page.evaluate(() => navigator.clipboard.readText());
// demo -> results
await page.goto(U); await page.getByRole('button', { name: /Voir une démo/ }).first().click();
await page.waitForURL(/results/); await page.waitForTimeout(2500);
await page.screenshot({ path: './.e2e-shots/6-results-top.png' });
await page.screenshot({ path: './.e2e-shots/7-results-full.png', fullPage: true });
const verdict = await page.locator('h2').first().textContent();
// overlay mode
await page.getByRole('button', { name: /Superposition/ }).click(); await page.waitForTimeout(600);
// share link roundtrip in fresh context
const ctx2 = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push('P2 ' + e.message));
await p2.goto(link); await p2.waitForTimeout(1500);
const sharedLate = await p2.evaluate(() => JSON.parse(localStorage.getItem('drososim-next-v2')).state.grid.filter(c=>c==='late-cherry').length);
// mobile
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage(); mp.on('pageerror', e => errors.push('M ' + e.message));
await mp.goto(U); await mp.waitForTimeout(1500); await mp.screenshot({ path: './.e2e-shots/8-mobile-welcome.png' });
console.log(JSON.stringify({ countAfterStroke, countAfterUndo, afterErase, menuVisible, linkLen: link.length, sharedLate, verdict, errors }, null, 1));
await b.close();
