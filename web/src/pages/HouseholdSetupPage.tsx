import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Home } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import type { ApiError } from '@/types/api'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  name: z.string().min(1, 'Household name is required'),
})

type FormData = z.infer<typeof schema>

export function HouseholdSetupPage() {
  usePageTitle('Create Household')
  const navigate = useNavigate()
  const setHousehold = useAuthStore((s) => s.setHousehold)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.createHousehold({ household: data }),
    onSuccess: (res) => {
      const householdId: number = res.data.data.id
      setHousehold(householdId)
      toast.success('Household created!')
      navigate(`/households/${householdId}/add-cat`, { replace: true })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Something went wrong. Please try again.'
      toast.error(message)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
      <div className="w-full max-w-md">
        <OnboardingStepper step={1} />
        <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Home className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Name your household</h1>
            <p className="text-muted-foreground text-sm">
              This is how your household appears to members you invite.
            </p>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Household name</label>
              <Input
                {...register('name')}
                placeholder="e.g. The Murphy House"
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                autoFocus
              />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Creating...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
