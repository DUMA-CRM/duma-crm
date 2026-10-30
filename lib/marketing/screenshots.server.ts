import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { SCREENSHOTS, SCREENSHOT_DIR, type ScreenshotKey } from '@/lib/marketing/screenshots';

/**
 * Whether a screenshot's file is in public/ yet. Read at render time on the
 * server, so a page can show the real capture the moment the PNG is dropped in
 * and a drawn stand-in until then — no code change either way.
 */
export function hasScreenshot(key: ScreenshotKey): boolean {
  return existsSync(join(process.cwd(), 'public', SCREENSHOT_DIR, SCREENSHOTS[key].file));
}
