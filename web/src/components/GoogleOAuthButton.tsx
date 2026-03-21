import { GoogleLogin } from '@react-oauth/google'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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

  const mutation = useMutation({
    mutationFn: (credential: string) => api.googleOAuth(credential),
    onSuccess: (res) => {
      const token = res.headers['authorization']?.replace('Bearer ', '') ?? ''
      const user: User = res.data.data
      setAuth(user, token)
      toast.success('Signed in with Google!')
      navigate(redirectTo, { replace: true })
    },
    onError: () => {
      toast.error('Google sign-in failed. Please try again.')
    },
  })

  return (
    <GoogleLogin
      onSuccess={(response) => {
        if (response.credential) mutation.mutate(response.credential)
      }}
      onError={() => toast.error('Google sign-in was cancelled or failed.')}
      width={400}
      theme="outline"
      size="large"
      shape="rectangular"
      text="continue_with"
    />
  )
}
