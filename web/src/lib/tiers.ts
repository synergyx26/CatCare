import type { SubscriptionTier } from '@/types/api'

/** Active-cat cap per tier. Mirrors `tier_cat_limit` in cats_controller.rb (the source of truth). */
export function catLimitForTier(tier: SubscriptionTier): number {
  return tier === 'premium' ? Infinity : tier === 'pro' ? 3 : 1
}

export function catLimitUpgradeHint(tier: SubscriptionTier): string {
  return tier === 'pro'
    ? 'Upgrade to Premium to add more than 3 cats.'
    : 'Upgrade to Pro or Premium to add more cats.'
}
