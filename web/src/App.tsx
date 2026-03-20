import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { RegisterPage } from '@/pages/RegisterPage'
import { LoginPage } from '@/pages/LoginPage'
import { HouseholdSetupPage } from '@/pages/HouseholdSetupPage'
import { AddCatPage } from '@/pages/AddCatPage'
import { CatProfilePage } from '@/pages/CatProfilePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InvitePage } from '@/pages/InvitePage'
import { CatHistoryPage } from '@/pages/CatHistoryPage'
import { EditCatPage } from '@/pages/EditCatPage'
import { HouseholdProfilePage } from '@/pages/HouseholdProfilePage'
import { HouseholdNotesPage } from '@/pages/HouseholdNotesPage'
import { LandingPage } from '@/pages/LandingPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  useApplyTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/invites/:token" element={<InvitePage />} />

          {/* Protected — wrapped in AppLayout */}
          <Route element={<ProtectedRoute />}>
            {/* Setup lives outside AppLayout (no navbar needed during onboarding) */}
            <Route path="/setup" element={<HouseholdSetupPage />} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/households/:householdId/add-cat"
                element={<AddCatPage />}
              />
              <Route
                path="/households/:householdId/cats/:catId"
                element={<CatProfilePage />}
              />
              <Route
                path="/households/:householdId/cats/:catId/edit"
                element={<EditCatPage />}
              />
              <Route
                path="/households/:householdId/cats/:catId/history"
                element={<CatHistoryPage />}
              />
              <Route
                path="/households/:householdId/profile"
                element={<HouseholdProfilePage />}
              />
              <Route
                path="/households/:householdId/notes"
                element={<HouseholdNotesPage />}
              />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
