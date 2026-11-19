import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tsc = path.resolve('node_modules/typescript/bin/tsc');
execFileSync(
  process.execPath,
  [tsc, 'web/src/core/orbitalEngine.ts', 'web/src/core/types.ts', '--outDir', '.tmp/engine', '--target', 'es2020', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck'],
  { stdio: 'inherit' }
);
fs.writeFileSync('.tmp/engine/package.json', '{"type":"module"}');
