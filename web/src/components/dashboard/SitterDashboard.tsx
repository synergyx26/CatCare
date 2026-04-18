import { useState } from 'react'
import {
  ChevronDown, ChevronUp,
  Phone, Stethoscope, AlertCircle,
  CalendarDays, Home, Sparkles,
} from 'lucide-react'
import type {
  Cat, CareEvent, EventType, Household,
  HouseholdChore, HouseholdChoreDefinition, VacationTrip,
} from '@/types/api'
import {
  getCatTodayStatus, getActiveMedicationTasks,
  type VacationContext, type CatCareRequirements,
} from '@/lib/helpers'
import { TodayCareLog } from './TodayCareLog'
import { HouseholdChoresSection } from './HouseholdChoresSection'
import { CatTaskCard } from './CatTaskCard'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SitterDashboardProps {
  household: Household
  cats: Cat[]
  windowEvents: CareEvent[]
  allMedEvents: CareEvent[]
  choreDefinitions: HouseholdChoreDefinition[]
  todayChores: HouseholdChore[]
  memberMap: Map<number, string>
  currentUserId: number
  catRequirements: Map<number, CatCareRequirements>
  vacationCtx?: VacationContext
  activeTrip: VacationTrip | null
  onLog: (cat: Cat, type?: EventType, opts?: { medicationName?: string }) => void
  onLogChore: (definitionId: number) => void
  // Care log section
  selectedDateEvents: CareEvent[]
  selectedDate: Date
  onPrevDay: () => void
  onNextDay: () => void
  onGoToToday: () => void
  onEdit: (event: CareEvent) => void
  isRefreshing: boolean
  onRefresh: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLocalDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysRemaining(endDateStr: string): number {
  const end = new Date(endDateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Compact tap-to-call phone link */
function PhoneLink({ phone, label }: { phone: string; label?: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors min-h-[44px] py-1"
    >
      <Phone className="size-3.5 shrink-0" />
      <span>{label ?? phone}</span>
    </a>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SitterDashboard({
  household,
  cats,
  windowEvents,
  allMedEvents,
  choreDefinitions,
  todayChores,
  memberMap,
  currentUserId,
  catRequirements,
  vacationCtx,
  activeTrip,
  onLog,
  onLogChore,
  selectedDateEvents,
  selectedDate,
  onPrevDay,
  onNextDay,
  onGoToToday,
  onEdit,
  isRefreshing,
  onRefresh,
}: SitterDashboardProps) {
  const [infoOpen, setInfoOpen] = useState(false)

  // ── Compute overall pending status ──
  const catRows = cats.map((cat) => {
    const reqs = catRequirements.get(cat.id)
    const status = getCatTodayStatus(cat.id, windowEvents, memberMap, currentUserId, reqs, allMedEvents)
    const dueMeds = getActiveMedicationTasks(cat.id, allMedEvents)
      .filter(t => t.dosesNeededToday > t.dosesGivenToday)
    const pendingFeedings = Math.max(0, status.feedingsNeeded - status.feedCount)
    const toothbrushingDue = status.trackToothbrushing && !status.toothbrushingDoneAt
    const hasPending = pendingFeedings > 0 || dueMeds.length > 0 || toothbrushingDue
    return { cat, hasPending }
  })

  const today = new Date()
  const todayChoresDone = choreDefinitions.filter(d => d.active).map((def) => {
    const done = todayChores.filter(c =>
      c.chore_definition_id === def.id &&
      (() => { const d = new Date(c.occurred_at); return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() })()
    ).length
    return done < def.frequency_per_day
  })
  const pendingChoreCount = todayChoresDone.filter(Boolean).length
  const pendingCatCount = catRows.filter(r => r.hasPending).length
  const totalPending = pendingCatCount + pendingChoreCount
  const allClear = totalPending === 0

  const hasHouseholdVet = !!(household.vet_name || household.vet_phone || household.vet_clinic)
  const hasEmergencyContact = !!(household.emergency_contact_name || household.emergency_contact_phone)
  const hasCatVet = cats.some(c => c.vet_name || c.vet_phone)
  const hasInfoPanel = hasHouseholdVet || hasEmergencyContact || hasCatVet

  // ── Vacation trip context ──
  const tripEnd = activeTrip?.end_date ? daysRemaining(activeTrip.end_date) : null

  return (
    <div className="space-y-5">

      {/* ── Context strip ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Home className="size-5 text-sky-500 shrink-0" aria-hidden="true" />
            {household.name}
          </h1>
          {activeTrip ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" />
                {formatLocalDate(activeTrip.start_date)}
                {activeTrip.end_date && ` → ${formatLocalDate(activeTrip.end_date)}`}
              </span>
              <span className="text-xs text-muted-foreground">
                Visit every {activeTrip.sitter_visit_frequency_days} day{activeTrip.sitter_visit_frequency_days !== 1 ? 's' : ''}
              </span>
              {tripEnd !== null && (
                <span className={[
                  'text-xs font-medium',
                  tripEnd <= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                ].join(' ')}>
                  {tripEnd > 0 ? `${tripEnd} day${tripEnd !== 1 ? 's' : ''} remaining` : 'Last day'}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Sitting for this household</p>
          )}
        </div>
      </div>

      {/* ── Status hero ────────────────────────────────────────── */}
      {allClear ? (
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 px-5 py-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              All caught up!
            </p>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
              {vacationCtx
                ? `All tasks done for the last ${vacationCtx.windowDays} day${vacationCtx.windowDays !== 1 ? 's' : ''}`
                : "All pets and chores are taken care of today"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 px-5 py-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertCircle className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {totalPending} task{totalPending !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">
              {[
                pendingCatCount > 0 && `${pendingCatCount} pet${pendingCatCount !== 1 ? 's' : ''} need attention`,
                pendingChoreCount > 0 && `${pendingChoreCount} chore${pendingChoreCount !== 1 ? 's' : ''} pending`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 lg:items-start">

        {/* Left: pet tasks + chores */}
        <div className="space-y-5">

          {/* Pet care section */}
          {cats.length > 0 && (
            <section aria-label="Pet care tasks">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                Pet Care
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catRows
                  .sort((a, b) => Number(b.hasPending) - Number(a.hasPending))
                  .map(({ cat }) => (
                    <CatTaskCard
                      key={cat.id}
                      cat={cat}
                      windowEvents={windowEvents}
                      allMedEvents={allMedEvents}
                      memberMap={memberMap}
                      currentUserId={currentUserId}
                      requirements={catRequirements.get(cat.id)}
                      onLog={onLog}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Household chores */}
          {choreDefinitions.some(d => d.active) && (
            <section aria-label="Household chores">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Household
              </h2>
              <HouseholdChoresSection
                householdId={household.id}
                chores={todayChores}
                definitions={choreDefinitions}
                memberMap={memberMap}
                onLog={onLogChore}
              />
            </section>
          )}

          {/* Quick-reference info panel */}
          {hasInfoPanel && (
            <section aria-label="Emergency and vet contacts">
              <button
                onClick={() => setInfoOpen((v) => !v)}
                aria-expanded={infoOpen}
                aria-controls="sitter-info-panel"
                className="flex items-center justify-between w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-sky-500 shrink-0" />
                  Vet &amp; Emergency Contacts
                </span>
                {infoOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {infoOpen && (
                <div
                  id="sitter-info-panel"
                  className="mt-2 rounded-2xl border border-border bg-card px-4 py-4 space-y-4"
                >
                  {/* Household vet */}
                  {hasHouseholdVet && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Household Vet
                      </p>
                      {household.vet_clinic && <p className="text-sm font-medium">{household.vet_clinic}</p>}
                      {household.vet_name && <p className="text-sm text-muted-foreground">{household.vet_name}</p>}
                      {household.vet_phone && (
                        <PhoneLink phone={household.vet_phone} label={household.vet_phone} />
                      )}
                    </div>
                  )}

                  {/* Per-cat vets (only if different from household vet or household has no vet) */}
                  {cats
                    .filter(c => c.vet_name || c.vet_phone || c.vet_clinic)
                    .map(cat => (
                      <div key={cat.id}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          {cat.name}'s Vet
                        </p>
                        {cat.vet_clinic && <p className="text-sm font-medium">{cat.vet_clinic}</p>}
                        {cat.vet_name && <p className="text-sm text-muted-foreground">{cat.vet_name}</p>}
                        {cat.vet_phone && (
                          <PhoneLink phone={cat.vet_phone} label={cat.vet_phone} />
                        )}
                      </div>
                    ))}

                  {/* Emergency contact */}
                  {hasEmergencyContact && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-3 py-2.5">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">
                        Emergency Contact
                      </p>
                      {household.emergency_contact_name && (
                        <p className="text-sm font-medium">{household.emergency_contact_name}</p>
                      )}
                      {household.emergency_contact_phone && (
                        <PhoneLink
                          phone={household.emergency_contact_phone}
                          label={household.emergency_contact_phone}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right: today's care log */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <TodayCareLog
            todayEvents={selectedDateEvents}
            selectedDate={selectedDate}
            onPrevDay={onPrevDay}
            onNextDay={onNextDay}
            cats={cats}
            memberMap={memberMap}
            currentUserId={currentUserId}
            onEdit={onEdit}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onQuickLog={(cat) => onLog(cat)}
            onGoToToday={onGoToToday}
          />
        </div>
      </div>
    </div>
  )
}
