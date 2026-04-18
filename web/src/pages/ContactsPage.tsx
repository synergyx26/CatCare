import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { notify } from '@/lib/notify'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Phone, Stethoscope, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { Cat, Household } from '@/types/api'

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

// ─── Cat vet row ──────────────────────────────────────────────────────────────

interface CatVetRowProps {
  cat: Cat
  householdId: number
  householdVet: { name: string; clinic: string; phone: string; address: string }
}

function CatVetRow({ cat, householdId, householdVet }: CatVetRowProps) {
  const queryClient = useQueryClient()

  const catHasOwnVet = !!(cat.vet_name || cat.vet_clinic || cat.vet_phone || cat.vet_address)
  const [useOwn, setUseOwn] = useState(catHasOwnVet)
  const [expanded, setExpanded] = useState(catHasOwnVet)
  const [form, setForm] = useState({
    vet_name:    cat.vet_name    ?? '',
    vet_clinic:  cat.vet_clinic  ?? '',
    vet_phone:   cat.vet_phone   ?? '',
    vet_address: cat.vet_address ?? '',
  })

  // Reset local state if the cat prop changes (e.g. after a save)
  useEffect(() => {
    const has = !!(cat.vet_name || cat.vet_clinic || cat.vet_phone || cat.vet_address)
    setUseOwn(has)
    setExpanded(has)
    setForm({
      vet_name:    cat.vet_name    ?? '',
      vet_clinic:  cat.vet_clinic  ?? '',
      vet_phone:   cat.vet_phone   ?? '',
      vet_address: cat.vet_address ?? '',
    })
  }, [cat.id, cat.vet_name, cat.vet_clinic, cat.vet_phone, cat.vet_address])

  const mutation = useMutation({
    mutationFn: (patch: { vet_name: string | null; vet_clinic: string | null; vet_phone: string | null; vet_address: string | null }) =>
      api.updateCatContacts(householdId, cat.id, { cat: patch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cats', householdId] })
      notify.success(`${cat.name}'s vet updated.`)
    },
    onError: () => notify.error('Failed to save.'),
  })

  function handleToggleShared() {
    // Switching to "shared vet" — clear cat's own vet fields immediately
    setUseOwn(false)
    setExpanded(false)
    mutation.mutate({ vet_name: null, vet_clinic: null, vet_phone: null, vet_address: null })
  }

  function handleToggleOwn() {
    // Switching to "own vet" — prefill from household vet as a starting point
    setUseOwn(true)
    setExpanded(true)
    if (!catHasOwnVet) {
      setForm({
        vet_name:    householdVet.name,
        vet_clinic:  householdVet.clinic,
        vet_phone:   householdVet.phone,
        vet_address: householdVet.address,
      })
    }
  }

  function handleSave() {
    mutation.mutate({
      vet_name:    form.vet_name.trim()    || null,
      vet_clinic:  form.vet_clinic.trim()  || null,
      vet_phone:   form.vet_phone.trim()   || null,
      vet_address: form.vet_address.trim() || null,
    })
  }

  const hasHouseholdVet = !!(householdVet.name || householdVet.clinic || householdVet.phone)

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      {/* Cat header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40">
        {cat.photo_url ? (
          <img
            src={cat.photo_url}
            alt={cat.name}
            className="size-8 rounded-lg border border-border/40 object-cover shrink-0"
          />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-sm font-bold">
            {cat.name.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="font-semibold text-sm flex-1">{cat.name}</p>

        {/* Shared / Own toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
          <button
            onClick={useOwn ? handleToggleShared : undefined}
            disabled={mutation.isPending}
            className={[
              'px-3 py-1.5 transition-colors',
              !useOwn
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                : 'text-muted-foreground hover:bg-muted/60',
            ].join(' ')}
          >
            Shared vet
          </button>
          <button
            onClick={!useOwn ? handleToggleOwn : () => setExpanded((v) => !v)}
            disabled={mutation.isPending}
            className={[
              'px-3 py-1.5 border-l border-border transition-colors flex items-center gap-1',
              useOwn
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                : 'text-muted-foreground hover:bg-muted/60',
            ].join(' ')}
          >
            Own vet
            {useOwn && (expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
          </button>
        </div>
      </div>

      {/* Body */}
      {!useOwn && (
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          {hasHouseholdVet
            ? <>Using <span className="font-medium text-foreground">{householdVet.clinic || householdVet.name}</span></>
            : 'No shared vet configured above.'}
        </div>
      )}

      {useOwn && expanded && (
        <div className="px-3 py-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Clinic name" value={form.vet_clinic} onChange={(v) => setForm((f) => ({ ...f, vet_clinic: v }))} placeholder="e.g. Paws & Claws Clinic" />
            <Field label="Vet name" value={form.vet_name} onChange={(v) => setForm((f) => ({ ...f, vet_name: v }))} placeholder="Dr. Smith" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone" value={form.vet_phone} onChange={(v) => setForm((f) => ({ ...f, vet_phone: v }))} placeholder="+1 555 000 0000" type="tel" />
            <Field label="Address" value={form.vet_address} onChange={(v) => setForm((f) => ({ ...f, vet_address: v }))} placeholder="123 Main St" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ContactsPage() {
  usePageTitle('Contacts & Vets')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate        = useNavigate()
  const { user }        = useAuthStore()
  const queryClient     = useQueryClient()
  const hid             = Number(householdId)

  const { data: householdsData } = useQuery({
    queryKey: ['households'],
    queryFn:  () => api.getHouseholds(),
  })
  const households: Household[] = householdsData?.data?.data ?? []
  const household = households.find((h) => h.id === hid) ?? households[0]

  const currentRole = household?.members?.find((m) => m.id === user?.id)?.role ?? null
  useEffect(() => {
    if (householdsData && currentRole && currentRole !== 'admin') {
      navigate('/dashboard', { replace: true })
    }
  }, [householdsData, currentRole, navigate])

  const { data: catsData, isLoading } = useQuery({
    queryKey: ['cats', hid],
    queryFn:  () => api.getCats(hid),
    enabled:  !!hid,
  })
  const cats: Cat[] = (catsData?.data?.data ?? []).filter((c: Cat) => c.active)

  // ── Household vet form ────────────────────────────────────────────────────────

  const [vetForm, setVetForm] = useState({
    vet_name:    '',
    vet_clinic:  '',
    vet_phone:   '',
    vet_address: '',
  })

  useEffect(() => {
    if (household) {
      setVetForm({
        vet_name:    household.vet_name    ?? '',
        vet_clinic:  household.vet_clinic  ?? '',
        vet_phone:   household.vet_phone   ?? '',
        vet_address: household.vet_address ?? '',
      })
    }
  }, [household?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const vetChanged =
    vetForm.vet_name    !== (household?.vet_name    ?? '') ||
    vetForm.vet_clinic  !== (household?.vet_clinic  ?? '') ||
    vetForm.vet_phone   !== (household?.vet_phone   ?? '') ||
    vetForm.vet_address !== (household?.vet_address ?? '')

  const vetMutation = useMutation({
    mutationFn: () => api.updateHousehold(hid, {
      household: {
        vet_name:    vetForm.vet_name.trim()    || null,
        vet_clinic:  vetForm.vet_clinic.trim()  || null,
        vet_phone:   vetForm.vet_phone.trim()   || null,
        vet_address: vetForm.vet_address.trim() || null,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] })
      notify.success('Shared vet saved.')
    },
    onError: () => notify.error('Failed to save vet.'),
  })

  // ── Emergency contact form ────────────────────────────────────────────────────

  const [ecForm, setEcForm] = useState({ name: '', phone: '' })

  useEffect(() => {
    if (household) {
      setEcForm({
        name:  household.emergency_contact_name  ?? '',
        phone: household.emergency_contact_phone ?? '',
      })
    }
  }, [household?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const ecChanged =
    ecForm.name  !== (household?.emergency_contact_name  ?? '') ||
    ecForm.phone !== (household?.emergency_contact_phone ?? '')

  const ecMutation = useMutation({
    mutationFn: () => api.updateHousehold(hid, {
      household: {
        emergency_contact_name:  ecForm.name.trim()  || null,
        emergency_contact_phone: ecForm.phone.trim() || null,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] })
      notify.success('Emergency contact saved.')
    },
    onError: () => notify.error('Failed to save emergency contact.'),
  })

  if (isLoading || !householdsData) return <PageSkeleton />

  // Household vet summary passed to each CatVetRow as a convenience prefill
  const householdVetSummary = {
    name:    household?.vet_name    ?? '',
    clinic:  household?.vet_clinic  ?? '',
    phone:   household?.vet_phone   ?? '',
    address: household?.vet_address ?? '',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Contacts & Vets"
        subtitle="Manage the shared vet, emergency contact, and per-cat vet assignments"
        backTo={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
      />

      {/* ── Shared vet ── */}
      <SectionCard
        icon={<Stethoscope className="size-4" />}
        title="Shared vet"
        subtitle="Used by default for all cats unless overridden below"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Clinic name"
              value={vetForm.vet_clinic}
              onChange={(v) => setVetForm((f) => ({ ...f, vet_clinic: v }))}
              placeholder="e.g. Paws & Claws Clinic"
            />
            <Field
              label="Vet name"
              value={vetForm.vet_name}
              onChange={(v) => setVetForm((f) => ({ ...f, vet_name: v }))}
              placeholder="Dr. Smith"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Phone"
              value={vetForm.vet_phone}
              onChange={(v) => setVetForm((f) => ({ ...f, vet_phone: v }))}
              placeholder="+1 555 000 0000"
              type="tel"
            />
            <Field
              label="Address"
              value={vetForm.vet_address}
              onChange={(v) => setVetForm((f) => ({ ...f, vet_address: v }))}
              placeholder="123 Main St"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => vetMutation.mutate()}
              disabled={!vetChanged || vetMutation.isPending}
            >
              {vetMutation.isPending ? 'Saving…' : 'Save vet'}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Emergency contact ── */}
      <SectionCard
        icon={<AlertTriangle className="size-4" />}
        title="Emergency contact"
        subtitle="Shown to sitters and all household members"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Name"
              value={ecForm.name}
              onChange={(v) => setEcForm((f) => ({ ...f, name: v }))}
              placeholder="Jane Doe"
            />
            <Field
              label="Phone"
              value={ecForm.phone}
              onChange={(v) => setEcForm((f) => ({ ...f, phone: v }))}
              placeholder="+1 555 000 0000"
              type="tel"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => ecMutation.mutate()}
              disabled={!ecChanged || ecMutation.isPending}
            >
              {ecMutation.isPending ? 'Saving…' : 'Save contact'}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Per-cat vet assignments ── */}
      {cats.length > 0 && (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40">
            <div className="mt-0.5 text-muted-foreground">
              <Phone className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Per-cat vet assignments</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                By default each cat uses the shared vet. Switch to "Own vet" to set a different one.
              </p>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3">
            {cats.map((cat) => (
              <CatVetRow
                key={cat.id}
                cat={cat}
                householdId={hid}
                householdVet={householdVetSummary}
              />
            ))}
          </div>
        </div>
      )}

      {cats.length === 0 && (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 p-8 text-center text-sm text-muted-foreground">
          No active cats yet.
        </div>
      )}
    </div>
  )
}
