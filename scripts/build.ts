import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dir, '..');
const distDir = resolve(rootDir, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const proc = Bun.spawn([
  'bun',
  'build',
  `--outfile=${resolve(distDir, 'game.js')}`,
  '--target=browser',
  '--format=iife',
  '--sourcemap=none',
  resolve(rootDir, 'src/main.ts'),
], {
  cwd: rootDir,
  stdout: 'inherit',
  stderr: 'inherit',
});

const exitCode = await proc.exited;
if (exitCode !== 0) process.exit(exitCode);

const indexTemplate = await readFile(resolve(rootDir, 'index.html'), 'utf8');
await writeFile(resolve(distDir, 'index.html'), indexTemplate.replace('dist/game.js', 'game.js'));
await copyFile(resolve(rootDir, 'style.css'), resolve(distDir, 'style.css'));

console.log('Built dist/index.html and dist/game.js from the modular TypeScript source.');
