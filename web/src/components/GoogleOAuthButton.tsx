import { GoogleLogin } from '@react-oauth/google'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/api'

interface Props {
  /** Where to navigate after a successful sign-in */
  redirectTo: string
}

/**
 * Renders the official Google "Continue with Google" button.
 * On success it exchanges the Google ID token for a CatCare JWT.
 */
export function GoogleOAuthButton({ redirectTo }: Props) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (credential: string) => api.googleOAuth(credential),
    onSuccess: (res) => {
      const token = res.headers['authorization']?.replace('Bearer ', '') ?? ''
      const user: User = res.data.data
      if (!token) {
        notify.error('Sign-in failed: no session token received. Please try again.')
        return
      }
      setAuth(user, token)
      queryClient.clear()
      notify.success('Signed in with Google!')
      navigate(redirectTo, { replace: true })
    },
    onError: () => {
      notify.error('Google sign-in failed. Please try again.')
    },
  })

  if (mutation.isPending) {
    return (
      <div className="flex h-10 w-full items-center justify-center gap-2 rounded border bg-white px-4 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing in with Google…
      </div>
    )
  }

  return (
    <GoogleLogin
      onSuccess={(response) => {
        if (response.credential) mutation.mutate(response.credential)
      }}
      onError={() => notify.error('Google sign-in was cancelled or failed.')}
      width={400}
      theme="outline"
      size="large"
      shape="rectangular"
      text="continue_with"
    />
  )
}
