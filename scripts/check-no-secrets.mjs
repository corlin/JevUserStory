import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.argv[2] ? join(process.cwd(), process.argv[2]) : process.cwd();
const forbidden = [
  { label: 'gateway environment assignment', pattern: /AI_GATEWAY_API_KEY\s*=\s*\S+/ },
  { label: 'authorization bearer value', pattern: /Authorization:\s*Bearer\s+\S+/i },
  { label: 'serialized authorization bearer value', pattern: /["']authorization["']\s*:\s*["']Bearer\s+[^"']+/i },
  { label: 'gateway header value', pattern: /x-ai-gateway-api-key["']?\s*[:=]\s*["'][^"']+/i },
];
const textExtensions = new Set([
  '.css', '.csv', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.snap', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

function trackedFiles() {
  return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function collectBuildArtifacts(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectBuildArtifacts(path, files);
    else if (textExtensions.has(extname(path)) || entry.name === 'BUILD_ID') files.push(relative(root, path));
  }
  return files;
}

const candidates = new Set([...trackedFiles(), ...collectBuildArtifacts(join(root, '.next'))]);
const violations = [];

for (const file of candidates) {
  const path = join(root, file);
  if (!existsSync(path) || statSync(path).size > 5_000_000) continue;
  if (!textExtensions.has(extname(path)) && !path.endsWith('BUILD_ID')) continue;
  const content = readFileSync(path, 'utf8');
  for (const rule of forbidden) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) violations.push({ file, label: rule.label });
  }
}

if (violations.length > 0) {
  console.error('Secret-leak gate failed. Potential secret values were found:');
  for (const violation of violations) console.error(`- ${violation.file}: ${violation.label}`);
  process.exit(1);
}

console.log(`Secret-leak gate passed (${candidates.size} tracked files and emitted artifacts checked).`);
