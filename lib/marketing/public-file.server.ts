import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Whether a file is in public/ yet, read at render time on the server — so a
 * page can show a photo the moment it is dropped in, and a stand-in until then.
 * `path` is the public URL path, e.g. "/marketing/team/marian.jpg".
 */
export function hasPublicFile(path: string): boolean {
  return existsSync(join(process.cwd(), 'public', path));
}
