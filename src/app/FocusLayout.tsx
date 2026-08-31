import { Outlet } from 'react-router-dom'

// Full-screen layout for linear task flows (New Project, Room Builder) that
// manage their own back navigation and sticky footer actions — the primary
// tab navigation would only get in the way here.
export function FocusLayout() {
  return (
    <div className="min-h-dvh bg-sand-100">
      <Outlet />
    </div>
  )
}
