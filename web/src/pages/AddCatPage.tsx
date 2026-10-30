import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { Cat } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/layout/PageHeader'
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

const fieldClass = 'h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card'
const labelClass = 'text-sm font-medium text-muted-foreground'

export function AddCatPage() {
  usePageTitle('Add a Cat')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Set by HouseholdSetupPage: first-run onboarding gets the stepper and a
  // "Skip" exit; everyone else arrives from Care Settings and gets a normal page.
  const onboarding = (useLocation().state as { onboarding?: boolean } | null)?.onboarding === true

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sex: 'unknown', sterilized: false },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.createCat(Number(householdId), { cat: { species: 'cat', ...data } }),
    onSuccess: (res) => {
      const catId: number = res.data.data.id
      queryClient.invalidateQueries({ queryKey: ['cats'] })
      notify.success('Cat added!')
      navigate(`/households/${householdId}/cats/${catId}`, { replace: true })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Something went wrong. Please try again.'
      notify.error(message)
    },
  })

  const leave = () => navigate(onboarding ? '/dashboard' : `/households/${householdId}/settings`)

  return (
    <div className="mx-auto w-full max-w-3xl">
      {onboarding ? (
        <OnboardingStepper step={2} />
      ) : (
        <PageHeader
          title="Add a cat"
          subtitle="You can add more details later from the cat's profile."
          backTo={{ label: 'Back to care settings', onClick: leave }}
        />
      )}

      <div className="rounded-3xl border border-border/50 bg-card p-5 shadow-xl shadow-sky-500/5 sm:p-8">
        {onboarding && (
          <div className="mb-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
              <Cat className="size-7 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Add your cat</h1>
              <p className="text-sm text-muted-foreground">You can add more cats and details later.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="cat-name" className={labelClass}>Name *</label>
            <Input id="cat-name" {...register('name')} placeholder="e.g. Miso" className={fieldClass} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cat-breed" className={labelClass}>Breed</label>
            <Input id="cat-breed" {...register('breed')} placeholder="e.g. Domestic Shorthair" className={fieldClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cat-sex" className={labelClass}>Sex</label>
            <select
              id="cat-sex"
              {...register('sex')}
              className="flex h-11 w-full rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-sm transition-colors outline-none focus:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cat-birthday" className={labelClass}>Birthday</label>
            <Input id="cat-birthday" {...register('birthday')} type="date" className={fieldClass} />
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-muted/30 px-3 py-3 md:col-span-2">
            <input {...register('sterilized')} type="checkbox" id="sterilized" className="size-4 rounded border-input accent-sky-500" />
            <label htmlFor="sterilized" className="text-sm">Spayed / neutered</label>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="cat-notes" className={labelClass}>Health notes</label>
            <Textarea
              id="cat-notes"
              {...register('health_notes')}
              placeholder="Any known conditions, allergies, medications..."
              rows={4}
              className="rounded-xl bg-muted/50 border-border/60 focus:bg-card"
            />
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 md:col-span-2 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" className="h-11 rounded-xl md:px-6" onClick={leave}>
              {onboarding ? 'Skip for now' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="h-11 rounded-xl font-semibold md:px-8">
              {mutation.isPending ? 'Saving...' : 'Add cat'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
