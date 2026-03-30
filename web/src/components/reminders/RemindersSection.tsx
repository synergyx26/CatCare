import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { Bell, Plus, Trash2, Pencil, Send, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/eventColors'
import { SCHEDULE_TYPE_OPTIONS, formatSchedule } from '@/lib/reminderHelpers'
import type { MemberRole, Reminder, ReminderCareType, ReminderScheduleType } from '@/types/api'

interface Props {
  householdId: number
  catId: number
  currentRole: MemberRole | null
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z
  .object({
    care_type:      z.string().min(1, 'Select a care type'),
    schedule_type:  z.enum(['daily', 'interval', 'weekly'] as const),
    schedule_value: z.string().optional(),
    all_cats:       z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.schedule_type === 'daily') {
      if (!data.schedule_value || !/^\d{2}:\d{2}$/.test(data.schedule_value)) {
        ctx.addIssue({ code: 'custom', path: ['schedule_value'], message: 'Enter a time (HH:MM)' })
      }
    }
    if (data.schedule_type === 'interval') {
      const n = parseInt(data.schedule_value ?? '', 10)
      if (isNaN(n) || n < 1) {
        ctx.addIssue({ code: 'custom', path: ['schedule_value'], message: 'Enter a number of hours (e.g. 12)' })
      }
    }
    if (data.schedule_type === 'weekly') {
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      const base = (data.schedule_value ?? '').split(':')[0].toLowerCase()
      if (!days.includes(base)) {
        ctx.addIssue({ code: 'custom', path: ['schedule_value'], message: 'Enter a day (e.g. monday)' })
      }
    }
  })

type FormValues = z.infer<typeof schema>

const REMINDER_CARE_TYPES: ReminderCareType[] = [
  'feeding', 'litter', 'water', 'weight', 'note', 'medication', 'vet_visit', 'grooming',
]

const SCHEDULE_VALUE_PLACEHOLDER: Record<ReminderScheduleType, string> = {
  daily: '08:00', interval: '12', weekly: 'monday',
}
const SCHEDULE_VALUE_LABEL: Record<ReminderScheduleType, string> = {
  daily: 'Time (24h, e.g. 08:00)', interval: 'Every N hours (e.g. 12)', weekly: 'Day (e.g. monday)',
}

// ─── Shared form body ─────────────────────────────────────────────────────────

interface ReminderFormBodyProps {
  form: ReturnType<typeof useForm<FormValues>>
  isPending: boolean
  onCancel: () => void
  submitLabel: string
}

function ReminderFormBody({ form, isPending, onCancel, submitLabel }: ReminderFormBodyProps) {
  const { register, watch, formState: { errors } } = form
  const scheduleType = watch('schedule_type') as ReminderScheduleType
  const allCats = watch('all_cats')

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
      {/* All cats toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => form.setValue('all_cats', !allCats)}
          className={[
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ring-1',
            allCats
              ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 ring-sky-300 dark:ring-sky-700'
              : 'bg-muted text-muted-foreground ring-border/60 hover:bg-muted/80',
          ].join(' ')}
        >
          🐱 {allCats ? 'All cats' : 'This cat only'}
        </button>
        <span className="text-xs text-muted-foreground">
          {allCats ? 'Applies to every active cat in the household' : 'Applies to this cat only'}
        </span>
      </div>

      {/* Care type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Care type</label>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_CARE_TYPES.map((type) => {
            const color = EVENT_COLORS[type] ?? '#94a3b8'
            const selected = watch('care_type') === type
            return (
              <label key={type} className="cursor-pointer">
                <input type="radio" value={type} {...register('care_type')} className="sr-only" />
                <span
                  className={[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    selected
                      ? 'text-white border-transparent'
                      : 'text-muted-foreground border-border bg-background hover:bg-muted/50',
                  ].join(' ')}
                  style={selected ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {EVENT_LABELS[type]}
                </span>
              </label>
            )
          })}
        </div>
        {errors.care_type && <p className="text-xs text-destructive">{errors.care_type.message}</p>}
      </div>

      {/* Schedule type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Frequency</label>
        <div className="flex gap-2">
          {SCHEDULE_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="cursor-pointer flex-1">
              <input type="radio" value={opt.value} {...register('schedule_type')} className="sr-only" />
              <span
                className={[
                  'flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors',
                  scheduleType === opt.value
                    ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                ].join(' ')}
              >
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Schedule value */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {SCHEDULE_VALUE_LABEL[scheduleType]}
        </label>
        <input
          {...register('schedule_value')}
          placeholder={SCHEDULE_VALUE_PLACEHOLDER[scheduleType]}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.schedule_value && (
          <p className="text-xs text-destructive">{errors.schedule_value.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Add reminder form ────────────────────────────────────────────────────────

interface AddFormProps {
  householdId: number
  catId: number
  onSuccess: () => void
  onCancel: () => void
}

function AddReminderForm({ householdId, catId, onSuccess, onCancel }: AddFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { care_type: 'feeding', schedule_type: 'daily', schedule_value: '08:00', all_cats: false },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.createReminder(householdId, {
        reminder: {
          cat_id:         values.all_cats ? null : catId,
          all_cats:       values.all_cats,
          care_type:      values.care_type,
          schedule_type:  values.schedule_type,
          schedule_value: values.schedule_value,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', householdId] })
      notify.success('Reminder created')
      onSuccess()
    },
    onError: () => notify.error('Failed to create reminder'),
  })

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <ReminderFormBody
        form={form}
        isPending={mutation.isPending}
        onCancel={onCancel}
        submitLabel="Save reminder"
      />
    </form>
  )
}

// ─── Edit reminder form ───────────────────────────────────────────────────────

interface EditFormProps {
  householdId: number
  reminder: Reminder
  onSuccess: () => void
  onCancel: () => void
}

function EditReminderForm({ householdId, reminder, onSuccess, onCancel }: EditFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      care_type:      reminder.care_type,
      schedule_type:  reminder.schedule_type,
      schedule_value: reminder.schedule_value ?? '',
      all_cats:       reminder.all_cats,
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.updateReminder(householdId, reminder.id, {
        reminder: {
          all_cats:       values.all_cats,
          cat_id:         values.all_cats ? null : reminder.cat_id,
          care_type:      values.care_type,
          schedule_type:  values.schedule_type,
          schedule_value: values.schedule_value,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', householdId] })
      notify.success('Reminder updated')
      onSuccess()
    },
    onError: () => notify.error('Failed to update reminder'),
  })

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <ReminderFormBody
        form={form}
        isPending={mutation.isPending}
        onCancel={onCancel}
        submitLabel="Save changes"
      />
    </form>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function RemindersSection({ householdId, catId, currentRole }: Props) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [testSendingId, setTestSendingId] = useState<number | null>(null)
  const isSitter = currentRole === 'sitter'
  const isSuperAdmin = user?.is_super_admin === true

  const { data } = useQuery({
    queryKey: ['reminders', householdId],
    queryFn: () => api.getReminders(householdId),
    staleTime: 2 * 60 * 1000,
    enabled: !!householdId,
  })

  const allReminders: Reminder[] = data?.data?.data ?? []
  // Show reminders for this specific cat OR reminders that apply to all cats
  const catReminders = allReminders.filter((r) => r.active && (r.cat_id === catId || r.all_cats))

  const deleteMutation = useMutation({
    mutationFn: (reminderId: number) => api.deleteReminder(householdId, reminderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', householdId] })
      notify.success('Reminder removed')
    },
    onError: () => notify.error('Failed to remove reminder'),
  })

  async function handleTestSend(reminderId: number) {
    setTestSendingId(reminderId)
    try {
      await api.testSendReminder(householdId, reminderId)
      notify.success('Test email sent — check your inbox')
    } catch {
      notify.error('Failed to send test email')
    } finally {
      setTestSendingId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Reminders
            </p>
          </div>
          {!isSitter && !showAddForm && (
            <button
              onClick={() => { setEditingId(null); setShowAddForm(true) }}
              className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              <Plus className="size-3" />
              Add reminder
            </button>
          )}
        </div>

        {/* Empty state */}
        {catReminders.length === 0 && !showAddForm && (
          <p className="text-xs text-muted-foreground py-1">No reminders configured yet.</p>
        )}

        {/* Reminder list */}
        {catReminders.map((reminder) => {
          const color = EVENT_COLORS[reminder.care_type] ?? '#94a3b8'
          const isEditing = editingId === reminder.id

          return (
            <div key={reminder.id} className="space-y-2">
              {/* Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {EVENT_LABELS[reminder.care_type] ?? reminder.care_type}
                      </p>
                      {reminder.all_cats && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 shrink-0">
                          All cats
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatSchedule(reminder)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Bell className="size-3 text-muted-foreground/50" />
                  {/* Super admin test send */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleTestSend(reminder.id)}
                      disabled={testSendingId === reminder.id}
                      className="text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-40"
                      title="Test send email (super admin)"
                      aria-label="Send test email"
                    >
                      <Send className="size-3.5" />
                    </button>
                  )}
                  {/* Edit */}
                  {!isSitter && !isEditing && (
                    <button
                      onClick={() => { setShowAddForm(false); setEditingId(reminder.id) }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit reminder"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {/* Cancel edit inline */}
                  {isEditing && (
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Cancel edit"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  {/* Delete */}
                  {!isSitter && !isEditing && (
                    <button
                      onClick={() => deleteMutation.mutate(reminder.id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      aria-label="Remove reminder"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && (
                <EditReminderForm
                  householdId={householdId}
                  reminder={reminder}
                  onSuccess={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          )
        })}

        {/* Inline add form */}
        {showAddForm && (
          <AddReminderForm
            householdId={householdId}
            catId={catId}
            onSuccess={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}
