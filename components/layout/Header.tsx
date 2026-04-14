import { Bell, History, Zap, ChevronDown } from 'lucide-react'
import { SearchBar }     from './SearchBar'
import { ThemeToggle }   from './ThemeToggle'
import { SidebarToggle } from './SidebarToggle'

export function Header() {
  return (
    <header className="h-14 shrink-0 bg-surface border-b border-divider flex items-center gap-3 px-6 sticky top-0 z-20">

      <SidebarToggle />
      <SearchBar />
      <div className="flex-1" />

      <div className="flex items-center gap-2">

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-md flex items-center justify-center text-muted hover:bg-surface-offset hover:text-foreground transition-colors"
        >
          <Bell size={18} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-primary rounded-full border-2 border-surface"
          />
        </button>

        {/* History */}
        <button
          aria-label="Activity history"
          className="w-9 h-9 rounded-md flex items-center justify-center text-muted hover:bg-surface-offset hover:text-foreground transition-colors"
        >
          <History size={18} aria-hidden="true" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-divider mx-1" aria-hidden="true" />

        {/* Quick Actions */}
        <button className="flex items-center gap-1.5 border border-border rounded-md px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors">
          <Zap size={13} strokeWidth={2.5} aria-hidden="true" />
          <span className="hidden sm:inline">Quick Actions</span>
          <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <ThemeToggle />

        {/* Avatar */}
        <button
          aria-label="Open user menu"
          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white text-xs font-bold border-2 border-surface ring-1 ring-border"
        >
          MD
        </button>

      </div>
    </header>
  )
}
