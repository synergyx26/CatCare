import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { Cat } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError } from '@/types/api'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  breed: z.string().optional(),
  sex: z.enum(['unknown', 'male', 'female']),
  sterilized: z.boolean(),
  birthday: z.string().optional(),
  health_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function AddCatPage() {
  usePageTitle('Add a Cat')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sex: 'unknown', sterilized: false },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.createCat(Number(householdId), { cat: { species: 'cat', ...data } }),
    onSuccess: (res) => {
      const catId: number = res.data.data.id
      notify.success('Cat added!')
      navigate(`/households/${householdId}/cats/${catId}`, { replace: true })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Something went wrong. Please try again.'
      notify.error(message)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20 p-4">
      <div className="w-full max-w-md">
        <OnboardingStepper step={2} />
        <div className="bg-card rounded-3xl shadow-xl shadow-sky-500/5 border border-border/50 p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Add your cat</h1>
            <p className="text-muted-foreground text-sm">You can add more cats and details later.</p>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Name *</label>
              <Input
                {...register('name')}
                placeholder="e.g. Miso"
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
                autoFocus
              />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Breed</label>
              <Input
                {...register('breed')}
                placeholder="e.g. Domestic Shorthair"
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Sex</label>
              <select
                {...register('sex')}
                className="flex h-11 w-full rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-sm transition-colors outline-none focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/30 px-3 py-3">
              <input {...register('sterilized')} type="checkbox" id="sterilized" className="h-4 w-4 rounded border-input accent-sky-500" />
              <label htmlFor="sterilized" className="text-sm">Spayed / neutered</label>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Birthday</label>
              <Input
                {...register('birthday')}
                type="date"
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Health notes</label>
              <Textarea
                {...register('health_notes')}
                placeholder="Any known conditions, allergies, medications..."
                rows={3}
                className="rounded-xl bg-muted/50 border-border/60 focus:bg-card"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {mutation.isPending ? 'Saving...' : 'Add cat'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/dashboard`)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
