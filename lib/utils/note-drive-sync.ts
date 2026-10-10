// What a note's Google Docs sync looks like to the person who turned it on.
// One way, DUMA → Google: the API pushes shortly after editing stops, and stops
// (rather than overwrite) when the Doc was edited in Google. Pure, so it's
// tested in tests/note-drive-sync.test.mts.

export interface DriveSyncLike {
  status: 'active' | 'conflict' | 'missing' | 'error';
  url: string | null;
  pushedAt: string | null;
  lastError: string | null;
  pending: boolean;
}

/** What someone can do about a stopped sync. */
export type DriveSyncFix = 'overwrite' | 'recreate' | 'retry';

export interface DriveSyncSummary {
  /** `quiet`: a status line. `stopped`: an alert that needs a choice. */
  tone: 'quiet' | 'stopped';
  message: string;
  /** For `quiet`: show "Synced <time>" after the message. */
  showPushedAt: boolean;
  fix: DriveSyncFix | null;
  fixLabel: string | null;
}

export function driveSyncSummary(sync: DriveSyncLike): DriveSyncSummary {
  switch (sync.status) {
    case 'conflict':
      return {
        tone: 'stopped',
        message: 'The Google Doc was edited in Google since DUMA last saved it, so syncing has paused.',
        showPushedAt: false,
        fix: 'overwrite',
        fixLabel: 'Overwrite the Google Doc',
      };
    case 'missing':
      return {
        tone: 'stopped',
        message: 'The Google Doc was deleted in Drive, so syncing has paused.',
        showPushedAt: false,
        fix: 'recreate',
        fixLabel: 'Make a new Google Doc',
      };
    case 'error':
      return {
        tone: 'stopped',
        message: sync.lastError ? `Syncing to Google Docs stopped: ${sync.lastError}` : 'Syncing to Google Docs stopped.',
        showPushedAt: false,
        fix: 'retry',
        fixLabel: 'Try again',
      };
    case 'active':
      if (!sync.pushedAt) return { tone: 'quiet', message: 'Making the Google Doc…', showPushedAt: false, fix: null, fixLabel: null };
      if (sync.pending)
        // A failed attempt waiting for its retry still counts as on its way; the reason is worth showing.
        return {
          tone: 'quiet',
          message: sync.lastError ? 'Google Docs · will try again shortly' : 'Google Docs · syncing after you stop typing',
          showPushedAt: false,
          fix: null,
          fixLabel: null,
        };
      return { tone: 'quiet', message: 'Google Docs · synced', showPushedAt: true, fix: null, fixLabel: null };
  }
}

/** How often to check back: while a push is on its way, often; otherwise not at all. */
export const driveSyncPollMs = (sync: DriveSyncLike | null | undefined): number | false =>
  sync && sync.status === 'active' && (sync.pending || !sync.pushedAt) ? 10_000 : false;
