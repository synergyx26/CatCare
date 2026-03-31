import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

/**
 * Redirects already-authenticated users to /dashboard.
 * Wrap public-only routes (landing, login, register) so opening a new tab
 * while logged in skips straight to the app instead of showing the marketing page.
 */
export function GuestRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)

  if (isAuthenticated && !isTokenExpired(token)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
