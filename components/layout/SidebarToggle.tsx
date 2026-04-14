'use client'

import { Menu } from 'lucide-react'
import { useSidebarStore } from '@/stores/sidebarStore'

export function SidebarToggle() {
  const { toggleCollapsed, toggleMobile } = useSidebarStore()

  function handleClick() {
    if (window.innerWidth < 1024) {
      toggleMobile()
    } else {
      toggleCollapsed()
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Toggle sidebar"
      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-muted hover:bg-surface-offset hover:text-foreground transition-colors"
    >
      <Menu size={18} aria-hidden="true" />
    </button>
  )
}
