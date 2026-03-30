import { useEffect } from 'react'
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

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const expired = isTokenExpired(token)

  // Clean up stale auth state after render — don't mutate state during render
  useEffect(() => {
    if (isAuthenticated && expired) {
      clearAuth()
    }
  }, [isAuthenticated, expired, clearAuth])

  if (!isAuthenticated || expired) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
