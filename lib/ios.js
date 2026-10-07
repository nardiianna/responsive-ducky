import { run, canRun } from './run.js';

const UDID_RE = /^[0-9A-F-]{36}$/i;

export async function iosStatus() {
  const ok = await canRun('xcrun', ['simctl', 'help']);
  return {
    available: ok,
    hint: ok
      ? null
      : 'Installa Xcode dall\'App Store, aprilo una volta e scarica la piattaforma iOS. Poi esegui: sudo xcode-select -s /Applications/Xcode.app',
  };
}

// "com.apple.CoreSimulator.SimRuntime.iOS-18-2" -> "18.2"
function runtimeVersion(key) {
  const m = key.match(/SimRuntime\.iOS-([\d-]+)$/);
  return m ? m[1].replace(/-/g, '.') : null;
}

export async function listIosDevices() {
  const out = await run('xcrun', ['simctl', 'list', 'devices', 'available', '-j']);
  const { devices } = JSON.parse(out);
  const list = [];
  for (const [runtime, devs] of Object.entries(devices)) {
    const version = runtimeVersion(runtime);
    if (!version) continue; // skip watchOS / tvOS / visionOS
    for (const d of devs) {
      if (!d.isAvailable) continue;
      list.push({
        id: d.udid,
        name: d.name,
        osVersion: version,
        kind: /iPad/i.test(d.name) ? 'tablet' : 'phone',
        booted: d.state === 'Booted',
      });
    }
  }
  // Newest OS first, then by name.
  list.sort((a, b) =>
    b.osVersion.localeCompare(a.osVersion, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  return list;
}

function assertUdid(udid) {
  if (!UDID_RE.test(udid)) throw new Error('UDID non valido');
}

export async function launchIos(udid, url) {
  assertUdid(udid);
  try {
    await run('xcrun', ['simctl', 'boot', udid]);
  } catch (e) {
    // Already booted is fine.
    if (!/current state: Booted/i.test(e.stderr || '')) throw e;
  }
  await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid]);
  await run('xcrun', ['simctl', 'bootstatus', udid], { timeout: 180_000 });
  await run('xcrun', ['simctl', 'openurl', udid, url]);
}

export async function openUrlIos(udid, url) {
  assertUdid(udid);
  await run('xcrun', ['simctl', 'openurl', udid, url]);
}

export async function screenshotIos(udid, file) {
  assertUdid(udid);
  await run('xcrun', ['simctl', 'io', udid, 'screenshot', file]);
}

export async function shutdownIos(udid) {
  assertUdid(udid);
  await run('xcrun', ['simctl', 'shutdown', udid]);
}

export async function setAppearanceIos(udid, mode) {
  assertUdid(udid);
  if (!['light', 'dark'].includes(mode)) throw new Error('Modalità non valida');
  await run('xcrun', ['simctl', 'ui', udid, 'appearance', mode]);
}
