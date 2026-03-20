import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronRight } from 'lucide-react'
import { api } from '@/api/client'
import { CARE_NOTE_CATEGORY_COLORS, CARE_NOTE_CATEGORY_LABELS } from '@/lib/careNoteCategories'
import type { CareNote, Cat, MemberRole } from '@/types/api'

const MAX_PREVIEW = 3

interface Props {
  householdId: number
  currentRole: MemberRole | null
}

export function HouseholdNotesSection({ householdId, currentRole }: Props) {
  const navigate = useNavigate()

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['care_notes', householdId, null] as const,
    queryFn: () => api.getCareNotes(householdId),
    staleTime: 5 * 60 * 1000,
  })

  const { data: catsData } = useQuery({
    queryKey: ['cats', householdId],
    queryFn: () => api.getCats(householdId),
    staleTime: 5 * 60 * 1000,
  })

  const allNotes: CareNote[] = notesData?.data?.data ?? []
  const cats: Cat[] = catsData?.data?.data ?? []
  const preview = allNotes.slice(0, MAX_PREVIEW)

  if (notesLoading) {
    return (
      <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm p-4 space-y-3">
        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (allNotes.length === 0 && currentRole === 'sitter') {
    return null
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Household notes</h2>
        </div>
        <button
          onClick={() => navigate(`/households/${householdId}/notes`)}
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {currentRole !== 'sitter' ? 'Manage' : 'See all'}
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {allNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              No notes yet.{' '}
              <button
                onClick={() => navigate(`/households/${householdId}/notes`)}
                className="text-sky-600 dark:text-sky-400 hover:underline"
              >
                Add one
              </button>{' '}
              to help your sitter get up to speed.
            </p>
          </div>
        ) : (
          <>
            {preview.map((note) => {
              const catName = note.cat_id !== null
                ? cats.find((c) => c.id === note.cat_id)?.name
                : null
              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-border/60 bg-card p-3 space-y-1"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CARE_NOTE_CATEGORY_COLORS[note.category] }}
                    />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {CARE_NOTE_CATEGORY_LABELS[note.category]}
                    </p>
                    {catName && (
                      <span className="text-xs px-1.5 py-0 rounded-full bg-muted text-muted-foreground">
                        {catName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug">{note.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap leading-relaxed">
                    {note.body}
                  </p>
                </div>
              )
            })}

            {allNotes.length > MAX_PREVIEW && (
              <button
                onClick={() => navigate(`/households/${householdId}/notes`)}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
              >
                +{allNotes.length - MAX_PREVIEW} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
