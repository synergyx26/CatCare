import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Bell, Mail, Smartphone, Lock } from 'lucide-react'
import { api } from '@/api/client'
import { useNotificationStore } from '@/store/notificationStore'
import type { NotificationPreferences } from '@/types/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePageTitle } from '@/hooks/usePageTitle'
import { notify } from '@/lib/notify'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const inAppSchema = z.object({
  enabled:           z.boolean(),
  position:          z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']),
  duration:          z.union([z.literal(2000), z.literal(4000), z.literal(6000), z.literal(8000)]),
  success_toasts:    z.boolean(),
  error_toasts:      z.boolean(),
  tier_limit_toasts: z.boolean(),
})

const emailSchema = z.object({
  enabled:           z.boolean(),
  care_reminders:    z.boolean(),
  medication_alerts: z.boolean(),
  vet_appointments:  z.boolean(),
})

const pushSchema = z.object({
  enabled:           z.boolean(),
  care_reminders:    z.boolean(),
  medication_alerts: z.boolean(),
  vet_appointments:  z.boolean(),
})

type InAppForm  = z.infer<typeof inAppSchema>
type EmailForm  = z.infer<typeof emailSchema>
type PushForm   = z.infer<typeof pushSchema>

// ─── Shared toggle component ─────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-sky-500' : 'bg-input',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Shared preference row ────────────────────────────────────────────────────

function PrefRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  disabledReason,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  disabledReason?: string
}) {
  const toggle = (
    <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
  )

  return (
    <div className="flex items-center justify-between gap-4 min-h-[44px] py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {disabled && disabledReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1.5 text-muted-foreground cursor-default">
              {toggle}
              <Lock className="size-3 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        toggle
      )}
    </div>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardContent className="divide-y divide-border px-4 sm:px-6">
        {children}
      </CardContent>
    </Card>
  )
}

// ─── In-App tab ───────────────────────────────────────────────────────────────

function InAppTab() {
  const { preferences, mergePreferences, setPreferences } = useNotificationStore()

  const form = useForm<InAppForm>({
    resolver: zodResolver(inAppSchema),
    defaultValues: preferences.in_app,
  })

  useEffect(() => {
    form.reset(preferences.in_app)
  }, [preferences.in_app]) // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data: InAppForm) =>
      api.updateNotificationPreferences({ in_app: data }),
    onSuccess: (res) => {
      const updated = (res as any)?.data?.data?.notification_preferences as NotificationPreferences
      if (updated) setPreferences(updated)
      notify.success('In-app notification settings saved')
    },
    onError: () => notify.error('Failed to save settings. Please try again.'),
  })

  const enabled = form.watch('enabled')
  const position = form.watch('position')
  const duration = form.watch('duration')

  const POSITIONS = [
    { value: 'top-right',     label: 'Top right (default)' },
    { value: 'top-center',    label: 'Top center' },
    { value: 'top-left',      label: 'Top left' },
    { value: 'bottom-right',  label: 'Bottom right' },
    { value: 'bottom-center', label: 'Bottom center' },
    { value: 'bottom-left',   label: 'Bottom left' },
  ] as const

  const DURATIONS = [
    { value: 2000 as const, label: '2 seconds' },
    { value: 4000 as const, label: '4 seconds (default)' },
    { value: 6000 as const, label: '6 seconds' },
    { value: 8000 as const, label: '8 seconds' },
  ]

  function handlePositionChange(val: string | null) {
    if (!val) return
    const pos = val as InAppForm['position']
    form.setValue('position', pos)
    mergePreferences({ in_app: { position: pos } })
  }

  function handleDurationChange(val: number) {
    const dur = val as InAppForm['duration']
    form.setValue('duration', dur)
    mergePreferences({ in_app: { duration: dur } })
  }

  return (
    <form onSubmit={form.handleSubmit((d) => save(d))} className="space-y-2">
      {/* Master toggle */}
      <SectionCard>
        <div className="flex items-center justify-between gap-4 min-h-[44px] py-3">
          <div>
            <p className="text-sm font-semibold">Enable in-app alerts</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Show alerts while you're using CatCare
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={(v) => form.setValue('enabled', v)}
            label="Enable in-app alerts"
          />
        </div>
      </SectionCard>

      {/* Appearance settings */}
      <div className={enabled ? undefined : 'pointer-events-none opacity-40'}>
        <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Appearance
        </p>
        <SectionCard>
          {/* Position */}
          <div className="flex items-center justify-between gap-4 min-h-[44px] py-3">
            <div>
              <p className="text-sm font-medium">Position</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Where alerts appear on screen</p>
            </div>
            <Select value={position} onValueChange={handlePositionChange}>
              <SelectTrigger className="w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="py-3">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-medium">Display duration</p>
                <p className="mt-0.5 text-xs text-muted-foreground">How long before alerts auto-dismiss</p>
              </div>
            </div>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => handleDurationChange(d.value)}
                  className={[
                    'flex-1 rounded-lg py-2 text-xs font-medium transition-colors ring-1',
                    duration === d.value
                      ? 'bg-sky-500 text-white ring-sky-500'
                      : 'bg-background text-muted-foreground ring-border hover:bg-muted',
                  ].join(' ')}
                >
                  {d.value / 1000}s
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="py-3">
            <button
              type="button"
              onClick={() => notify.success('This is how your success alerts will look.')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors ring-1 ring-border/60"
            >
              <Bell className="size-4" />
              Preview alert
            </button>
          </div>
        </SectionCard>

        {/* Alert types */}
        <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Alert types
        </p>
        <SectionCard>
          <PrefRow
            label="Activity confirmations"
            description="When you log care, save settings, or complete actions"
            checked={form.watch('success_toasts')}
            onChange={(v) => form.setValue('success_toasts', v)}
          />
          <PrefRow
            label="Error alerts"
            description="When something goes wrong or a request fails"
            checked={form.watch('error_toasts')}
            onChange={() => {}}
            disabled
            disabledReason="Error alerts always display to keep you informed of issues"
          />
          <PrefRow
            label="Upgrade prompts"
            description="When you reach your plan's limits"
            checked={form.watch('tier_limit_toasts')}
            onChange={(v) => form.setValue('tier_limit_toasts', v)}
          />
        </SectionCard>
      </div>

      <div className="pt-4">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Saving…' : 'Save in-app settings'}
        </Button>
      </div>
    </form>
  )
}

// ─── Email tab ────────────────────────────────────────────────────────────────

function EmailTab() {
  const { preferences, setPreferences } = useNotificationStore()

  const form = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: preferences.email,
  })

  useEffect(() => {
    form.reset(preferences.email)
  }, [preferences.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data: EmailForm) =>
      api.updateNotificationPreferences({ email: data }),
    onSuccess: (res) => {
      const updated = (res as any)?.data?.data?.notification_preferences as NotificationPreferences
      if (updated) setPreferences(updated)
      notify.success('Email notification settings saved')
    },
    onError: () => notify.error('Failed to save settings. Please try again.'),
  })

  const enabled = form.watch('enabled')

  return (
    <form onSubmit={form.handleSubmit((d) => save(d))} className="space-y-2">
      {/* Master toggle */}
      <SectionCard>
        <div className="flex items-center justify-between gap-4 min-h-[44px] py-3">
          <div>
            <p className="text-sm font-semibold">Enable email notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receive emails when reminders are triggered
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={(v) => form.setValue('enabled', v)}
            label="Enable email notifications"
          />
        </div>
      </SectionCard>

      {/* Notification types */}
      <div className={enabled ? undefined : 'pointer-events-none opacity-40'}>
        <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Notification types
        </p>
        <SectionCard>
          <PrefRow
            label="Care reminders"
            description="Alerts when scheduled care is due (feedings, litter, water)"
            checked={form.watch('care_reminders')}
            onChange={(v) => form.setValue('care_reminders', v)}
          />
          <PrefRow
            label="Medication alerts"
            description="Reminders when a medication dose is scheduled"
            checked={form.watch('medication_alerts')}
            onChange={(v) => form.setValue('medication_alerts', v)}
          />
          <PrefRow
            label="Vet appointments"
            description="Upcoming vet visit and grooming appointment reminders"
            checked={form.watch('vet_appointments')}
            onChange={(v) => form.setValue('vet_appointments', v)}
          />
        </SectionCard>
      </div>

      <div className="pt-4">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Saving…' : 'Save email settings'}
        </Button>
      </div>
    </form>
  )
}

// ─── Push tab ─────────────────────────────────────────────────────────────────

function PushTab() {
  const { preferences, setPreferences } = useNotificationStore()

  const form = useForm<PushForm>({
    resolver: zodResolver(pushSchema),
    defaultValues: preferences.push,
  })

  useEffect(() => {
    form.reset(preferences.push)
  }, [preferences.push]) // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data: PushForm) =>
      api.updateNotificationPreferences({ push: data }),
    onSuccess: (res) => {
      const updated = (res as any)?.data?.data?.notification_preferences as NotificationPreferences
      if (updated) setPreferences(updated)
      notify.success('Push notification preferences saved')
    },
    onError: () => notify.error('Failed to save settings. Please try again.'),
  })

  const enabled = form.watch('enabled')

  return (
    <form onSubmit={form.handleSubmit((d) => save(d))} className="space-y-2">
      {/* Coming soon header */}
      <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 border border-sky-100 dark:border-sky-800/40 p-4 mt-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">Mobile Push Notifications</p>
            <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            CatCare is coming to iOS and Android. Set your push preferences now — they'll be ready when the app launches.
          </p>
          <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="text-base">🍎</span> iOS
            </span>
            <span className="flex items-center gap-1">
              <span className="text-base">🤖</span> Android
            </span>
          </div>
        </div>
      </div>

      {/* Master toggle */}
      <SectionCard>
        <div className="flex items-center justify-between gap-4 min-h-[44px] py-3">
          <div>
            <p className="text-sm font-semibold">Enable push notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receive alerts on your phone even when the app is closed
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={(v) => form.setValue('enabled', v)}
            label="Enable push notifications"
          />
        </div>
      </SectionCard>

      {/* Notification types */}
      <div className={enabled ? undefined : 'pointer-events-none opacity-40'}>
        <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Notification types
        </p>
        <SectionCard>
          <PrefRow
            label="Care reminders"
            description="Alerts when scheduled care is due"
            checked={form.watch('care_reminders')}
            onChange={(v) => form.setValue('care_reminders', v)}
          />
          <PrefRow
            label="Medication alerts"
            description="Reminders when a medication dose is scheduled"
            checked={form.watch('medication_alerts')}
            onChange={(v) => form.setValue('medication_alerts', v)}
          />
          <PrefRow
            label="Vet appointments"
            description="Upcoming vet visit and grooming reminders"
            checked={form.watch('vet_appointments')}
            onChange={(v) => form.setValue('vet_appointments', v)}
          />
        </SectionCard>
      </div>

      <div className="pt-4">
        <Button type="submit" disabled={isPending} variant="outline" className="w-full sm:w-auto">
          {isPending ? 'Saving…' : 'Save push preferences (not yet active)'}
        </Button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function NotificationSettingsPage() {
  usePageTitle('Notification Settings')

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notification Settings"
        subtitle="Control how and when CatCare keeps you informed"
      />

      <Tabs defaultValue="in_app">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="in_app" className="flex items-center gap-1.5">
            <Bell className="size-3.5" />
            In-App
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5">
            <Mail className="size-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="push" className="flex items-center gap-1.5">
            <Smartphone className="size-3.5" />
            Push
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in_app" className="mt-4">
          <InAppTab />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailTab />
        </TabsContent>
        <TabsContent value="push" className="mt-4">
          <PushTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
