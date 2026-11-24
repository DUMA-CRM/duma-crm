import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] ?? join(root, 'dist', 'marketplace', 'creator-agreements.zip'));
const staging = await mkdtemp(join(tmpdir(), 'duma-creator-agreements-'));
const archive = join(staging, 'creator-agreements.zip');
try {
  await build({
    absWorkingDir: root,
    entryPoints: { app: 'scripts/marketplace/creator-agreements.tsx' },
    outdir: staging,
    bundle: true,
    minify: true,
    jsx: 'automatic',
    target: ['es2022'],
  });
  await writeFile(join(staging, 'index.html'), `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Creator Agreements</title>
  <link rel="stylesheet" href="./app.css">
  <script defer src="./app.js"></script>
</head>
<body><div id="app"></div></body>
</html>
`);
  execFileSync('zip', ['-q', '-X', archive, 'index.html', 'app.js', 'app.css'], { cwd: staging });
  if ((await stat(archive)).size > 640 * 1024) throw new Error('The release is larger than the publisher upload limit.');
  await mkdir(dirname(output), { recursive: true });
  await copyFile(archive, output);
  console.log(output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
