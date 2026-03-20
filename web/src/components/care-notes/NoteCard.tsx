import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { CARE_NOTE_CATEGORY_COLORS, CARE_NOTE_CATEGORY_LABELS } from '@/lib/careNoteCategories'
import type { CareNote, MemberRole, Cat } from '@/types/api'

const editSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  body: z.string().min(1, 'Content is required'),
})
type EditForm = z.infer<typeof editSchema>

interface Props {
  note: CareNote
  householdId: number
  currentRole: MemberRole | null
  cats: Cat[]
}

export function NoteCard({ note, householdId, currentRole, cats }: Props) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canWrite = currentRole === 'admin' || currentRole === 'member'

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: note.title, body: note.body },
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) =>
      api.updateCareNote(householdId, note.id, { care_note: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_notes', householdId] })
      toast.success('Note updated')
      setEditing(false)
    },
    onError: () => toast.error('Failed to update note'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCareNote(householdId, note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_notes', householdId] })
      toast.success('Note deleted')
    },
    onError: () => toast.error('Failed to delete note'),
  })

  const categoryColor = CARE_NOTE_CATEGORY_COLORS[note.category]
  const catName = note.cat_id !== null ? cats.find((c) => c.id === note.cat_id)?.name : null

  if (editing) {
    return (
      <form
        onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
        className="rounded-xl border border-border/60 bg-card p-3 space-y-2"
      >
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="Title" className="h-8 text-sm" />
          )}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        <Controller
          name="body"
          control={control}
          render={({ field }) => (
            <Textarea {...field} placeholder="Content" rows={3} className="text-sm resize-none" />
          )}
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={updateMutation.isPending}>
            <Check className="size-3 mr-1" />
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { reset(); setEditing(false) }}
          >
            <X className="size-3 mr-1" />
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1 group">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: categoryColor }}
              title={CARE_NOTE_CATEGORY_LABELS[note.category]}
            />
            <p className="text-sm font-medium leading-snug truncate">{note.title}</p>
            {catName && (
              <span className="text-xs px-1.5 py-0 rounded-full bg-muted text-muted-foreground shrink-0">
                {catName}
              </span>
            )}
          </div>
          {canWrite && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit note"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Delete note"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{note.body}</p>
        <p className="text-xs text-muted-foreground/60">{note.created_by}</p>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{note.title}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete(false); deleteMutation.mutate() }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
