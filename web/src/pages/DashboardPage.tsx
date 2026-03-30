import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { LogCareModal } from '@/components/LogCareModal'
import { CatCard } from '@/components/dashboard/CatCard'
import { TodayCareLog } from '@/components/dashboard/TodayCareLog'
import { MembersSection } from '@/components/dashboard/MembersSection'
import { EmergencyContactSection } from '@/components/dashboard/EmergencyContactSection'
import { HouseholdVetSection } from '@/components/dashboard/HouseholdVetSection'
import { HouseholdNotesSection } from '@/components/dashboard/HouseholdNotesSection'
import { UpcomingAppointmentsSection } from '@/components/dashboard/UpcomingAppointmentsSection'
import { Button } from '@/components/ui/button'
import { CatCardSkeleton } from '@/components/skeletons/CatCardSkeleton'
import { CareLogSkeleton } from '@/components/skeletons/CareLogSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isToday, isSameLocalDay, getCatTodayStatus } from '@/lib/helpers'
import { notify } from '@/lib/notify'
import { Home, PawPrint, Plus, Droplets, Trash2, Settings2, X, Lock } from 'lucide-react'

function getTimeGreeting(name: string): string {
  const hour = new Date().getHours()
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${salutation}, ${name}`
}
import { loadBatchActions, saveBatchActions } from '@/lib/batchActions'
import { BatchActionModal } from '@/components/dashboard/BatchActionModal'
import type { BatchAction } from '@/lib/batchActions'
import type {
  Household,
  Cat,
  CareEvent,
  EventType,
  HouseholdInvite,
  MemberRole,
} from '@/types/api'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, primaryHouseholdId, setHousehold } = useAuthStore()

  // Modal state
  const [logCat, setLogCat] = useState<Cat | null>(null)
  const [editingEvent, setEditingEvent] = useState<CareEvent | null>(null)
  const [logInitType, setLogInitType] = useState<EventType | undefined>(undefined)
  const [showArchived, setShowArchived] = useState(false)

  // Care log date navigation
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  // ── Queries ──────────────────────────────────────────────────
  const { data: householdsData, isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
    // Backfill primaryHouseholdId for existing users after a successful fetch
    select: (res) => {
      const firstId: number | undefined = res.data?.data?.[0]?.id
      if (firstId && !primaryHouseholdId) setHousehold(firstId)
      return res
    },
  })
  const households: Household[] = householdsData?.data?.data ?? []
  const primaryHousehold: Household | undefined = households[0]

  const queryClient = useQueryClient()

  const { data: catsData, isLoading: catsLoading } = useQuery({
    queryKey: ['cats', primaryHousehold?.id],
    queryFn: () => api.getCats(primaryHousehold!.id),
    enabled: !!primaryHousehold,
  })
  const cats: Cat[] = catsData?.data?.data ?? []

  const { data: careData, isFetching: careRefetching } = useQuery({
    queryKey: ['care_events', primaryHousehold?.id],
    queryFn: () => api.getCareEvents(primaryHousehold!.id),
    enabled: !!primaryHousehold,
  })

  function refreshCareLog() {
    queryClient.invalidateQueries({ queryKey: ['care_events', primaryHousehold?.id] })
  }
  const allEvents: CareEvent[] = careData?.data?.data ?? []
  // todayEvents drives cat status badges and the "needs attention" banner — always today
  const todayEvents = allEvents
    .filter((e) => isToday(e.occurred_at))
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )
  // selectedDateEvents drives the care log section (can be a past day)
  const selectedDateEvents = allEvents
    .filter((e) => isSameLocalDay(e.occurred_at, selectedDate))
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )

  function goPrevDay() {
    setSelectedDate((d) => {
      const prev = new Date(d)
      prev.setDate(prev.getDate() - 1)
      return prev
    })
  }

  function goNextDay() {
    setSelectedDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      return next
    })
  }

  function goToToday() {
    setSelectedDate(new Date())
  }

  const memberMap = new Map<number, string>(
    (primaryHousehold?.members ?? []).map((m) => [m.id, m.name])
  )
  const currentRole: MemberRole | null =
    primaryHousehold?.members.find((m) => m.id === user?.id)?.role ?? null

  const tier = user?.subscription_tier ?? 'free'
  const catLimit = tier === 'premium' ? Infinity : tier === 'pro' ? 3 : 1
  const atCatLimit = cats.length >= catLimit

  // Derive per-cat attention status — includes toothbrushing so the banner and
  // status badges are in sync. recentSymptomAt is intentionally excluded (informational).
  const catsNeedingAttention = cats
    .map((cat) => {
      const s = getCatTodayStatus(cat.id, todayEvents, memberMap, user?.id ?? -1, {
        feedings_per_day:    cat.feedings_per_day,
        track_water:         cat.track_water,
        track_litter:        cat.track_litter,
        track_toothbrushing: cat.track_toothbrushing,
      })
      const missing: string[] = []
      if (s.feedCount < s.feedingsNeeded)
        missing.push(s.feedingsNeeded > 1 ? `${s.feedCount}/${s.feedingsNeeded} feedings` : 'feeding')
      if (s.trackWater && !s.waterDoneAt)                 missing.push('water')
      if (s.trackLitter && !s.litterDoneAt)               missing.push('litter')
      if (s.trackToothbrushing && !s.toothbrushingDoneAt) missing.push('teeth')
      return { cat, missing }
    })
    .filter(({ missing }) => missing.length > 0)

  const { data: invitesData } = useQuery({
    queryKey: ['invites', primaryHousehold?.id],
    queryFn: () => api.getInvites(primaryHousehold!.id),
    enabled: !!primaryHousehold && currentRole === 'admin',
  })
  const pendingInvites: HouseholdInvite[] = invitesData?.data?.data ?? []

  const { data: archivedCatsData } = useQuery({
    queryKey: ['cats_archived', primaryHousehold?.id],
    queryFn: () => api.getArchivedCats(primaryHousehold!.id),
    enabled: !!primaryHousehold && showArchived && currentRole !== 'sitter',
  })
  const archivedCats: Cat[] = archivedCatsData?.data?.data ?? []

  // ── Batch logging ─────────────────────────────────────────────
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [customActions, setCustomActions] = useState<BatchAction[]>(() =>
    primaryHousehold ? loadBatchActions(primaryHousehold.id) : []
  )

  function addCustomAction(action: Omit<BatchAction, 'id'>) {
    const newAction: BatchAction = { ...action, id: crypto.randomUUID() }
    const updated = [...customActions, newAction]
    setCustomActions(updated)
    if (primaryHousehold) saveBatchActions(primaryHousehold.id, updated)
  }

  function removeCustomAction(id: string) {
    const updated = customActions.filter((a) => a.id !== id)
    setCustomActions(updated)
    if (primaryHousehold) saveBatchActions(primaryHousehold.id, updated)
  }

  const batchMutation = useMutation({
    mutationFn: async (action: { label: string; event_type: EventType; details: Record<string, unknown> }) => {
      await Promise.all(
        cats.map((cat) =>
          api.createCareEvent(primaryHousehold!.id, {
            care_event: {
              cat_id: cat.id,
              event_type: action.event_type,
              occurred_at: new Date().toISOString(),
              details: action.details,
            },
          })
        )
      )
      return action.label
    },
    onSuccess: (label) => {
      queryClient.invalidateQueries({ queryKey: ['care_events', primaryHousehold?.id] })
      const names = cats.map((c) => c.name).join(', ')
      notify.success(`${label} logged for ${names}`)
    },
    onError: () => notify.error('Something went wrong. Please try again.'),
  })

  // ── Modal helpers ────────────────────────────────────────────
  function openNewLog(cat: Cat, type?: EventType) {
    setLogCat(cat)
    setEditingEvent(null)
    setLogInitType(type)
  }

  function openEdit(event: CareEvent) {
    const cat = cats.find((c) => c.id === event.cat_id) ?? null
    setLogCat(cat)
    setEditingEvent(event)
    setLogInitType(undefined)
  }

  function closeModal() {
    setLogCat(null)
    setEditingEvent(null)
    setLogInitType(undefined)
  }

  usePageTitle(primaryHousehold?.name ?? 'Dashboard')

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading || (!!primaryHousehold && catsLoading)) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CatCardSkeleton />
          <CatCardSkeleton />
        </div>
        <CareLogSkeleton />
      </div>
    )
  }

  // ── No household ─────────────────────────────────────────────
  if (households.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight">Welcome to CatCare</h1>
          <p className="text-sm text-muted-foreground">Hi, {user?.name}</p>
        </div>
        <EmptyState
          icon={Home}
          title="No household yet"
          description="Create a household to start coordinating care with your family."
          action={{ label: 'Create a household', onClick: () => navigate('/setup') }}
        />
      </div>
    )
  }

  return (
    <>
      {/* Page header — warm greeting */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight">
            {getTimeGreeting(user?.name ?? 'there')} 👋
          </h1>
          {cats.length > 0 && catsNeedingAttention.length === 0 && (
            <p className="text-sm text-muted-foreground">All cats are cared for today</p>
          )}
        </div>
        {primaryHousehold && currentRole !== 'sitter' && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              if (atCatLimit) {
                const hint = tier === 'pro'
                  ? 'Upgrade to Premium to add more than 3 cats.'
                  : 'Upgrade to Pro or Premium to add more cats.'
                notify.tierLimit(`Plan limit reached. ${hint}`)
              } else {
                navigate(`/households/${primaryHousehold.id}/add-cat`)
              }
            }}
          >
            {atCatLimit ? <Lock className="size-4" /> : <Plus className="size-4" />}
            Add Cat
          </Button>
        )}
      </div>

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:items-start">

        {/* ── Left column: cats + members ─────────────────────── */}
        <div className="space-y-4">
          {/* Cat cards — 2-col grid on md+ */}
          {cats.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title="No cats added yet"
              action={
                primaryHousehold && currentRole !== 'sitter'
                  ? {
                      label: 'Add your first cat',
                      onClick: () => navigate(`/households/${primaryHousehold.id}/add-cat`),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              {/* Batch log buttons — only when 2+ cats */}
              {cats.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Log for all:</span>
                  {/* Built-in: Water */}
                  <button
                    onClick={() => batchMutation.mutate({ label: 'Water', event_type: 'water', details: {} })}
                    disabled={batchMutation.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-950/20 dark:hover:border-blue-700 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Droplets className="size-3" />
                    Water
                  </button>
                  {/* Built-in: Litter */}
                  <button
                    onClick={() => batchMutation.mutate({ label: 'Litter', event_type: 'litter', details: {} })}
                    disabled={batchMutation.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 dark:hover:bg-purple-950/20 dark:hover:border-purple-700 dark:hover:text-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="size-3" />
                    Litter
                  </button>
                  {/* Custom actions */}
                  {customActions.map((action) => {
                    const FREE_TYPES: string[] = ['feeding', 'litter', 'water', 'note']
                    const actionAllowed = tier === 'pro' || tier === 'premium' || FREE_TYPES.includes(action.event_type)
                    return (
                      <span key={action.id} className="relative group flex items-center">
                        <button
                          onClick={() => {
                            if (!actionAllowed) {
                              notify.tierLimit('Upgrade to Pro or Premium to use this quick action.')
                              return
                            }
                            batchMutation.mutate(action)
                          }}
                          disabled={batchMutation.isPending}
                          title={!actionAllowed ? 'Requires Pro or Premium' : undefined}
                          className={[
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border transition-colors',
                            actionAllowed
                              ? 'hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed'
                              : 'opacity-50 cursor-not-allowed',
                          ].join(' ')}
                        >
                          {!actionAllowed && <Lock className="size-3 shrink-0" />}
                          {action.label}
                        </button>
                        <button
                          onClick={() => removeCustomAction(action.id)}
                          className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center size-4 rounded-full bg-destructive text-destructive-foreground"
                          aria-label={`Remove ${action.label}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    )
                  })}
                  {/* Add custom action */}
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                    aria-label="Add custom quick action"
                  >
                    <Settings2 className="size-3" />
                    Add
                  </button>
                </div>
              )}

              {/* Needs attention banner — shown above cat cards when any cat has pending tasks */}
              {catsNeedingAttention.length > 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Needs attention today
                  </p>
                  {catsNeedingAttention.map(({ cat, missing }) => (
                    <div key={cat.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{missing.join(' · ')}</span>
                      </div>
                      <button
                        onClick={() => openNewLog(cat)}
                        className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        Log
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cats.map((cat) => (
                  <CatCard
                    key={cat.id}
                    cat={cat}
                    householdId={primaryHousehold!.id}
                    todayEvents={todayEvents}
                    memberMap={memberMap}
                    currentUserId={user?.id ?? -1}
                    onLog={openNewLog}
                  />
                ))}
              </div>
            </>
          )}

          {/* Archived cats toggle (non-sitters only) */}
          {primaryHousehold && currentRole !== 'sitter' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showArchived ? 'Hide archived cats' : 'Show archived cats'}
              </button>

              {showArchived && archivedCats.length === 0 && (
                <p className="text-xs text-muted-foreground">No archived cats.</p>
              )}

              {showArchived && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedCats.map((cat) => (
                    <div key={cat.id} className="opacity-50">
                      <CatCard
                        cat={cat}
                        householdId={primaryHousehold.id}
                        todayEvents={[]}
                        memberMap={memberMap}
                        currentUserId={user?.id ?? -1}
                        onLog={openNewLog}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members */}
          {primaryHousehold && (
            <MembersSection
              household={primaryHousehold}
              currentUserId={user?.id ?? -1}
              currentRole={currentRole}
              pendingInvites={pendingInvites}
              tier={tier}
            />
          )}
        </div>

        {/* ── Right column: care log + household info ──────────── */}
        <div className="space-y-4 lg:sticky lg:top-20">
          {primaryHousehold && cats.length > 0 && (
            <UpcomingAppointmentsSection
              householdId={primaryHousehold.id}
              cats={cats}
              onSchedule={openNewLog}
              onEdit={openEdit}
            />
          )}

          {primaryHousehold && (
            <TodayCareLog
              todayEvents={selectedDateEvents}
              selectedDate={selectedDate}
              onPrevDay={goPrevDay}
              onNextDay={goNextDay}
              cats={cats}
              memberMap={memberMap}
              currentUserId={user?.id ?? -1}
              onEdit={openEdit}
              onRefresh={refreshCareLog}
              isRefreshing={careRefetching}
              onQuickLog={(cat) => openNewLog(cat)}
              onGoToToday={goToToday}
            />
          )}

          {primaryHousehold && (
            <HouseholdVetSection
              household={primaryHousehold}
              currentRole={currentRole}
            />
          )}

          {primaryHousehold && (
            <EmergencyContactSection
              household={primaryHousehold}
              currentRole={currentRole}
            />
          )}

          {primaryHousehold && (
            <HouseholdNotesSection
              householdId={primaryHousehold.id}
              currentRole={currentRole}
            />
          )}
        </div>
      </div>

      {/* Log care modal */}
      {logCat && primaryHousehold && (
        <LogCareModal
          cat={logCat}
          householdId={primaryHousehold.id}
          initialEvent={editingEvent ?? undefined}
          initialType={logInitType}
          onClose={closeModal}
        />
      )}

      {/* Batch action creator */}
      {showBatchModal && (
        <BatchActionModal
          onSave={addCustomAction}
          onClose={() => setShowBatchModal(false)}
        />
      )}
    </>
  )
}
