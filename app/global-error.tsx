'use client';

import { useEffect } from 'react';

// Last-resort boundary — catches errors thrown by the root layout itself.
// Must render its own <html>/<body> because the layout failed.
//
// Everything here is an inline literal on purpose: this screen has to work when
// globals.css never loaded, so it cannot reference a CSS variable or a font
// family the layout was supposed to provide. The literals are therefore kept in
// step with the token layer by hand — they are the light-theme values of ground,
// ink, secondary ink and the action key. (They had fallen out of step: the
// previous set was cool graphite from the pre-oat world, so the one screen a user
// sees when everything else fails was the one screen off-brand.)
const GROUND = '#f4f0e7';
const INK = '#20372d';
const INK_2 = '#5c6c63';
const PRIMARY = '#1f6146';
const PRIMARY_FG = '#fffaf4';

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <title>DUMA couldn’t load</title>
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          background: GROUND,
          color: INK,
        }}
      >
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '0.5rem' }}>DUMA couldn’t load</h1>
          <p style={{ color: INK_2, fontSize: '1rem', lineHeight: 1.5, maxWidth: '60ch', margin: '0 auto 1rem' }}>
            The app itself failed to start, so nothing on this screen loaded — this isn’t something you did. Reloading usually fixes it. If it doesn’t, send
            support the reference below and it points them at the exact failure.
          </p>
          <button
            type="button"
            onClick={unstable_retry}
            style={{
              padding: '0 0.75rem',
              minHeight: '2.75rem',
              borderRadius: '7px',
              border: `1px solid ${PRIMARY}`,
              background: PRIMARY,
              color: PRIMARY_FG,
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ color: INK_2, fontSize: '0.875rem', marginTop: '1rem', marginBottom: 0 }}>
              Ref <code style={{ fontFamily: 'Chivo Mono, ui-monospace, monospace', color: INK, userSelect: 'all' }}>{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
