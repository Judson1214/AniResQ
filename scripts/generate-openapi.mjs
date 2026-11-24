import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const exportScript = path.join(rootDir, 'apps', 'api', 'scripts', 'export_openapi.py');

// Try python3, then fallback to python
let pyCmd = 'python3';
let test = spawnSync(pyCmd, ['--version'], { stdio: 'ignore' });
if (test.error || test.status !== 0) {
  pyCmd = 'python';
  test = spawnSync(pyCmd, ['--version'], { stdio: 'ignore' });
  if (test.error || test.status !== 0) {
    console.error('Error: Neither python3 nor python was found in PATH.');
    process.exit(1);
  }
}

console.log(`Running OpenAPI export with: ${pyCmd}`);
const runPy = spawnSync(pyCmd, [exportScript], { stdio: 'inherit', cwd: rootDir });
if (runPy.status !== 0) {
  process.exit(runPy.status || 1);
}

// Run openapi-typescript via pnpm
console.log('Generating TypeScript types from openapi.json...');
const runTs = spawnSync('pnpm', ['--filter', '@aniresq/shared-types', 'run', 'generate:types'], {
  stdio: 'inherit',
  cwd: rootDir,
  shell: process.platform === 'win32',
});

if (runTs.status !== 0) {
  process.exit(runTs.status || 1);
}
