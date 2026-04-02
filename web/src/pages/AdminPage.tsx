import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { AdminUser, AdminStats, SubscriptionTier } from '@/types/api'
import {
  Users, Home, Cat as CatIcon, ClipboardList,
  Search, ChevronLeft, ChevronRight, Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<SubscriptionTier, string> = {
  free:    '#94a3b8',
  pro:     '#3b82f6',
  premium: '#a855f7',
}

const TIER_OPTIONS: SubscriptionTier[] = ['free', 'pro', 'premium']

// ── Small components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string; color?: string }>
  color: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-center gap-4">
      <div
        className="flex size-11 items-center justify-center rounded-xl shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="size-5" color={color} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: SubscriptionTier }) {
  const color = TIER_COLORS[tier]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {tier}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  usePageTitle('Admin')

  const queryClient = useQueryClient()

  // Filters
  const [search, setSearch]     = useState('')
  const [tierFilter, setTier]   = useState<SubscriptionTier | ''>('')
  const [page, setPage]         = useState(1)
  const [editingId, setEditing] = useState<number | null>(null)
  const [editTier, setEditTier] = useState<SubscriptionTier>('free')

  // Queries
  const { data: statsData } = useQuery({
    queryKey: ['admin_stats'],
    queryFn:  () => api.adminStats(),
    staleTime: 60_000,
  })
  const stats: AdminStats | undefined = statsData?.data?.data

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin_users', page, search, tierFilter],
    queryFn:  () => api.adminUsers({ page, per: 20, search: search || undefined, tier: tierFilter || undefined }),
    staleTime: 30_000,
  })
  const users: AdminUser[]  = usersData?.data?.data ?? []
  const meta                = usersData?.data?.meta ?? { total: 0, pages: 1 }

  // Tier update mutation
  const updateTier = useMutation({
    mutationFn: ({ userId, tier }: { userId: number; tier: string }) =>
      api.adminUpdateUserTier(userId, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      setEditing(null)
      toast.success('Tier updated')
    },
    onError: () => toast.error('Failed to update tier'),
  })

  function openEdit(user: AdminUser) {
    setEditing(user.id)
    setEditTier(user.subscription_tier)
  }

  function handleSearchChange(val: string) {
    setSearch(val)
    setPage(1)
  }

  function handleTierFilter(val: SubscriptionTier | '') {
    setTier(val)
    setPage(1)
  }

  // Signup chart data — pad to always show last 14 days
  const chartData = (() => {
    if (!stats) return []
    const map = new Map(stats.signups_by_day.map((d) => [d.date, d.count]))
    const days: { date: string; label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d    = new Date(); d.setDate(d.getDate() - i)
      const key  = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      days.push({ date: key, label, count: map.get(key) ?? 0 })
    }
    return days
  })()

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Shield className="size-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">CatCare internal</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Summary stats ── */}
        {stats && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total users"       value={stats.total_users}       icon={Users}       color="#3b82f6" />
              <StatCard label="Total households"  value={stats.total_households}  icon={Home}        color="#22c55e" />
              <StatCard label="Total cats"        value={stats.total_cats}        icon={CatIcon}     color="#f59e0b" />
              <StatCard label="Care events"       value={stats.total_care_events} icon={ClipboardList} color="#06b6d4" />
            </div>

            {/* ── Tier breakdown + signups chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Tier breakdown */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Tier breakdown</p>
                {TIER_OPTIONS.map((tier) => {
                  const count = stats.tier_breakdown[tier]
                  const pct   = stats.total_users ? Math.round((count / stats.total_users) * 100) : 0
                  return (
                    <div key={tier} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium" style={{ color: TIER_COLORS[tier] }}>{tier}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tier] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Signups chart */}
              <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
                <p className="text-sm font-semibold mb-3">Signups — last 14 days</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} barSize={12}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v) => [v, 'signups']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.count > 0 ? '#6366f1' : '#e2e8f0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ── User table ── */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          {/* Table header + filters */}
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => handleTierFilter(e.target.value as SubscriptionTier | '')}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All tiers</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground self-center shrink-0">
              {meta.total} user{meta.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Mobile: cards */}
          <div className="sm:hidden divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2 animate-pulse">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-56 bg-muted rounded" />
                  </div>
                ))
              : users.map((user) => (
                  <div key={user.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <TierBadge tier={user.subscription_tier} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {user.household_count} household{user.household_count !== 1 ? 's' : ''} ·{' '}
                        {user.provider ?? 'email'} ·{' '}
                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </p>
                      <button
                        onClick={() => openEdit(user)}
                        className="text-xs text-sky-500 hover:text-sky-600 font-medium"
                      >
                        Change tier
                      </button>
                    </div>
                    {editingId === user.id && (
                      <div className="flex items-center gap-2 pt-1">
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value as SubscriptionTier)}
                          className="h-7 rounded border border-input bg-background px-2 text-xs flex-1"
                        >
                          {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                          onClick={() => updateTier.mutate({ userId: user.id, tier: editTier })}
                          disabled={updateTier.isPending}
                          className="h-7 px-3 rounded bg-sky-500 text-white text-xs font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="h-7 px-2 rounded border text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))
            }
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tier</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Households</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Auth</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Joined</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3.5 bg-muted rounded animate-pulse w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{user.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-2.5">
                          {editingId === user.id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editTier}
                                onChange={(e) => setEditTier(e.target.value as SubscriptionTier)}
                                className="h-7 rounded border border-input bg-background px-2 text-xs"
                              >
                                {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <button
                                onClick={() => updateTier.mutate({ userId: user.id, tier: editTier })}
                                disabled={updateTier.isPending}
                                className="h-7 px-2.5 rounded bg-sky-500 text-white text-xs font-medium disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="h-7 px-2 rounded border text-xs text-muted-foreground"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <TierBadge tier={user.subscription_tier} />
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                          {user.household_count}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">
                          {user.provider ?? 'email'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums text-xs">
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {editingId !== user.id && (
                            <button
                              onClick={() => openEdit(user)}
                              className="text-xs text-sky-500 hover:text-sky-600 font-medium transition-colors"
                            >
                              Edit tier
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {meta.pages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.pages}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
