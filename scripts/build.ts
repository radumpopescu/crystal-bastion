import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dir, '..');
const distDir = resolve(rootDir, 'dist');
const tempBundlePath = resolve(distDir, 'game.build.js');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const proc = Bun.spawn([
  'bun',
  'build',
  `--outfile=${tempBundlePath}`,
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

const [bundleSource, styleSource] = await Promise.all([
  readFile(tempBundlePath, 'utf8'),
  readFile(resolve(rootDir, 'style.css'), 'utf8'),
]);

const shortHash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 10);
const gameFileName = `game.${shortHash(bundleSource)}.js`;
const styleFileName = `style.${shortHash(styleSource)}.css`;

await Promise.all([
  rm(tempBundlePath, { force: true }),
  writeFile(resolve(distDir, gameFileName), bundleSource),
  writeFile(resolve(distDir, styleFileName), styleSource),
  writeFile(
    resolve(distDir, 'asset-manifest.json'),
    `${JSON.stringify({ script: gameFileName, style: styleFileName }, null, 2)}\n`,
  ),
  writeFile(
    resolve(distDir, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>Crystal Bastion</title>
  <link rel="stylesheet" href="./${styleFileName}">
</head>
<body>
  <canvas id="game"></canvas>
  <script src="./${gameFileName}" defer></script>
</body>
</html>
`,
  ),
]);

console.log(`Built dist/index.html with ${gameFileName} and ${styleFileName}.`);
