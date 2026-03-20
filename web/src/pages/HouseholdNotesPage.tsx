import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { CareNotesSection } from '@/components/care-notes/CareNotesSection'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Household } from '@/types/api'

export function HouseholdNotesPage() {
  usePageTitle('Household notes')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const hid = Number(householdId)

  const { data: householdData, isLoading } = useQuery({
    queryKey: ['household', householdId],
    queryFn: () => api.getHousehold(hid),
    enabled: !!hid,
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  const household: Household | undefined = householdData?.data?.data
  const currentRole = household?.members.find((m) => m.id === user?.id)?.role ?? null

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <PageHeader
        title="Household notes"
        subtitle="Reference information for anyone caring for the household"
        backTo={{
          label: 'Back to dashboard',
          onClick: () => navigate('/dashboard'),
        }}
      />

      <CareNotesSection
        householdId={hid}
        currentRole={currentRole}
      />
    </div>
  )
}
