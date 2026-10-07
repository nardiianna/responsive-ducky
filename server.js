import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import * as ios from './lib/ios.js';
import * as android from './lib/android.js';
import * as mac from './lib/mac.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = Number(process.env.PORT) || 4747;
const HOST = '127.0.0.1'; // local only: this server can launch apps on the Mac

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function normalizeUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) throw new Error('Inserisci un URL');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const parsed = new URL(u);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL non valido');
  return parsed.toString();
}

const platforms = {
  ios: {
    launch: ios.launchIos,
    open: ios.openUrlIos,
    screenshot: ios.screenshotIos,
    shutdown: ios.shutdownIos,
    appearance: ios.setAppearanceIos,
  },
  android: {
    launch: android.launchAndroid,
    open: android.openUrlAndroid,
    screenshot: android.screenshotAndroid,
    shutdown: android.shutdownAndroid,
    appearance: android.setAppearanceAndroid,
  },
};

function platform(name) {
  const p = platforms[name];
  if (!p) throw new Error('Piattaforma non valida');
  return p;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error('Richiesta troppo grande');
  }
  return body ? JSON.parse(body) : {};
}

const api = {
  'GET /api/status': async () => {
    const [iosS, androidS] = await Promise.all([ios.iosStatus(), android.androidStatus()]);
    return { ios: iosS, android: androidS, mac: { available: true } };
  },

  'GET /api/devices': async () => {
    const [iosS, androidS] = await Promise.all([ios.iosStatus(), android.androidStatus()]);
    return {
      ios: iosS.available ? await ios.listIosDevices() : [],
      android: androidS.available ? await android.listAndroidDevices() : [],
      mac: mac.listMacBrowsers(),
    };
  },

  'POST /api/launch': async ({ platform: p, deviceId, browser, url }) => {
    const target = normalizeUrl(url);
    if (p === 'mac') {
      await mac.launchMac(browser, target);
    } else {
      await platform(p).launch(deviceId, target);
    }
    return { ok: true, url: target };
  },

  'POST /api/open': async ({ platform: p, deviceId, url }) => {
    const target = normalizeUrl(url);
    await platform(p).open(deviceId, target);
    return { ok: true, url: target };
  },

  'POST /api/screenshot': async ({ platform: p, deviceId, label }) => {
    const safe = String(label || deviceId).replace(/[^\w.-]+/g, '_').slice(0, 60);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${stamp}_${safe}.png`;
    await platform(p).screenshot(deviceId, path.join(SHOTS, name));
    return { ok: true, file: `/screenshots/${name}` };
  },

  'POST /api/appearance': async ({ platform: p, deviceId, mode }) => {
    await platform(p).appearance(deviceId, mode);
    return { ok: true };
  },

  'POST /api/shutdown': async ({ platform: p, deviceId }) => {
    await platform(p).shutdown(deviceId);
    return { ok: true };
  },
};

async function serveStatic(res, base, rel) {
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep)) return false;
  try {
    if (!(await stat(file)).isFile()) return false;
  } catch {
    return false;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
  return true;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const handler = api[`${req.method} ${pathname}`];

  if (handler) {
    // Block cross-site requests: only the dashboard itself may call the API.
    const origin = req.headers.origin;
    if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://${HOST}:${PORT}`) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = req.method === 'POST' ? await readJson(req) : {};
      const data = await handler(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      console.error(e);
      const msg = (e.stderr && String(e.stderr).trim().split('\n').pop()) || e.message;
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  if (req.method === 'GET') {
    if (pathname.startsWith('/screenshots/')) {
      if (await serveStatic(res, SHOTS, pathname.slice('/screenshots/'.length))) return;
    } else if (await serveStatic(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1))) {
      return;
    }
  }
  res.writeHead(404).end('Not found');
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Responsive Ducky attivo su ${url}`);
  if (!process.env.NO_OPEN) exec(`open ${url}`);
});
