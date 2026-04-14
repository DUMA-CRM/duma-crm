import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body:    ['var(--font-body)',    'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia',   'serif'],
      },
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          '2':     'var(--color-surface-2)',
          offset:  'var(--color-surface-offset)',
        },
        divider:    'var(--color-divider)',
        border:     'var(--color-border)',
        foreground: 'var(--color-text)',
        muted:      'var(--color-text-muted)',
        faint:      'var(--color-text-faint)',
        inverse:    'var(--color-text-inverse)',
        primary: {
          DEFAULT:   'var(--color-primary)',
          hover:     'var(--color-primary-hover)',
          active:    'var(--color-primary-active)',
          highlight: 'var(--color-primary-highlight)',
        },
        success: {
          DEFAULT:   'var(--color-success)',
          highlight: 'var(--color-success-highlight)',
        },
        warning: {
          DEFAULT:   'var(--color-warning)',
          highlight: 'var(--color-warning-highlight)',
        },
        error: {
          DEFAULT:   'var(--color-error)',
          highlight: 'var(--color-error-highlight)',
        },
        info: {
          DEFAULT:   'var(--color-info)',
          highlight: 'var(--color-info-highlight)',
        },
      },
      height: {
        header: 'var(--header-height)',
      },
      width: {
        sidebar:           'var(--sidebar-width)',
        'sidebar-collapsed':'var(--sidebar-collapsed-width)',
      },
    },
  },
  plugins: [],
}

export default config
