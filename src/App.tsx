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
import { QuotationBuilderPage } from '@/features/quotation/QuotationBuilderPage'
import { AuraCanvasPage } from '@/features/canvas/AuraCanvasPage'
import { SitePhotosPage } from '@/features/media/SitePhotosPage'
import { ReferencesPage } from '@/features/media/ReferencesPage'
import { ToolsHubPage } from '@/features/tools/ToolsHubPage'
import { CalculatorPage } from '@/features/tools/CalculatorPage'
import { AuthGuard } from '@/features/auth/AuthGuard'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/tools" element={<ToolsHubPage />} />
        </Route>

        <Route element={<FocusLayout />}>
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId/rooms/:roomId" element={<RoomBuilderPage />} />
          <Route path="/projects/:projectId/boq" element={<BoqPage />} />
          <Route path="/projects/:projectId/quotation" element={<QuotationBuilderPage />} />
          <Route path="/projects/:projectId/rooms/:roomId/canvas" element={<AuraCanvasPage />} />
          <Route path="/projects/:projectId/site-photos" element={<SitePhotosPage />} />
          <Route path="/projects/:projectId/references" element={<ReferencesPage />} />
          <Route path="/tools/:calculatorId" element={<CalculatorPage />} />
          <Route path="/projects/:projectId/rooms/:roomId/tools" element={<ToolsHubPage />} />
          <Route path="/projects/:projectId/rooms/:roomId/tools/:calculatorId" element={<CalculatorPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
