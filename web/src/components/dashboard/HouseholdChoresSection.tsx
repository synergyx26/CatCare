import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { formatTime } from '@/lib/helpers'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import type { HouseholdChore, HouseholdChoreDefinition } from '@/types/api'

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface HouseholdChoresSectionProps {
  householdId: number
  chores: HouseholdChore[]
  definitions: HouseholdChoreDefinition[]
  memberMap: Map<number, string>
  onLog: (definitionId: number) => void
}

function ChoreRow({
  definition,
  instances,
  memberMap,
  onLog,
  onEdit,
  onDelete,
}: {
  definition: HouseholdChoreDefinition
  instances: HouseholdChore[]
  memberMap: Map<number, string>
  onLog: () => void
  onEdit: (chore: HouseholdChore) => void
  onDelete: (id: number) => void
}) {
  const freq = definition.frequency_per_day
  const doneCount = instances.length
  const done = doneCount >= freq
  const partial = doneCount > 0 && !done

  const sorted = [...instances].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )
  const lastAt = sorted[0]?.occurred_at ?? null

  return (
    <div className="border-b last:border-b-0 border-border/40">
      {/* Definition header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {definition.emoji && (
            <span aria-hidden="true" className="text-base leading-none">{definition.emoji}</span>
          )}
          <div>
            <p className="text-sm font-medium leading-none">{definition.name}</p>
            {lastAt && (
              <p className="text-xs mt-0.5 text-muted-foreground">
                Last at {formatTime(lastAt)}
                {freq > 1 && ` · ${doneCount}/${freq} done`}
              </p>
            )}
            {!lastAt && freq > 1 && (
              <p className="text-xs mt-0.5 text-muted-foreground">{freq}× per day needed</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {done ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
              ✓ {freq > 1 ? `${doneCount}/${freq}` : 'Done'}
            </span>
          ) : (
            <>
              {partial && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                  {doneCount}/{freq}
                </span>
              )}
              <Button size="sm" variant="ghost" className="rounded-xl h-7 px-3 text-xs" onClick={onLog}>
                Log
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Logged instances for today */}
      {sorted.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 pl-11">
          {sorted.map(chore => (
            <div key={chore.id} className="flex items-center gap-2 group">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">
                  {formatTime(chore.occurred_at)}
                  {' · '}
                  {memberMap.get(chore.logged_by_id) ?? 'Unknown'}
                </span>
                {chore.notes && (
                  <span className="ml-1 text-xs text-muted-foreground/70 italic">— {chore.notes}</span>
                )}
              </div>
              <button
                onClick={() => onEdit(chore)}
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Edit chore entry"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(chore.id)}
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Delete chore entry"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function HouseholdChoresSection({
  householdId,
  chores,
  definitions,
  memberMap,
  onLog,
}: HouseholdChoresSectionProps) {
  const queryClient = useQueryClient()
  const [editingChore, setEditingChore] = useState<HouseholdChore | null>(null)
  const [editOccurredAt, setEditOccurredAt] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [deletingChoreId, setDeletingChoreId] = useState<number | null>(null)

  const updateMutation = useMutation({
    mutationFn: ({ id, occurred_at, notes }: { id: number; occurred_at: string; notes: string | null }) =>
      api.updateHouseholdChore(householdId, id, { household_chore: { occurred_at, notes: notes || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household_chores', householdId] })
      setEditingChore(null)
      notify.success('Chore updated.')
    },
    onError: () => notify.error('Failed to update chore.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteHouseholdChore(householdId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household_chores', householdId] })
      setDeletingChoreId(null)
      notify.success('Chore entry deleted.')
    },
    onError: () => notify.error('Failed to delete chore entry.'),
  })

  const activeDefinitions = definitions.filter(d => d.active)
  if (activeDefinitions.length === 0) return null

  const today = new Date()
  const todayChores = chores.filter(c => {
    const d = new Date(c.occurred_at)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  })

  function openEdit(chore: HouseholdChore) {
    setEditingChore(chore)
    setEditOccurredAt(toLocalInput(chore.occurred_at))
    setEditNotes(chore.notes ?? '')
  }

  function handleSaveEdit() {
    if (!editingChore) return
    updateMutation.mutate({
      id: editingChore.id,
      occurred_at: new Date(editOccurredAt).toISOString(),
      notes: editNotes || null,
    })
  }

  return (
    <>
      <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-sm font-semibold">Household chores</p>
          <p className="text-xs text-muted-foreground mt-0.5">Shared tasks for the whole house</p>
        </div>
        {activeDefinitions.map(def => {
          const instances = todayChores.filter(c => c.chore_definition_id === def.id)
          return (
            <ChoreRow
              key={def.id}
              definition={def}
              instances={instances}
              memberMap={memberMap}
              onLog={() => onLog(def.id)}
              onEdit={openEdit}
              onDelete={id => setDeletingChoreId(id)}
            />
          )
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={editingChore !== null} onOpenChange={open => { if (!open) setEditingChore(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit chore entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Time</label>
              <input
                type="datetime-local"
                value={editOccurredAt}
                onChange={e => setEditOccurredAt(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Any notes..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingChoreId !== null}
        onOpenChange={open => { if (!open) setDeletingChoreId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chore entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingChoreId !== null && deleteMutation.mutate(deletingChoreId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
