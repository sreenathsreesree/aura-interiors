import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './MobileTopBar'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-sand-100">
      <Sidebar />
      <div className="flex min-h-dvh flex-1 flex-col overflow-x-hidden">
        <MobileTopBar />
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
