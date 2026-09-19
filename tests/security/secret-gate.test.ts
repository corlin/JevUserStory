import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];

afterEach(() => {
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe('secret leak gate', () => {
  it('fails when a serialized authorization value appears in an emitted client bundle', () => {
    const root = mkdtempSync(join(tmpdir(), 'resolveops-secret-gate-'));
    directories.push(root);
    mkdirSync(join(root, '.next', 'static', 'chunks'), { recursive: true });
    const emittedCanary = ['window.config={"authorization":"', 'Bearer synthetic-canary"};'].join('');
    writeFileSync(join(root, '.next', 'static', 'chunks', 'app.js'), emittedCanary);
    writeFileSync(join(root, 'safe.txt'), 'safe');
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', 'safe.txt'], { cwd: root });

    expect(() => execFileSync(process.execPath, [
      join(process.cwd(), 'scripts', 'check-no-secrets.mjs'), root,
    ], { cwd: root, stdio: 'pipe' })).toThrow();
  });
});
