import { execFile } from 'node:child_process';

// Runs a command without a shell (args are never interpolated).
export function run(cmd, args = [], { timeout = 60_000, encoding = 'utf8' } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, encoding, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

export async function canRun(cmd, args) {
  try {
    await run(cmd, args, { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
