import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { FocusLayout } from '@/app/FocusLayout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage'
import { NewProjectPage } from '@/features/projects/NewProjectPage'
import { RoomBuilderPage } from '@/features/rooms/RoomBuilderPage'
import { CataloguePage } from '@/features/catalogue/CataloguePage'
import { BoqPage } from '@/features/boq/BoqPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
      </Route>

      <Route element={<FocusLayout />}>
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:projectId/rooms/:roomId" element={<RoomBuilderPage />} />
        <Route path="/projects/:projectId/boq" element={<BoqPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
