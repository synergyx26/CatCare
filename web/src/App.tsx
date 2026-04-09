import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { GuestRoute } from '@/components/GuestRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { useApplyTheme } from '@/hooks/useApplyTheme'
import { useNotificationStore } from '@/store/notificationStore'
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
import { HouseholdSettingsPage } from '@/pages/HouseholdSettingsPage'
import { HouseholdNotesPage } from '@/pages/HouseholdNotesPage'
import { NotificationSettingsPage } from '@/pages/NotificationSettingsPage'
import { CareHistoryTablePage } from '@/pages/CareHistoryTablePage'
import { HouseholdCalendarPage } from '@/pages/HouseholdCalendarPage'
import { VacationModePage } from '@/pages/VacationModePage'
import { MedicationsPage } from '@/pages/MedicationsPage'
import { AdminPage } from '@/pages/AdminPage'
import { AdminImportPage } from '@/pages/AdminImportPage'
import { LandingPage } from '@/pages/LandingPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
})

export default function App() {
  useApplyTheme()
  const { preferences } = useNotificationStore()

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        richColors
        position={preferences.in_app.position}
        toastOptions={{ duration: preferences.in_app.duration }}
      />
      <BrowserRouter>
        <Routes>
          {/* Guest-only: redirect to /dashboard if already authenticated */}
          <Route element={<GuestRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Public — accessible regardless of auth state */}
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
                path="/households/:householdId/cats/:catId/medications"
                element={<MedicationsPage />}
              />
              <Route
                path="/households/:householdId/profile"
                element={<HouseholdProfilePage />}
              />
              <Route
                path="/households/:householdId/settings"
                element={<HouseholdSettingsPage />}
              />
              <Route
                path="/households/:householdId/notes"
                element={<HouseholdNotesPage />}
              />
              <Route path="/notification-settings" element={<NotificationSettingsPage />} />
              <Route
                path="/households/:householdId/care-history"
                element={<CareHistoryTablePage />}
              />
              <Route
                path="/households/:householdId/calendar"
                element={<HouseholdCalendarPage />}
              />
              <Route
                path="/households/:householdId/vacation"
                element={<VacationModePage />}
              />
            </Route>
          </Route>

          {/* Super-admin — requires is_super_admin on the user object */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
