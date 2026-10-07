import { existsSync } from 'node:fs';
import { run } from './run.js';

const BROWSERS = {
  safari: { name: 'Safari', app: 'Safari', path: '/Applications/Safari.app' },
  chrome: { name: 'Chrome', app: 'Google Chrome', path: '/Applications/Google Chrome.app' },
  firefox: { name: 'Firefox', app: 'Firefox', path: '/Applications/Firefox.app' },
  edge: { name: 'Edge', app: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app' },
};

export function listMacBrowsers() {
  return Object.entries(BROWSERS)
    .filter(([, b]) => existsSync(b.path))
    .map(([id, b]) => ({ id, name: b.name }));
}

export async function launchMac(browserId, url) {
  const b = BROWSERS[browserId];
  if (!b || !existsSync(b.path)) throw new Error('Browser non installato');
  await run('open', ['-a', b.app, url]);
}
