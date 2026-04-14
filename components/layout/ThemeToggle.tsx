'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

export function ThemeToggle() {
  const { theme, toggleTheme, setTheme } = useThemeStore()

  // Sync with system preference on first mount
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mq.matches ? 'dark' : 'light')

    const listener = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="w-9 h-9 rounded-md flex items-center justify-center text-muted hover:bg-surface-offset hover:text-foreground transition-colors"
    >
      {theme === 'dark'
        ? <Sun  size={18} aria-hidden="true" />
        : <Moon size={18} aria-hidden="true" />
      }
    </button>
  )
}
