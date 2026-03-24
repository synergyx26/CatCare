import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { LogCareModal } from '@/components/LogCareModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { CatCard } from '@/components/dashboard/CatCard'
import { TodayCareLog } from '@/components/dashboard/TodayCareLog'
import { MembersSection } from '@/components/dashboard/MembersSection'
import { EmergencyContactSection } from '@/components/dashboard/EmergencyContactSection'
import { HouseholdNotesSection } from '@/components/dashboard/HouseholdNotesSection'
import { Button } from '@/components/ui/button'
import { CatCardSkeleton } from '@/components/skeletons/CatCardSkeleton'
import { CareLogSkeleton } from '@/components/skeletons/CareLogSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isToday, isSameLocalDay, formatDateHeader, getCatTodayStatus } from '@/lib/helpers'
import { Home, PawPrint, Plus } from 'lucide-react'
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

  const memberMap = new Map<number, string>(
    (primaryHousehold?.members ?? []).map((m) => [m.id, m.name])
  )
  const currentRole: MemberRole | null =
    primaryHousehold?.members.find((m) => m.id === user?.id)?.role ?? null

  const needsAttentionCount = cats.filter((cat) => {
    const s = getCatTodayStatus(cat.id, todayEvents, memberMap, user?.id ?? -1)
    return s.feedCount === 0 || s.litterDoneAt === null || s.waterDoneAt === null
  }).length

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
      <div className="mx-auto max-w-sm space-y-6 sm:max-w-md lg:max-w-lg">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="space-y-3">
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
      <div className="mx-auto max-w-sm space-y-6">
        <PageHeader
          title="Welcome to CatCare"
          subtitle={`Hi, ${user?.name}`}
        />
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
      <div className="mx-auto max-w-sm space-y-6 sm:max-w-md lg:max-w-lg">
        <PageHeader
          title={primaryHousehold?.name ?? 'Your household'}
          subtitle={`Hi, ${user?.name} · ${formatDateHeader()}`}
          action={
            primaryHousehold && currentRole !== 'sitter' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/households/${primaryHousehold.id}/add-cat`)
                }
              >
                <Plus className="size-4" />
                Add Cat
              </Button>
            ) : undefined
          }
        />

        {/* Needs attention banner */}
        {cats.length > 0 && needsAttentionCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {needsAttentionCount === 1
                ? '1 cat needs attention'
                : `${needsAttentionCount} cats need attention`}
            </p>
          </div>
        )}

        {/* Cat cards */}
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
          <div className="space-y-3">
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

            {showArchived && archivedCats.map((cat) => (
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

        {/* Members */}
        {primaryHousehold && (
          <MembersSection
            household={primaryHousehold}
            currentUserId={user?.id ?? -1}
            currentRole={currentRole}
            pendingInvites={pendingInvites}
          />
        )}

        {/* Emergency contact */}
        {primaryHousehold && (
          <EmergencyContactSection
            household={primaryHousehold}
            currentRole={currentRole}
          />
        )}

        {/* Household notes */}
        {primaryHousehold && (
          <HouseholdNotesSection
            householdId={primaryHousehold.id}
            currentRole={currentRole}
          />
        )}

        {/* Care log with date navigation */}
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
          />
        )}
      </div>

      {/* Modal */}
      {logCat && primaryHousehold && (
        <LogCareModal
          cat={logCat}
          householdId={primaryHousehold.id}
          initialEvent={editingEvent ?? undefined}
          initialType={logInitType}
          onClose={closeModal}
        />
      )}
    </>
  )
}
