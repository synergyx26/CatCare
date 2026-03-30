import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { FileDown, Loader2, Lock } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { api } from '@/api/client'
import { assembleVetSummary } from '@/lib/vetExport'
import { VetSummaryDocument } from '@/components/pdf/VetSummaryDocument'
import type { Cat, CatStats, CareEvent, CareNote, SubscriptionTier } from '@/types/api'

interface Props {
  cat: Cat
  householdId: number
  range: '7d' | '30d' | '90d'
  tier: SubscriptionTier
}

/** Tier gate: Free tier cannot export. Pro: 30d. Premium: all ranges. */
function isExportAllowed(tier: SubscriptionTier, range: '7d' | '30d' | '90d'): boolean {
  if (tier === 'premium') return true
  if (tier === 'pro')     return range !== '90d'
  return false
}

export function ExportPdfButton({ cat, householdId, range, tier }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const allowed = isExportAllowed(tier, range)

  // These queries only fire when isExporting=true — fire in parallel
  const statsQuery = useQuery({
    queryKey: ['cat_stats', householdId, cat.id, range, 0],
    queryFn: () => api.getCatStats(householdId, cat.id, range, 0),
    enabled: isExporting,
    staleTime: 5 * 60 * 1000,
  })

  const medQuery = useQuery({
    queryKey: ['care_events_export', householdId, cat.id, 'medication'],
    queryFn: () => api.getCareEvents(householdId, { catId: cat.id, eventTypes: ['medication'] }),
    enabled: isExporting,
    staleTime: 5 * 60 * 1000,
  })

  const vetQuery = useQuery({
    queryKey: ['care_events_export', householdId, cat.id, 'vet_visit'],
    queryFn: () => api.getCareEvents(householdId, { catId: cat.id, eventTypes: ['vet_visit'] }),
    enabled: isExporting,
    staleTime: 5 * 60 * 1000,
  })

  const notesQuery = useQuery({
    queryKey: ['care_notes_export', householdId, cat.id],
    queryFn: () => api.getCareNotes(householdId, { cat_id: cat.id }),
    enabled: isExporting,
    staleTime: 5 * 60 * 1000,
  })

  const allLoaded =
    isExporting &&
    statsQuery.isSuccess &&
    medQuery.isSuccess &&
    vetQuery.isSuccess &&
    notesQuery.isSuccess

  // Trigger PDF generation once all data arrives
  if (allLoaded) {
    const stats: CatStats                = (statsQuery.data as any).data.data
    const medicationEvents: CareEvent[]  = (medQuery.data as any).data.data
    const vetVisitEvents: CareEvent[]    = (vetQuery.data as any).data.data
    const careNotes: CareNote[]          = (notesQuery.data as any).data.data

    const summaryData = assembleVetSummary(cat, stats, medicationEvents, vetVisitEvents, careNotes)

    pdf(<VetSummaryDocument data={summaryData} />)
      .toBlob()
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = `${cat.name.replace(/\s+/g, '_')}_vet_summary.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
        notify.success('PDF downloaded')
      })
      .catch(() => {
        setIsExporting(false)
        notify.error('Failed to generate PDF')
      })
  }

  // Surface any query error
  const hasError = isExporting && (
    statsQuery.isError || medQuery.isError || vetQuery.isError || notesQuery.isError
  )
  if (hasError && isExporting) {
    setIsExporting(false)
    notify.error('Failed to load data for export')
  }

  function handleClick() {
    if (!allowed) {
      const hint = tier === 'free'
        ? 'Upgrade to Pro or Premium to export vet visit summaries.'
        : 'Upgrade to Premium to export 90-day summaries.'
      notify.error(hint)
      return
    }
    setIsExporting(true)
  }

  const loading = isExporting && !allLoaded

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl ring-1 ring-border/60 bg-card hover:bg-muted/50 transition-colors disabled:opacity-60"
      title={!allowed ? (tier === 'free' ? 'Upgrade to export PDFs' : 'Upgrade to Premium for 90-day export') : 'Export vet visit summary as PDF'}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : !allowed ? (
        <Lock className="size-3.5" />
      ) : (
        <FileDown className="size-3.5" />
      )}
      {loading ? 'Generating…' : 'Export PDF'}
    </button>
  )
}
