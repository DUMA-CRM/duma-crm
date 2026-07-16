'use client';

// Last-resort boundary — catches errors thrown by the root layout itself.
// Must render its own <html>/<body> because the layout failed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#6b6560', fontSize: '0.875rem', marginBottom: '1rem' }}>
            The app hit an unexpected error{error.digest ? ` (ref ${error.digest})` : ''}.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#e8590c',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
