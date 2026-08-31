import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AuraLogo } from '@/components/brand/AuraLogo'
import { NAV_ITEMS } from './navItems'

// Primary navigation for tablet portrait and up. Hidden on phones in favor
// of the bottom tab bar (see BottomNav).
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-6 md:flex lg:w-72">
      <div className="px-2">
        <AuraLogo />
      </div>

      <NavLink
        to="/projects/new"
        className="mt-7 flex h-13 items-center justify-center gap-2 rounded-[--radius-md] bg-brass-500 text-sm font-semibold text-sand-50 shadow-[--shadow-soft] transition-colors hover:bg-brass-600 active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" />
        New Project
      </NavLink>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-12 items-center gap-3.5 rounded-[--radius-md] px-3.5 text-[15px] font-semibold transition-colors',
                isActive
                  ? 'bg-ink-900 text-sand-50'
                  : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" strokeWidth={2.1} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-[--radius-md] bg-sand-100 px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Aura Interiors</p>
        <p className="mt-0.5 text-xs text-ink-500">v1.0 — Foundation</p>
      </div>
    </aside>
  )
}
