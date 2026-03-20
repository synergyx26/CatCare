import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { Household, HouseholdInvite, HouseholdMember, MemberRole } from '@/types/api'

interface MembersSectionProps {
  household: Household
  currentUserId: number
  currentRole: MemberRole | null
  pendingInvites: HouseholdInvite[]
}

export function MembersSection({
  household,
  currentUserId,
  currentRole,
  pendingInvites,
}: MembersSectionProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('member')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<HouseholdMember | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.createInvite(household.id, {
        invite: { email: inviteEmail.trim(), role: inviteRole },
      }),
    onSuccess: (res) => {
      const invite: HouseholdInvite = res.data.data
      const link = `${window.location.origin}/invites/${invite.token}`
      setGeneratedLink(link)
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['invites', household.id] })
      toast.success('Invite link generated!')
    },
    onError: () => {
      toast.error('Failed to generate invite. Please try again.')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (inviteId: number) => api.revokeInvite(household.id, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', household.id] })
      toast.success('Invite revoked')
    },
    onError: () => {
      toast.error('Failed to revoke invite.')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: number; role: MemberRole }) =>
      api.updateMemberRole(household.id, membershipId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] })
      toast.success('Role updated')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      toast.error(msg ?? 'Failed to update role.')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: number) =>
      api.removeMember(household.id, membershipId),
    onSuccess: () => {
      setRemovingMember(null)
      queryClient.invalidateQueries({ queryKey: ['households'] })
      toast.success('Member removed')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      toast.error(msg ?? 'Failed to remove member.')
    },
  })

  const isAdmin = currentRole === 'admin'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Members
        </h2>
        {isAdmin && (
          <button
            onClick={() => {
              setShowInviteForm((v) => !v)
              setGeneratedLink(null)
            }}
            className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
          >
            {showInviteForm ? 'Cancel' : 'Invite someone'}
          </button>
        )}
      </div>

      {/* Member list */}
      {isAdmin ? (
        <div className="space-y-1.5">
          {(household.members ?? []).map((m: HouseholdMember) => {
            const isMe = m.id === currentUserId
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-card ring-1 ring-border/60 shadow-sm px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                        (you)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isMe ? (
                    <span className="text-xs text-muted-foreground capitalize">
                      {m.role}
                    </span>
                  ) : (
                    <>
                      <select
                        value={m.role ?? 'member'}
                        onChange={(e) => {
                          if (m.membership_id) {
                            updateRoleMutation.mutate({
                              membershipId: m.membership_id,
                              role: e.target.value as MemberRole,
                            })
                          }
                        }}
                        disabled={updateRoleMutation.isPending}
                        className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:border-ring dark:bg-input/30"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="sitter">Sitter</option>
                      </select>

                      <button
                        onClick={() => setRemovingMember(m)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(household.members ?? []).map((m: HouseholdMember) => {
            const isMe = m.id === currentUserId
            const chip = (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  isMe
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                    : 'bg-muted text-foreground'
                }`}
              >
                {m.name}
                {isMe && <span className="ml-1 opacity-70">· My profile</span>}
                {m.role === 'admin' && !isMe && (
                  <span className="ml-1 text-muted-foreground">· Admin</span>
                )}
                {m.role === 'sitter' && !isMe && (
                  <span className="ml-1 text-muted-foreground">· Sitter</span>
                )}
              </span>
            )
            return isMe ? (
              <button
                key={m.id}
                onClick={() => navigate(`/households/${household.id}/profile`)}
              >
                {chip}
              </button>
            ) : (
              <span key={m.id}>{chip}</span>
            )
          })}
        </div>
      )}

      {/* Pending invites (admin) */}
      {isAdmin && pendingInvites.length > 0 && !showInviteForm && (
        <div className="space-y-1.5">
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="rounded-xl bg-card ring-1 ring-border/60 shadow-sm">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.role === 'sitter' ? 'Sitter · ' : ''}Pending ·
                    expires{' '}
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/invites/${inv.token}`
                      navigator.clipboard.writeText(link)
                      toast.success('Link copied!')
                    }}
                    className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => revokeMutation.mutate(inv.id)}
                    disabled={revokeMutation.isPending}
                    className="text-xs text-destructive underline"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remove member confirmation dialog */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => { if (!open) setRemovingMember(null) }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingMember?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this household immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removingMember?.membership_id) {
                  removeMemberMutation.mutate(removingMember.membership_id)
                }
              }}
              disabled={removeMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite form */}
      {showInviteForm && (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm p-4 space-y-3">
          {generatedLink ? (
            <>
              <p className="text-sm font-medium">Share this link:</p>
              <div className="flex gap-2">
                <Input
                  ref={linkRef}
                  readOnly
                  value={generatedLink}
                  className="text-xs rounded-xl"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink)
                    linkRef.current?.select()
                    toast.success('Link copied!')
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Link expires in 7 days. Anyone with this link can join your
                household.
              </p>
              <button
                onClick={() => setGeneratedLink(null)}
                className="text-xs text-muted-foreground underline"
              >
                Generate another link
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Generate an invite link</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="their@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-xl"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? '...' : 'Get link'}
                </Button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Invite as
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="member">Household member</option>
                  <option value="sitter">
                    Pet sitter (can log care, view only)
                  </option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter their email, get a link, send it any way you like.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
