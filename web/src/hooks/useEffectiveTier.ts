import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/api/client'
import type { SubscriptionTier, Household } from '@/types/api'

/**
 * Returns the effective subscription tier for the current user within the active household.
 *
 * - Admins and members: their own subscription_tier
 * - Sitters: the highest tier among non-sitter members of the household they're sitting for
 *
 * Falls back to the user's own tier if household data is not yet loaded.
 * Dynamically adjusts when the active household changes.
 */
export function useEffectiveTier(): SubscriptionTier {
  const { user, activeHouseholdId } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  const households: Household[] = data?.data?.data ?? []
  const household = households.find(h => h.id === activeHouseholdId) ?? households[0]

  return (household?.effective_tier ?? user?.subscription_tier ?? 'free') as SubscriptionTier
}
