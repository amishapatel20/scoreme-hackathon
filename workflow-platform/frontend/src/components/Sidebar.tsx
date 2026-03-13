import { LayoutDashboard, FilePlus2, ListChecks, ScrollText, Settings, ShieldAlert, FileCode2, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { cn } from '../lib/utils'
import { useAppStore } from '../store/appStore'
import { Button } from './ui/button'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/requests/new', label: 'New Request', icon: FilePlus2 },
  { to: '/requests', label: 'All Requests', icon: ListChecks },
  { to: '/audit', label: 'Audit Explorer', icon: ScrollText },
  { to: '/workflows', label: 'Workflow Configs', icon: Settings },
  { to: '/config-editor', label: 'Config Editor', icon: FileCode2 },
  { to: '/admin', label: 'Admin Panel', icon: ShieldAlert },
  { to: '/help', label: 'Help', icon: HelpCircle },
]

export function Sidebar() {
  const location = useLocation()
  const open = useAppStore((s) => s.sidebarOpen)
  const setOpen = useAppStore((s) => s.setSidebarOpen)

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen border-r border-border bg-card p-3 transition-all duration-200',
        open ? 'w-64' : 'w-20',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={cn('font-semibold text-primary', open ? 'block' : 'hidden')}>Workflow Platform</div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-label="Toggle sidebar">
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className={cn(open ? 'inline' : 'hidden')}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
