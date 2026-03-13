import { Moon, Sun } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import { useAppStore } from '../store/appStore'
import { Button } from './ui/button'

const titleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/requests/new': 'New Request',
  '/requests': 'All Requests',
  '/audit': 'Audit Explorer',
  '/workflows': 'Workflow Configs',
  '/config-editor': 'Config Editor',
  '/admin': 'Admin Panel',
  '/help': 'Help',
}

export function Topbar() {
  const location = useLocation()
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const crumbs = useMemo(() => {
    if (location.pathname === '/') return ['Home', 'Dashboard']
    const title = titleMap[location.pathname] || 'Request Detail'
    return ['Home', title]
  }, [location.pathname])

  return (
    <header className="border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workflow Decision Platform</div>
          <div className="mt-1 text-sm text-muted-foreground">{crumbs.join(' / ')}</div>
        </div>
        <Button variant="outline" size="sm" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {darkMode ? 'Light' : 'Dark'}
        </Button>
      </div>
    </header>
  )
}
