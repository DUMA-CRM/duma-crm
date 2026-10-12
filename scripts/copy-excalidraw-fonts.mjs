// Copies Excalidraw's fonts into public/excalidraw-assets/fonts, so drawings load
// them from this app: by default Excalidraw fetches them from a CDN, which the
// CSP (`font-src 'self'`) refuses. Runs on install; the folder is git-ignored,
// so it always matches the installed version.
//
// Xiaolai (Chinese, Japanese, Korean — 12 of the 13 MB) is left out: text in
// those scripts falls back to a system font.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const target = join(root, 'public/excalidraw-assets/fonts');
const SKIP = new Set(['Xiaolai']);

if (!existsSync(source)) {
  console.warn('[excalidraw-fonts] package not installed; skipped');
} else {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const family of readdirSync(source)) {
    if (!SKIP.has(family)) cpSync(join(source, family), join(target, family), { recursive: true });
  }
  console.log(`[excalidraw-fonts] copied to ${target}`);
}
