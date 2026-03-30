import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { Plus, X, StickyNote } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { NoteCard } from '@/components/care-notes/NoteCard'
import {
  CARE_NOTE_CATEGORIES,
  CARE_NOTE_CATEGORY_COLORS,
  CARE_NOTE_CATEGORY_LABELS,
} from '@/lib/careNoteCategories'
import type { CareNote, CareNoteCategory, MemberRole, Cat } from '@/types/api'

// ─── Add note form ────────────────────────────────────────────────────────────
// Extracted into its own component so useForm has a stable mount context.
// When this lives in the parent alongside conditional rendering, state changes
// (e.g. clicking a category pill) cause RHF to lose registered field values
// before the resolver runs.

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  body: z.string().min(1, 'Content is required'),
})
type CreateForm = z.infer<typeof createSchema>

const GENERAL_VALUE = '__general__'

interface AddNoteFormProps {
  householdId: number
  cats: Cat[]
  initialCategory: CareNoteCategory
  initialCatId: number | null
  onSuccess: () => void
  onCancel: () => void
}

function AddNoteForm({
  householdId,
  cats,
  initialCategory,
  initialCatId,
  onSuccess,
  onCancel,
}: AddNoteFormProps) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<CareNoteCategory>(initialCategory)
  const [catId, setCatId] = useState<number | null>(initialCatId)

  const { control, handleSubmit, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: '', body: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateForm) =>
      api.createCareNote(householdId, {
        care_note: { category, title: data.title, body: data.body, cat_id: catId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_notes', householdId] })
      notify.success('Note added')
      onSuccess()
    },
    onError: () => notify.error('Failed to add note'),
  })

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3"
    >
      {/* Scope */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">For</p>
        <Select
          value={catId === null ? GENERAL_VALUE : String(catId)}
          onValueChange={(val) => setCatId(val === GENERAL_VALUE ? null : Number(val))}
        >
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue placeholder="Select…">
              {catId === null
                ? 'General (whole household)'
                : (cats.find((c) => c.id === catId)?.name ?? 'Select…')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERAL_VALUE}>General (whole household)</SelectItem>
            {cats.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CARE_NOTE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={[
                'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                category === cat
                  ? 'border-transparent text-white'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
              ].join(' ')}
              style={category === cat ? { backgroundColor: CARE_NOTE_CATEGORY_COLORS[cat] } : {}}
            >
              {CARE_NOTE_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Title — e.g. Feeding amounts"
              className="h-8 text-sm"
            />
          )}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1">
        <Controller
          name="body"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Write your note here…"
              rows={3}
              className="text-sm resize-none"
            />
          )}
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          Save note
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-3 mr-1" />
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─── CareNotesSection ─────────────────────────────────────────────────────────

interface Props {
  householdId: number
  catId?: number
  currentRole: MemberRole | null
}

export function CareNotesSection({ householdId, catId, currentRole }: Props) {
  const [addingCategory, setAddingCategory] = useState<CareNoteCategory | null>(null)
  const canWrite = currentRole === 'admin' || currentRole === 'member'

  const queryKey = ['care_notes', householdId, catId ?? null] as const

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey,
    queryFn: () => api.getCareNotes(householdId, catId ? { cat_id: catId } : undefined),
    staleTime: 5 * 60 * 1000,
  })

  const { data: catsData } = useQuery({
    queryKey: ['cats', householdId],
    queryFn: () => api.getCats(householdId),
    staleTime: 5 * 60 * 1000,
  })

  const notes: CareNote[] = notesData?.data?.data ?? []
  const cats: Cat[] = catsData?.data?.data ?? []

  const grouped = CARE_NOTE_CATEGORIES.reduce<Record<CareNoteCategory, CareNote[]>>(
    (acc, cat) => {
      acc[cat] = notes.filter((n) => n.category === cat)
      return acc
    },
    {} as Record<CareNoteCategory, CareNote[]>
  )

  const activeCategories = CARE_NOTE_CATEGORIES.filter((cat) => grouped[cat].length > 0)

  if (notesLoading) {
    return (
      <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm p-4 space-y-3">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  const hasNotes = notes.length > 0

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Care notes</h3>
        </div>
        {canWrite && !addingCategory && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAddingCategory('general')}
          >
            <Plus className="size-3" />
            Add note
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Add note form — mounted as its own component for stable useForm lifecycle */}
        {addingCategory && canWrite && (
          <AddNoteForm
            householdId={householdId}
            cats={cats}
            initialCategory={addingCategory}
            initialCatId={catId ?? null}
            onSuccess={() => setAddingCategory(null)}
            onCancel={() => setAddingCategory(null)}
          />
        )}

        {/* Empty state */}
        {!hasNotes && !addingCategory && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {canWrite
              ? 'No care notes yet. Add one to help your sitter.'
              : 'No care notes have been added yet.'}
          </p>
        )}

        {/* Grouped notes by category */}
        {activeCategories.map((cat) => {
          const catNotes = grouped[cat]
          if (catNotes.length === 0) return null
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: CARE_NOTE_CATEGORY_COLORS[cat] }}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CARE_NOTE_CATEGORY_LABELS[cat]}
                </span>
              </div>
              <div className="space-y-2">
                {catNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    householdId={householdId}
                    currentRole={currentRole}
                    cats={cats}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Per-category add shortcuts */}
        {canWrite && !addingCategory && hasNotes && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
            {CARE_NOTE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setAddingCategory(cat)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border border-dashed border-border/60 text-muted-foreground hover:border-border hover:text-foreground transition-colors"
              >
                <Plus className="size-2.5" />
                {CARE_NOTE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
