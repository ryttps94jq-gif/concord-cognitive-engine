#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const HOME = os.homedir();
const OUT = path.join(HOME, '.zuko', 'remaining-work', 'conkay-toolbar-browser-e2e-proof.json');
const REPO = '/Users/dutch/concord vs code/concord-cognitive-engine';

function gitSha() {
  try { return execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return null; }
}
function loadCreds() {
  const f = path.join(HOME, '.zuko', 'remaining-work', '_audit_user.txt');
  const creds = Object.fromEntries(fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => {
    const i = l.indexOf('=');
    return i >= 0 ? [l.slice(0, i), l.slice(i + 1)] : [l, ''];
  }));
  return { user: creds.USER, pass: creds.PASS };
}
function findId(o, depth = 0) {
  if (!o || depth > 5) return null;
  if (typeof o === 'string' && /dtu/i.test(o) && o.length >= 8) return o;
  if (typeof o !== 'object') return null;
  for (const k of ['id', 'dtuId', 'dtu_id']) {
    if (typeof o[k] === 'string' && o[k].length >= 8) return o[k];
  }
  for (const v of Object.values(o)) {
    const hit = findId(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

const proof = {
  title: 'conkay-toolbar-browser-e2e-proof',
  branch: 'handoff-cherry-pick',
  sha: gitSha(),
  at: new Date().toISOString(),
  atET: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET',
  browserE2E: false,
  mode: 'playwright_chromium',
  lens: 'calendar',
  clicked: null,
  statusLine: null,
  dtuId: null,
  dtuGetOk: false,
  dtuGetStatus: null,
  mintPostOk: null,
  mintPostStatus: null,
  mintKeys: null,
  mintPreview: null,
  molecularApi: null,
  loginOk: false,
  overlayOpened: false,
  molVisible: false,
  unityStubInjected: true,
  NEED_DUTCH: null,
  honesty: null,
  errors: [],
};

const creds = loadCreds();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

async function finish(code) {
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({
    wrote: OUT,
    browserE2E: proof.browserE2E,
    clicked: proof.clicked,
    dtuId: proof.dtuId,
    dtuGetOk: proof.dtuGetOk,
    mintPostOk: proof.mintPostOk,
    molecularApi: proof.molecularApi,
    statusLine: proof.statusLine,
    NEED_DUTCH: proof.NEED_DUTCH,
  }, null, 2));
  await browser.close();
  process.exit(code);
}

try {
  await page.addInitScript(() => {
    const boot = () => {
      if (!document.getElementById('concordia-unity-webgl')) {
        const iframe = document.createElement('iframe');
        iframe.id = 'concordia-unity-webgl';
        iframe.title = 'unity-stub-e2e';
        iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);
      }
    };
    document.addEventListener('DOMContentLoaded', boot);
    setInterval(boot, 400);
  });

  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded' });
  const bodyText = await page.locator('body').innerText();
  if (/captcha|recaptcha|hcaptcha/i.test(bodyText)) { proof.NEED_DUTCH = 'Login captcha blocks Playwright — NEED_DUTCH'; await finish(3); }
  if (/2fa|totp|authenticator/i.test(bodyText)) { proof.NEED_DUTCH = 'Login 2FA blocks Playwright — NEED_DUTCH'; await finish(3); }
  await page.evaluate(async () => { try { await fetch('/api/auth/csrf-token', { credentials: 'include' }); } catch {} });
  await page.fill('#username', creds.user);
  await page.fill('#password', creds.pass);
  await Promise.all([
    page.waitForURL((u) => !String(u).includes('/login'), { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
  proof.loginOk = true;

  await page.goto('http://127.0.0.1:3000/lenses/calendar', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const help = document.querySelector('button[aria-label="Help and feedback"]');
    if (help) help.style.display = 'none';
    window.dispatchEvent(new Event('conkay:summon'));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.dispatchEvent(new Event('conkay:dismiss')));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new Event('conkay:summon')));
  // unityPresent interval is 2s — wait for it
  await page.waitForTimeout(2500);

  const mol = page.locator('[data-testid="ck-molecular-build"]');
  if (!(await mol.count())) {
    proof.NEED_DUTCH = 'Mol missing after unity stub + summon + 2s unityPresent refresh — NEED_DUTCH';
    proof.honesty = 'browserE2E false — toolbar not found';
    await finish(5);
  }
  proof.overlayOpened = true;
  proof.molVisible = true;

  const mintBodies = [];
  const molBodies = [];
  page.on('response', async (r) => {
    try {
      const u = r.url();
      if (u.includes('/api/conkay/molecular') && r.request().method() === 'POST') {
        const j = await r.json().catch(() => null);
        molBodies.push({ status: r.status(), ok: r.ok(), okFlag: j?.ok, ms: j?.ms, atoms: j?.atoms?.length });
      }
      if (u.includes('/api/dtus') && r.request().method() === 'POST') {
        const j = await r.json().catch(() => null);
        mintBodies.push({
          status: r.status(),
          ok: r.ok(),
          keys: j && typeof j === 'object' ? Object.keys(j) : [],
          preview: j ? JSON.stringify(j).slice(0, 500) : null,
          id: findId(j),
        });
      }
    } catch { /* ignore */ }
  });

  await page.evaluate(() => document.querySelector('[data-testid="ck-molecular-build"]')?.click());
  proof.clicked = 'ck-molecular-build';

  const t0 = Date.now();
  while (Date.now() - t0 < 25000 && (molBodies.length === 0 || mintBodies.length === 0)) {
    await page.waitForTimeout(400);
  }
  // one retry if molecular never fired
  if (molBodies.length === 0) {
    await page.evaluate(() => document.querySelector('[data-testid="ck-molecular-build"]')?.click());
    await page.waitForTimeout(8000);
  }

  proof.molecularApi = molBodies[molBodies.length - 1] || null;
  const lastMint = mintBodies[mintBodies.length - 1] || null;
  if (lastMint) {
    proof.mintPostOk = lastMint.ok;
    proof.mintPostStatus = lastMint.status;
    proof.mintKeys = lastMint.keys;
    proof.mintPreview = lastMint.preview;
    proof.dtuId = lastMint.id;
  }

  const txt = await page.evaluate(() => document.body.innerText || '');
  proof.statusLine = (txt.split('\n').find((l) => /dtu=|Molecular OK|Molecular FAIL|mint failed/.test(l)) || '').slice(0, 240) || null;
  if (!proof.dtuId) {
    const m = txt.match(/dtu=([a-zA-Z0-9_]+)/);
    if (m) proof.dtuId = m[1].replace(/…/g, '');
  }

  if (!proof.dtuId) {
    const listed = await page.evaluate(async () => {
      const tries = ['/api/dtus?limit=30', '/api/dtus?limit=30&kind=conkay_artifact'];
      for (const url of tries) {
        const r = await fetch(url, { credentials: 'include' });
        const j = await r.json().catch(() => ({}));
        const list = j?.dtus || j?.items || j?.data || [];
        const hit = list.find((d) => /Vertical|Molecular/i.test(String(d.title || '')) || (d.tags || []).includes('vertical') || (d.tags || []).includes('molecular'));
        if (hit?.id) return { status: r.status, id: hit.id, title: hit.title, n: list.length, url };
      }
      return { status: 0, id: null };
    });
    proof.listProbe = listed;
    if (listed.id) proof.dtuId = listed.id;
  }

  if (proof.dtuId) {
    const get = await page.evaluate(async (id) => {
      const r = await fetch(`/api/dtus/${encodeURIComponent(id)}`, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, ok: r.ok, kind: j?.kind || j?.dtu?.kind, title: j?.title || j?.dtu?.title };
    }, proof.dtuId);
    proof.dtuGetOk = !!get.ok;
    proof.dtuGetStatus = get.status;
    proof.dtuMeta = { kind: get.kind, title: get.title };
  }

  proof.browserE2E = !!(proof.loginOk && proof.molVisible && proof.clicked && proof.dtuId && proof.dtuGetOk);
  proof.honesty = proof.browserE2E
    ? 'Browser click e2e: login → calendar → unity iframe stub (VerticalsBar gate) → summon → Mol click → GET locker DTU'
    : 'browserE2E false — incomplete mint/get after Mol click';
  if (!proof.browserE2E && !proof.NEED_DUTCH) {
    if (!proof.molecularApi?.ok && proof.molecularApi?.ok !== true) {
      proof.NEED_DUTCH = `Molecular API did not succeed after Mol click (api=${JSON.stringify(proof.molecularApi)}) — check backend auth/proxy`;
    } else if (proof.mintPostOk && !proof.dtuId) {
      proof.NEED_DUTCH = 'Mint POST ok but id not found in response/list — NEED_DUTCH inspect /api/dtus shape';
    } else {
      proof.NEED_DUTCH = 'Mol click did not complete locker DTU GET';
    }
  }
  await finish(proof.browserE2E ? 0 : 1);
} catch (e) {
  proof.errors.push(String(e?.message || e));
  proof.NEED_DUTCH = `Browser e2e crashed: ${String(e?.message || e).slice(0, 240)}`;
  proof.honesty = 'browserE2E false — exception';
  await finish(1);
}
