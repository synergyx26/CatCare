import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { notify } from '@/lib/notify'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { MembershipProfile } from '@/types/api'

const schema = z.object({
  phone: z.string().max(30).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

const ROLE_LABEL: Record<string, string> = {
  admin:  'Admin',
  member: 'Member',
  sitter: 'Pet sitter',
}

const ROLE_COLOR: Record<string, string> = {
  admin:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  sitter: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

export function HouseholdProfilePage() {
  usePageTitle('My Profile')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate        = useNavigate()
  const { user }        = useAuthStore()
  const queryClient     = useQueryClient()
  const hid             = Number(householdId)

  const { data, isLoading } = useQuery({
    queryKey: ['membership', hid],
    queryFn:  () => api.getMembership(hid),
    enabled:  !!hid,
  })
  const profile: MembershipProfile | undefined = data?.data?.data

  const { data: householdsData } = useQuery({
    queryKey: ['households'],
    queryFn:  () => api.getHouseholds(),
    staleTime: Infinity,
  })
  const defaultCountry: string =
    (householdsData?.data?.data ?? []).find((h: { id: number }) => h.id === hid)?.default_country ?? 'US'

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '',
      emergency_contact_name:  '',
      emergency_contact_phone: '',
      notes:                   '',
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        phone:                   profile.phone                   ?? '',
        emergency_contact_name:  profile.emergency_contact_name  ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        notes:                   profile.notes                   ?? '',
      })
    }
  }, [profile, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.updateMembership(hid, {
        membership: {
          phone:                   values.phone                   || null,
          emergency_contact_name:  values.emergency_contact_name  || null,
          emergency_contact_phone: values.emergency_contact_phone || null,
          notes:                   values.notes                   || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership', hid] })
      notify.success('Profile saved!')
    },
    onError: () => {
      notify.error('Failed to save. Please try again.')
    },
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <PageHeader
        title="My household profile"
        backTo={{
          label: 'Back',
          onClick: () => navigate(-1),
        }}
      />

      {/* Identity strip */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/20 dark:to-cyan-950/20 ring-1 ring-border/40 p-4 space-y-2">
        <p className="font-semibold text-base">{user?.name}</p>
        <p className="text-xs text-muted-foreground">{user?.email}</p>
        {profile && (
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLOR[profile.role] ?? 'bg-muted'}`}>
            {ROLE_LABEL[profile.role] ?? profile.role}
          </span>
        )}
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Contact info */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Your contact info
          </h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone number</label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  defaultCountry={defaultCountry}
                />
              )}
            />
            {errors.phone && (
              <p className="text-destructive text-xs">{errors.phone.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Visible to other household members so they can reach you.
            </p>
          </div>
        </section>

        {/* Emergency contact */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Your emergency contact
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">
            Who should the household contact if they can't reach you?
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              {...register('emergency_contact_name')}
              type="text"
              placeholder="e.g. Jane Smith"
              className="rounded-xl"
            />
            {errors.emergency_contact_name && (
              <p className="text-destructive text-xs">{errors.emergency_contact_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone</label>
            <Controller
              name="emergency_contact_phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  defaultCountry={defaultCountry}
                />
              )}
            />
            {errors.emergency_contact_phone && (
              <p className="text-destructive text-xs">{errors.emergency_contact_phone.message}</p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Notes for the household
          </h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Availability / role notes</label>
            <Textarea
              {...register('notes')}
              rows={3}
              placeholder="e.g. Primary caregiver. Available weekends. Text before calling."
              className="rounded-xl"
            />
            {errors.notes && (
              <p className="text-destructive text-xs">{errors.notes.message}</p>
            )}
          </div>
        </section>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={!isDirty || isSubmitting || mutation.isPending}
        >
          {mutation.isPending ? 'Saving...' : 'Save profile'}
        </Button>
      </form>
    </div>
  )
}
