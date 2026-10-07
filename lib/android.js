import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { run, sleep } from './run.js';

const AVD_RE = /^[\w.-]+$/;
const SERIAL_RE = /^emulator-\d+$/;

function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(homedir(), 'Library/Android/sdk'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

function tools() {
  const root = sdkRoot();
  if (!root) return null;
  const emulator = path.join(root, 'emulator/emulator');
  const adb = path.join(root, 'platform-tools/adb');
  if (!existsSync(emulator) || !existsSync(adb)) return null;
  return { emulator, adb };
}

export async function androidStatus() {
  const t = tools();
  return {
    available: !!t,
    hint: t
      ? null
      : 'Installa Android Studio e crea almeno un dispositivo virtuale (Device Manager) con immagine "Google Play" per avere Chrome.',
  };
}

export async function listAndroidDevices() {
  const t = tools();
  if (!t) return [];
  const out = await run(t.emulator, ['-list-avds']);
  const running = await runningEmulators();
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && AVD_RE.test(s))
    .map((name) => ({
      id: name,
      name: name.replace(/_/g, ' '),
      osVersion: '',
      kind: /tablet|tab|pad/i.test(name) ? 'tablet' : 'phone',
      booted: Object.values(running).includes(name),
    }));
}

// { "emulator-5554": "Pixel_8_API_35", ... }
async function runningEmulators() {
  const t = tools();
  if (!t) return {};
  const out = await run(t.adb, ['devices']);
  const serials = out
    .split('\n')
    .map((l) => l.split('\t'))
    .filter(([s, state]) => SERIAL_RE.test(s) && state === 'device')
    .map(([s]) => s);
  const map = {};
  for (const s of serials) {
    try {
      const name = (await run(t.adb, ['-s', s, 'emu', 'avd', 'name'])).split('\n')[0].trim();
      map[s] = name;
    } catch {
      /* emulator still starting */
    }
  }
  return map;
}

async function serialFor(avd) {
  const running = await runningEmulators();
  return Object.keys(running).find((s) => running[s] === avd) || null;
}

async function waitForBoot(t, avd, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const serial = await serialFor(avd);
    if (serial) {
      try {
        const done = (await run(t.adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'])).trim();
        if (done === '1') return serial;
      } catch {
        /* not ready yet */
      }
    }
    await sleep(2000);
  }
  throw new Error('Timeout: l\'emulatore non si è avviato in tempo');
}

function assertAvd(avd) {
  if (!AVD_RE.test(avd)) throw new Error('Nome dispositivo non valido');
}

async function openInChrome(t, serial, url) {
  await run(t.adb, [
    '-s', serial, 'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', url,
    'com.android.chrome',
  ]);
}

export async function launchAndroid(avd, url) {
  assertAvd(avd);
  const t = tools();
  if (!t) throw new Error('Android SDK non trovato');
  if (!(await serialFor(avd))) {
    const child = spawn(t.emulator, ['-avd', avd], { detached: true, stdio: 'ignore' });
    child.unref();
  }
  const serial = await waitForBoot(t, avd);
  await openInChrome(t, serial, url);
}

export async function openUrlAndroid(avd, url) {
  assertAvd(avd);
  const t = tools();
  const serial = await serialFor(avd);
  if (!serial) throw new Error('Dispositivo non avviato');
  await openInChrome(t, serial, url);
}

export async function screenshotAndroid(avd, file) {
  assertAvd(avd);
  const t = tools();
  const serial = await serialFor(avd);
  if (!serial) throw new Error('Dispositivo non avviato');
  const png = await run(t.adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer' });
  await writeFile(file, png);
}

export async function shutdownAndroid(avd) {
  assertAvd(avd);
  const t = tools();
  const serial = await serialFor(avd);
  if (serial) await run(t.adb, ['-s', serial, 'emu', 'kill']);
}

export async function setAppearanceAndroid(avd, mode) {
  assertAvd(avd);
  if (!['light', 'dark'].includes(mode)) throw new Error('Modalità non valida');
  const t = tools();
  const serial = await serialFor(avd);
  if (!serial) throw new Error('Dispositivo non avviato');
  await run(t.adb, ['-s', serial, 'shell', 'cmd', 'uimode', 'night', mode === 'dark' ? 'yes' : 'no']);
}
