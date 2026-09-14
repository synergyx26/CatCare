import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { AdminUser, AdminHousehold, AdminStats, SubscriptionTier, MemberRole, ApiError } from '@/types/api'
import { useNavigate } from 'react-router-dom'
import {
  Users, Home, Cat as CatIcon, ClipboardList,
  Search, ChevronLeft, ChevronRight, Shield, ArrowLeft, Copy, KeyRound, Trash2, UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// base58 alphabet (no 0/O/1/l/I) — avoids visually ambiguous characters when
// an admin relays a generated password to someone else by hand.
const PASSWORD_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function generatePassword(length = 16): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
}

// Same flag LoginPage/RegisterPage use — true only on a deployment that has
// opted into name+password accounts (see api's User.local_accounts_enabled?).
// Drives whether email is optional here too, so this form behaves
// identically to self-service registration on every deployment.
const isLocalAccounts = import.meta.env.VITE_LOCAL_ACCOUNTS_ENABLED === 'true'

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<SubscriptionTier, string> = {
  free:    '#94a3b8',
  pro:     '#3b82f6',
  premium: '#a855f7',
}

const TIER_OPTIONS: SubscriptionTier[] = ['free', 'pro', 'premium']
const ROLE_OPTIONS: MemberRole[] = ['member', 'admin', 'sitter']

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

  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  // Filters
  const [search, setSearch]     = useState('')
  const [tierFilter, setTier]   = useState<SubscriptionTier | ''>('')
  const [page, setPage]         = useState(1)
  const [editingId, setEditing] = useState<number | null>(null)
  const [editTier, setEditTier] = useState<SubscriptionTier>('free')

  // Password reset dialog
  const [resetUser, setResetUser]     = useState<AdminUser | null>(null)
  const [resetInput, setResetInput]   = useState('')
  const [resetResult, setResetResult] = useState<string | null>(null)

  // Delete user dialog
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)

  // Currently selected household (for "create user" below)
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null)

  // Create user dialog
  const [createOpen, setCreateOpen]         = useState(false)
  const [createName, setCreateName]         = useState('')
  const [createEmail, setCreateEmail]       = useState('')
  const [createRole, setCreateRole]         = useState<MemberRole>('member')
  const [createPassword, setCreatePassword] = useState('')
  const [createResult, setCreateResult]     = useState<{ name: string; password: string } | null>(null)

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

  const { data: householdsData } = useQuery({
    queryKey: ['admin_households'],
    queryFn:  () => api.adminHouseholds(),
    staleTime: 5 * 60_000,
  })
  const households: AdminHousehold[] = householdsData?.data?.data ?? []

  // Default the household picker to the first household once loaded — the
  // "currently selected household" create-user attaches to.
  useEffect(() => {
    if (selectedHouseholdId === null && households.length > 0) {
      setSelectedHouseholdId(households[0].id)
    }
  }, [households, selectedHouseholdId])

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

  // Password reset mutation
  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password?: string }) =>
      api.adminResetUserPassword(userId, password),
    onSuccess: (res) => {
      setResetResult(res.data.data.password as string)
    },
    onError: () => toast.error('Failed to reset password'),
  })

  function openReset(user: AdminUser) {
    setResetUser(user)
    setResetInput('')
    setResetResult(null)
  }

  function closeReset() {
    setResetUser(null)
    setResetInput('')
    setResetResult(null)
  }

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: (userId: number) => api.adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      setDeletingUser(null)
      toast.success('User deleted')
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Failed to delete user.'
      toast.error(message)
    },
  })

  function copyResetResult() {
    if (!resetResult) return
    navigator.clipboard.writeText(resetResult)
    toast.success('Copied to clipboard')
  }

  // Create user mutation
  const createUser = useMutation({
    mutationFn: (data: { name: string; email?: string; password?: string; role: string; household_id: number }) =>
      api.adminCreateUser(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      setCreateResult({ name: res.data.data.name, password: res.data.data.password })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Failed to create user.'
      toast.error(message)
    },
  })

  function openCreate() {
    setCreateName('')
    setCreateEmail('')
    setCreateRole('member')
    setCreatePassword('')
    setCreateResult(null)
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
  }

  function copyCreateResult() {
    if (!createResult) return
    navigator.clipboard.writeText(createResult.password)
    toast.success('Copied to clipboard')
  }

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId) ?? null
  const canSubmitCreate =
    createName.trim().length > 0 &&
    (isLocalAccounts || createEmail.trim().length > 0) &&
    selectedHouseholdId !== null

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
          <button
            onClick={() => navigate('/dashboard')}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to app
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Household picker + create user ── */}
        <div className="rounded-2xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Home className="size-4 text-muted-foreground shrink-0" />
            <select
              value={selectedHouseholdId ?? ''}
              onChange={(e) => setSelectedHouseholdId(e.target.value ? Number(e.target.value) : null)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
            >
              {households.length === 0 && <option value="">No households yet</option>}
              {households.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreate}
            disabled={households.length === 0}
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors shrink-0"
          >
            <UserPlus className="size-3.5" />
            Create user
          </button>
        </div>

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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openReset(user)}
                          className="text-xs text-violet-500 hover:text-violet-600 font-medium"
                        >
                          Reset password
                        </button>
                        <button
                          onClick={() => openEdit(user)}
                          className="text-xs text-sky-500 hover:text-sky-600 font-medium"
                        >
                          Change tier
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="text-xs text-destructive hover:text-destructive/80 font-medium"
                        >
                          Remove
                        </button>
                      </div>
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
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openReset(user)}
                              className="text-xs text-violet-500 hover:text-violet-600 font-medium transition-colors"
                            >
                              Reset password
                            </button>
                            {editingId !== user.id && (
                              <button
                                onClick={() => openEdit(user)}
                                className="text-xs text-sky-500 hover:text-sky-600 font-medium transition-colors"
                              >
                                Edit tier
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingUser(user)}
                              className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
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

      {/* ── Reset password dialog ── */}
      <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) closeReset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-violet-500" />
              Reset password
            </DialogTitle>
            <DialogDescription>
              {resetUser && `For ${resetUser.name} (${resetUser.email}). `}
              This is a local account — self-hosted instances can't reliably send
              reset emails, so set a new password directly instead.
            </DialogDescription>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                New password — copy it now, it won't be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
                  {resetResult}
                </code>
                <button
                  onClick={copyResetResult}
                  className="shrink-0 flex size-9 items-center justify-center rounded-md border hover:bg-muted transition-colors"
                  aria-label="Copy password"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setResetInput(generatePassword())}
                  className="shrink-0 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            {resetResult ? (
              <button
                onClick={closeReset}
                className="h-9 px-4 rounded-md bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={closeReset}
                  className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetUser && resetPassword.mutate({ userId: resetUser.id, password: resetInput || undefined })}
                  disabled={resetPassword.isPending}
                  className="h-9 px-4 rounded-md bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete user confirmation ── */}
      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => { if (!open) setDeletingUser(null) }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              Delete {deletingUser?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes their account. Households where they're the only
              active member are deleted entirely (cats, care history, everything); in
              shared households, their events and notes are kept but anonymised. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteUser.mutate(deletingUser.id)}
              disabled={deleteUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create user dialog ── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-violet-500" />
              Create user
            </DialogTitle>
            <DialogDescription>
              {createResult
                ? `${createResult.name} was added to ${selectedHousehold?.name ?? 'the household'}.`
                : `Adds a new account directly to ${selectedHousehold?.name ?? 'the selected household'} — no invite email required.`}
            </DialogDescription>
          </DialogHeader>

          {createResult ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Password — copy it now, it won't be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
                  {createResult.password}
                </code>
                <button
                  onClick={copyCreateResult}
                  className="shrink-0 flex size-9 items-center justify-center rounded-md border hover:bg-muted transition-colors"
                  aria-label="Copy password"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Email{!isLocalAccounts && ' (required)'}
                </label>
                <input
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  type="email"
                  placeholder={isLocalAccounts ? 'Optional — leave blank for a no-email local account' : 'you@example.com'}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as MemberRole)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Auto-generate"
                      className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background px-3 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setCreatePassword(generatePassword())}
                      className="shrink-0 h-9 px-2.5 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {createResult ? (
              <button
                onClick={closeCreate}
                className="h-9 px-4 rounded-md bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={closeCreate}
                  className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedHouseholdId && createUser.mutate({
                    name: createName.trim(),
                    email: createEmail.trim() || undefined,
                    password: createPassword || undefined,
                    role: createRole,
                    household_id: selectedHouseholdId,
                  })}
                  disabled={!canSubmitCreate || createUser.isPending}
                  className="h-9 px-4 rounded-md bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  {createUser.isPending ? 'Creating…' : 'Create user'}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
