import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  PawPrint,
  Users,
  Building2,
  Plane,
  Phone,
  Stethoscope,
  Check,
  Plus,
  Crown,
  Shield,
  User,
  ArrowRight,
} from 'lucide-react'
import type { Household, MemberRole, SubscriptionTier } from '@/types/api'

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, string> = {
    admin:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    member: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    sitter: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  const icons: Record<MemberRole, typeof User> = {
    admin: Crown,
    member: User,
    sitter: Shield,
  }
  const Icon = icons[role]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${styles[role]}`}>
      <Icon className="size-2.5" />
      {role}
    </span>
  )
}

function TierChip({ tier }: { tier: SubscriptionTier }) {
  const styles: Record<SubscriptionTier, string> = {
    free:    'bg-muted text-muted-foreground',
    pro:     'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    premium: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${styles[tier]}`}>
      {tier}
    </span>
  )
}

function StatPill({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value: number | string
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span className="font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  )
}

function HouseholdCard({
  household,
  isActive,
  userRole,
  onSwitch,
}: {
  household: Household
  isActive: boolean
  userRole: MemberRole | undefined
  onSwitch: () => void
}) {
  const hasVet = !!(household.vet_name || household.vet_clinic)
  const hasEmergencyContact = !!(household.emergency_contact_name || household.emergency_contact_phone)

  return (
    <div
      className={[
        'relative rounded-xl border bg-white dark:bg-card p-5 transition-all duration-150',
        isActive
          ? 'border-sky-300 shadow-md shadow-sky-100/60 dark:border-sky-700 dark:shadow-sky-950/40 ring-1 ring-sky-200 dark:ring-sky-800'
          : 'border-border hover:border-sky-200 hover:shadow-sm dark:hover:border-sky-800',
      ].join(' ')}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <Check className="size-2.5" />
          Active
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={[
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            isActive
              ? 'bg-sky-500 text-white'
              : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400',
          ].join(' ')}>
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate leading-tight">{household.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {userRole && <RoleBadge role={userRole} />}
              <TierChip tier={household.effective_tier} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 py-3 border-y border-dashed border-border/60">
        <StatPill icon={PawPrint} value={household.cat_count} label={household.cat_count === 1 ? 'cat' : 'cats'} />
        <div className="w-px h-3.5 bg-border/60" />
        <StatPill icon={Users} value={household.member_count} label={household.member_count === 1 ? 'member' : 'members'} />
      </div>

      {/* Indicators */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {household.active_vacation_trip && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Plane className="size-3" />
            Vacation active
          </span>
        )}
        {hasVet && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <Stethoscope className="size-3" />
            Vet on file
          </span>
        )}
        {hasEmergencyContact && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Phone className="size-3" />
            Emergency contact
          </span>
        )}
        {!hasVet && !hasEmergencyContact && !household.active_vacation_trip && (
          <span className="text-[11px] text-muted-foreground">No additional details on file</span>
        )}
      </div>

      {/* Action */}
      <div className="mt-4">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-300"
            onClick={onSwitch}
          >
            <Check className="size-3.5" />
            Currently viewing
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/30 dark:hover:text-sky-300"
            onClick={onSwitch}
          >
            Switch to this household
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function HouseholdsOverviewPage() {
  usePageTitle('All Households')
  const navigate = useNavigate()
  const { user, activeHouseholdId, setActiveHousehold } = useAuthStore()

  const { data: householdsData, isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
  })
  const households: Household[] = householdsData?.data?.data ?? []

  function handleSwitch(household: Household) {
    setActiveHousehold(household.id)
    navigate('/dashboard')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Households"
        subtitle={`You're a member of ${households.length} household${households.length !== 1 ? 's' : ''}`}
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate('/setup')}
          >
            <Plus className="size-4" />
            New household
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white dark:bg-card p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="h-px bg-muted" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : households.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/30">
            <Building2 className="size-8 text-sky-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No households yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first household to get started</p>
          </div>
          <Button onClick={() => navigate('/setup')} className="gap-1.5 mt-2">
            <Plus className="size-4" />
            Create a household
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {households.map((h) => {
            const userRole = h.members.find((m) => m.id === user?.id)?.role
            const isActive = h.id === activeHouseholdId
            return (
              <HouseholdCard
                key={h.id}
                household={h}
                isActive={isActive}
                userRole={userRole}
                onSwitch={() => handleSwitch(h)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
