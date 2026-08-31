import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from './navItems'

// Primary navigation for phones. Hidden from md breakpoint up, where the
// Sidebar takes over.
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors',
              isActive ? 'text-ink-900' : 'text-ink-400',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className="h-6 w-6"
                strokeWidth={isActive ? 2.4 : 2}
                fill={isActive ? 'currentColor' : 'none'}
                fillOpacity={isActive ? 0.12 : 0}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
