import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import { api } from '@/api/client'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, ChevronRight, ChevronLeft,
  CheckCircle2, XCircle, AlertCircle, FileSpreadsheet,
} from 'lucide-react'
import type { Cat, ImportCareEventRow, ImportResult } from '@/types/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'feeding', 'litter', 'water', 'weight', 'note',
  'medication', 'vet_visit', 'grooming', 'symptom', 'tooth_brushing',
] as const

type KnownEventType = typeof EVENT_TYPES[number]

const EVENT_TYPE_LABELS: Record<KnownEventType, string> = {
  feeding: 'Feeding',
  litter: 'Litter',
  water: 'Water',
  weight: 'Weight',
  note: 'Note',
  medication: 'Medication',
  vet_visit: 'Vet Visit',
  grooming: 'Grooming',
  symptom: 'Symptom',
  tooth_brushing: 'Tooth Brushing',
}

// Detail field definitions per event type — only shown when that type is present
const DETAIL_FIELDS: Partial<Record<KnownEventType, {
  key: string
  label: string
  required: boolean
  fixedOptions?: string[]
}[]>> = {
  weight: [
    { key: 'weight_value', label: 'Weight value (number)', required: true },
    { key: 'weight_unit', label: 'Weight unit', required: false, fixedOptions: ['kg', 'g'] },
  ],
  feeding: [
    { key: 'food_type', label: 'Food type', required: false, fixedOptions: ['wet', 'dry', 'treats', 'other'] },
    { key: 'amount_grams', label: 'Amount', required: false },
    { key: 'unit', label: 'Unit (grams, packs, etc.)', required: false },
  ],
  medication: [
    { key: 'medication_name', label: 'Medication name', required: true },
    { key: 'dosage', label: 'Dosage', required: false },
    { key: 'unit', label: 'Unit', required: false, fixedOptions: ['mg', 'ml', 'tablet'] },
  ],
  vet_visit: [
    { key: 'reason', label: 'Reason', required: false },
    { key: 'vet_name', label: 'Vet name', required: false },
  ],
  grooming: [
    { key: 'grooming_type', label: 'Grooming type', required: false, fixedOptions: ['bath', 'nail_trim', 'full_groom', 'other'] },
  ],
  symptom: [
    { key: 'symptom_type', label: 'Symptom type', required: false },
    { key: 'severity', label: 'Severity', required: false, fixedOptions: ['mild', 'moderate', 'severe'] },
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RawRow = Record<string, string | number | null | undefined>

// Maps a detail field key to either a spreadsheet column name or a fixed literal value
type DetailMapping =
  | { mode: 'column'; column: string }
  | { mode: 'fixed'; value: string }

interface ColumnMapping {
  catColumn: string           // spreadsheet column → cat name
  eventTypeColumn: string     // spreadsheet column → event type string OR
  eventTypeFixed: string      // fixed event type applied to all rows (if column not used)
  eventTypeMode: 'column' | 'fixed'
  dateColumn: string          // spreadsheet column → occurred_at
  notesColumn: string         // spreadsheet column → notes (optional)
  // Maps each detail field to its source
  detailMappings: Record<string, DetailMapping>
}

// Maps each raw event type string found in the file to a known CatCare type
type TypeMap = Record<string, KnownEventType | ''>

interface PreviewRow {
  rowIndex: number           // 1-based for display
  catName: string
  catId: number | null
  eventType: KnownEventType | null
  occurredAt: string | null
  notes: string | null
  details: Record<string, unknown>
  errors: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null
  // Excel serial number (numeric)
  if (typeof raw === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
    if (isNaN(date.getTime())) return null
    return date.toISOString()
  }
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function cellStr(row: RawRow, col: string): string {
  const v = row[col]
  if (v == null) return ''
  return String(v).trim()
}

// ─── Step components ─────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: number }) {
  const steps = ['Upload', 'Map', 'Preview', 'Import']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors
              ${done ? 'bg-green-500 text-white' : active ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {done ? <CheckCircle2 className="size-4" /> : n}
            </div>
            <span className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {i < steps.length - 1 && <ChevronRight className="size-4 text-muted-foreground/40 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminImportPage() {
  usePageTitle('Import Data')
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [rows, setRows] = useState<RawRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [fileName, setFileName] = useState('')

  // Load existing cats for name reconciliation
  const householdsQuery = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
  })
  const primaryHousehold = householdsQuery.data?.data?.data?.[0]

  const catsQuery = useQuery({
    queryKey: ['cats', primaryHousehold?.id],
    queryFn: () => api.getCats(primaryHousehold!.id),
    enabled: !!primaryHousehold?.id,
  })
  const cats: Cat[] = catsQuery.data?.data?.data ?? []

  // ── Mapping state ──────────────────────────────────────────────────────────
  const [mapping, setMapping] = useState<ColumnMapping>({
    catColumn: '',
    eventTypeColumn: '',
    eventTypeFixed: 'feeding',
    eventTypeMode: 'column',
    dateColumn: '',
    notesColumn: '',
    detailMappings: {},
  })

  // typeMap: raw string in file → CatCare event type
  const [typeMap, setTypeMap] = useState<TypeMap>({})

  // catMap: raw cat name in file → cat id (null = skip)
  const [catMap, setCatMap] = useState<Record<string, number | null>>({})

  // detailValueMaps: for detail fields with fixedOptions mapped from a column,
  // transforms raw spreadsheet values → CatCare values (e.g. "Trauma" → "treats")
  const [detailValueMaps, setDetailValueMaps] = useState<Record<string, Record<string, string>>>({})

  // dateOnly: when true, strip the time from DateAdded and use midnight UTC
  const [dateOnly, setDateOnly] = useState(false)

  // ── Import result + progress state ────────────────────────────────────────
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState<{ sent: number; total: number } | null>(null)

  // ── Step 1: Upload ─────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const workbook = xlsxRead(data, { type: 'binary', cellDates: false })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const parsed: RawRow[] = xlsxUtils.sheet_to_json(sheet, { defval: null })
      if (parsed.length === 0) return
      const cols = Object.keys(parsed[0])
      setRows(parsed)
      setColumns(cols)
      setFileName(file.name)
      // Reset downstream state
      setMapping({
        catColumn: cols[0] ?? '',
        eventTypeColumn: '',
        eventTypeFixed: 'feeding',
        eventTypeMode: 'fixed',
        dateColumn: cols[2] ?? '',
        notesColumn: '',
        detailMappings: {},
      })
      setTypeMap({})
      setCatMap({})
      setDetailValueMaps({})
      setDateOnly(false)
      setImportResult(null)
      setStep(2)
    }
    reader.readAsBinaryString(file)
  }, [])

  // ── Step 2: Derive unique raw type values when mapping changes ─────────────
  const rawTypeValues: string[] = (() => {
    if (mapping.eventTypeMode !== 'column' || !mapping.eventTypeColumn) return []
    const vals = new Set<string>()
    for (const row of rows) {
      const v = cellStr(row, mapping.eventTypeColumn)
      if (v) vals.add(v)
    }
    return Array.from(vals).sort()
  })()

  const rawCatNames: string[] = (() => {
    if (!mapping.catColumn) return []
    const vals = new Set<string>()
    for (const row of rows) {
      const v = cellStr(row, mapping.catColumn)
      if (v) vals.add(v)
    }
    return Array.from(vals).sort()
  })()

  // Auto-match cat names on first render of step 2
  const autoMatchCats = useCallback(() => {
    const map: Record<string, number | null> = {}
    for (const name of rawCatNames) {
      const match = cats.find(c => c.name.toLowerCase() === name.toLowerCase())
      map[name] = match?.id ?? null
    }
    setCatMap(map)
  }, [rawCatNames, cats]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 3: Build preview rows ─────────────────────────────────────────────
  const previewRows: PreviewRow[] = (() => {
    if (step < 3) return []
    return rows.map((row, i) => {
      const errors: string[] = []

      // Cat
      const rawCatName = cellStr(row, mapping.catColumn)
      const catId = catMap[rawCatName] ?? null
      if (!catId) errors.push('Cat not matched')

      // Event type
      let eventType: KnownEventType | null = null
      if (mapping.eventTypeMode === 'fixed') {
        eventType = mapping.eventTypeFixed as KnownEventType
      } else {
        const rawType = cellStr(row, mapping.eventTypeColumn)
        const mapped = typeMap[rawType]
        eventType = mapped || null
        if (!eventType) errors.push(`Unknown event type: "${rawType}"`)
      }

      // Date
      const rawDate = row[mapping.dateColumn]
      let occurredAt = parseDate(rawDate as string | number | null)
      if (occurredAt && dateOnly) {
        const d = new Date(occurredAt)
        occurredAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
      }
      if (!occurredAt) errors.push('Invalid or missing date')

      // Notes
      const notes = mapping.notesColumn ? cellStr(row, mapping.notesColumn) || null : null

      // Details
      const details: Record<string, unknown> = {}
      if (eventType) {
        const fieldDefs = DETAIL_FIELDS[eventType] ?? []
        for (const fieldDef of fieldDefs) {
          const dm = mapping.detailMappings[fieldDef.key]
          if (!dm) continue
          if (dm.mode === 'fixed') {
            if (dm.value) details[fieldDef.key] = dm.value
          } else if (dm.mode === 'column' && dm.column) {
            const v = cellStr(row, dm.column)
            if (v) {
              // Apply value transform if one exists for this field (e.g. "Trauma" → "treats")
              const transform = detailValueMaps[fieldDef.key]
              const transformed = transform?.[v] ?? v
              const numericKeys = ['weight_value', 'amount_grams']
              details[fieldDef.key] = numericKeys.includes(fieldDef.key) ? Number(transformed) : transformed
            }
          }
        }
      }

      return {
        rowIndex: i + 1,
        catName: rawCatName,
        catId,
        eventType,
        occurredAt,
        notes,
        details,
        errors,
      }
    })
  })()

  const validRows = previewRows.filter(r => r.errors.length === 0)
  const invalidRows = previewRows.filter(r => r.errors.length > 0)

  // ── Step 4: Import mutation (batched, 500 rows per request) ───────────────
  const BATCH_SIZE = 500

  const importMutation = useMutation({
    mutationFn: async () => {
      const payload: ImportCareEventRow[] = validRows.map(r => ({
        cat_id: r.catId!,
        event_type: r.eventType!,
        occurred_at: r.occurredAt!,
        notes: r.notes,
        details: r.details,
      }))

      const total = payload.length
      let sent = 0
      let imported = 0
      const failed: { row: number; error: string }[] = []

      setImportProgress({ sent: 0, total })

      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE)
        // row offset so server-side row numbers stay meaningful across batches
        const res = await api.adminImportCareEvents(batch)
        const result: ImportResult = res.data
        imported += result.imported
        // adjust row numbers relative to the full dataset
        failed.push(...result.failed.map(f => ({ ...f, row: f.row + i })))
        sent = Math.min(i + BATCH_SIZE, total)
        setImportProgress({ sent, total })
      }

      return { imported, failed }
    },
    onSuccess: (result) => {
      setImportResult(result)
      setImportProgress(null)
      setStep(4)
    },
    onError: () => {
      setImportResult(null)
      setImportProgress(null)
    },
  })

  // ── Column select helper ───────────────────────────────────────────────────
  const colOptions = (includeBlank = true) => (
    <>
      {includeBlank && <option value="">(none)</option>}
      {columns.map(c => <option key={c} value={c}>{c}</option>)}
    </>
  )

  // ── Which event types are present (for showing detail mappers) ─────────────
  const presentEventTypes: KnownEventType[] = (() => {
    if (mapping.eventTypeMode === 'fixed') {
      return [mapping.eventTypeFixed as KnownEventType]
    }
    return Array.from(new Set(
      Object.entries(typeMap)
        .filter(([, v]) => v && EVENT_TYPES.includes(v as KnownEventType))
        .map(([, v]) => v as KnownEventType)
    ))
  })()

  const detailTypesWithFields = presentEventTypes.filter(t => (DETAIL_FIELDS[t]?.length ?? 0) > 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Admin
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-6 text-amber-500" />
            Import Historical Data
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a spreadsheet from your old pet care app and map columns to CatCare fields.
          </p>
        </div>

        <StepIndicator step={step} current={step} />

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div
            className="border-2 border-dashed border-border rounded-2xl p-16 text-center cursor-pointer hover:border-amber-400 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.xlsx,.xls'
              input.onchange = () => { if (input.files?.[0]) handleFile(input.files[0]) }
              input.click()
            }}
          >
            <Upload className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-base font-medium">Drop your spreadsheet here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">.xlsx or .xls — first sheet only</p>
          </div>
        )}

        {/* ── Step 2: Map columns ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <h2 className="font-semibold text-base">Required fields</h2>

              {/* Cat column */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <label className="text-sm font-medium">Cat name column <span className="text-destructive">*</span></label>
                <select
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  value={mapping.catColumn}
                  onChange={e => {
                    setMapping(m => ({ ...m, catColumn: e.target.value }))
                    setCatMap({})
                  }}
                >
                  {colOptions(false)}
                </select>
              </div>

              {/* Event type: column or fixed */}
              <div className="grid grid-cols-2 gap-4 items-start">
                <label className="text-sm font-medium pt-2">Event type <span className="text-destructive">*</span></label>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="etMode" value="column" checked={mapping.eventTypeMode === 'column'}
                        onChange={() => setMapping(m => ({ ...m, eventTypeMode: 'column' }))} />
                      From column
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="etMode" value="fixed" checked={mapping.eventTypeMode === 'fixed'}
                        onChange={() => setMapping(m => ({ ...m, eventTypeMode: 'fixed' }))} />
                      All same type
                    </label>
                  </div>
                  {mapping.eventTypeMode === 'column' ? (
                    <select
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      value={mapping.eventTypeColumn}
                      onChange={e => {
                        setMapping(m => ({ ...m, eventTypeColumn: e.target.value }))
                        setTypeMap({})
                      }}
                    >
                      {colOptions(false)}
                    </select>
                  ) : (
                    <select
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      value={mapping.eventTypeFixed}
                      onChange={e => setMapping(m => ({ ...m, eventTypeFixed: e.target.value }))}
                    >
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Date column */}
              <div className="grid grid-cols-2 gap-4 items-start">
                <label className="text-sm font-medium pt-2">Date / time column <span className="text-destructive">*</span></label>
                <div className="space-y-2">
                  <select
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    value={mapping.dateColumn}
                    onChange={e => setMapping(m => ({ ...m, dateColumn: e.target.value }))}
                  >
                    {colOptions(false)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dateOnly}
                      onChange={e => setDateOnly(e.target.checked)}
                      className="rounded"
                    />
                    Date only — strip time, use midnight UTC
                  </label>
                </div>
              </div>

              {/* Notes column (optional) */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <label className="text-sm font-medium">Notes column <span className="text-muted-foreground text-xs">(optional)</span></label>
                <select
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                  value={mapping.notesColumn}
                  onChange={e => setMapping(m => ({ ...m, notesColumn: e.target.value }))}
                >
                  {colOptions(true)}
                </select>
              </div>
            </div>

            {/* Cat name reconciliation */}
            {mapping.catColumn && rawCatNames.length > 0 && (
              <div className="rounded-2xl border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-base">Match cat names</h2>
                  <button
                    className="text-xs text-amber-600 dark:text-amber-400 underline underline-offset-2"
                    onClick={autoMatchCats}
                  >
                    Auto-match by name
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">We found these names in your file. Match each to an existing cat, or skip it.</p>
                <div className="space-y-2">
                  {rawCatNames.map(name => (
                    <div key={name} className="grid grid-cols-2 gap-4 items-center">
                      <span className="text-sm font-mono bg-muted rounded px-2 py-1">{name}</span>
                      <select
                        className="rounded-lg border bg-background px-3 py-2 text-sm"
                        value={catMap[name] ?? ''}
                        onChange={e => setCatMap(m => ({ ...m, [name]: e.target.value ? Number(e.target.value) : null }))}
                      >
                        <option value="">(skip this cat)</option>
                        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event type mapping (if column mode) */}
            {mapping.eventTypeMode === 'column' && rawTypeValues.length > 0 && (
              <div className="rounded-2xl border bg-card p-6 space-y-4">
                <h2 className="font-semibold text-base">Map event types</h2>
                <p className="text-xs text-muted-foreground">Match each value from your file to a CatCare event type.</p>
                <div className="space-y-2">
                  {rawTypeValues.map(raw => (
                    <div key={raw} className="grid grid-cols-2 gap-4 items-center">
                      <span className="text-sm font-mono bg-muted rounded px-2 py-1">{raw}</span>
                      <select
                        className="rounded-lg border bg-background px-3 py-2 text-sm"
                        value={typeMap[raw] ?? ''}
                        onChange={e => setTypeMap(m => ({ ...m, [raw]: e.target.value as KnownEventType | '' }))}
                      >
                        <option value="">(skip)</option>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detail field mappings */}
            {detailTypesWithFields.length > 0 && (
              <div className="rounded-2xl border bg-card p-6 space-y-5">
                <h2 className="font-semibold text-base">Map detail fields <span className="text-muted-foreground text-xs font-normal">(optional)</span></h2>
                {detailTypesWithFields.map(eventType => (
                  <div key={eventType} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{EVENT_TYPE_LABELS[eventType]}</p>
                    {(DETAIL_FIELDS[eventType] ?? []).map(fieldDef => {
                      const dm = mapping.detailMappings[fieldDef.key]
                      const mode = dm?.mode ?? 'column'
                      return (
                        <div key={fieldDef.key} className="grid grid-cols-2 gap-4 items-start">
                          <label className="text-sm pt-2">
                            {fieldDef.label}
                            {fieldDef.required && <span className="text-destructive ml-1">*</span>}
                          </label>
                          <div className="space-y-1.5">
                            {fieldDef.fixedOptions && (
                              <div className="flex gap-3 text-xs mb-1">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="radio" name={`dm_mode_${fieldDef.key}`} value="column"
                                    checked={mode === 'column'}
                                    onChange={() => setMapping(m => ({
                                      ...m,
                                      detailMappings: { ...m.detailMappings, [fieldDef.key]: { mode: 'column', column: '' } }
                                    }))} />
                                  From column
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="radio" name={`dm_mode_${fieldDef.key}`} value="fixed"
                                    checked={mode === 'fixed'}
                                    onChange={() => setMapping(m => ({
                                      ...m,
                                      detailMappings: { ...m.detailMappings, [fieldDef.key]: { mode: 'fixed', value: fieldDef.fixedOptions![0] } }
                                    }))} />
                                  Fixed value
                                </label>
                              </div>
                            )}
                            {mode === 'column' || !fieldDef.fixedOptions ? (
                              <>
                                <select
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                  value={(dm?.mode === 'column' ? dm.column : '') ?? ''}
                                  onChange={e => setMapping(m => ({
                                    ...m,
                                    detailMappings: { ...m.detailMappings, [fieldDef.key]: { mode: 'column', column: e.target.value } }
                                  }))}
                                >
                                  {colOptions(true)}
                                </select>
                                {/* Value transform: shown when this field has fixedOptions and a column is selected */}
                                {fieldDef.fixedOptions && dm?.mode === 'column' && dm.column && (() => {
                                  const rawVals = Array.from(new Set(
                                    rows.map(r => cellStr(r, dm.column)).filter(Boolean)
                                  )).sort()
                                  if (rawVals.length === 0) return null
                                  return (
                                    <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-1.5">
                                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Map values</p>
                                      {rawVals.map(raw => (
                                        <div key={raw} className="flex items-center gap-2">
                                          <span className="text-xs font-mono bg-background border rounded px-1.5 py-0.5 shrink-0">{raw}</span>
                                          <span className="text-muted-foreground text-xs">→</span>
                                          <select
                                            className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                                            value={detailValueMaps[fieldDef.key]?.[raw] ?? raw.toLowerCase()}
                                            onChange={e => setDetailValueMaps(m => ({
                                              ...m,
                                              [fieldDef.key]: { ...(m[fieldDef.key] ?? {}), [raw]: e.target.value }
                                            }))}
                                          >
                                            {fieldDef.fixedOptions!.map(o => <option key={o} value={o}>{o}</option>)}
                                          </select>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </>
                            ) : (
                              <select
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                value={(dm?.mode === 'fixed' ? dm.value : '') ?? ''}
                                onChange={e => setMapping(m => ({
                                  ...m,
                                  detailMappings: { ...m.detailMappings, [fieldDef.key]: { mode: 'fixed', value: e.target.value } }
                                }))}
                              >
                                {fieldDef.fixedOptions?.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <button
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                disabled={!mapping.catColumn || !mapping.dateColumn}
                onClick={() => {
                  autoMatchCats()
                  setStep(3)
                }}
              >
                Preview <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold">
                <CheckCircle2 className="size-4" /> {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-semibold">
                  <XCircle className="size-4" /> {invalidRows.length} will be skipped
                </span>
              )}
            </div>

            {invalidRows.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-4" /> Rows with errors (will be skipped)
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {invalidRows.map(r => (
                    <p key={r.rowIndex} className="text-xs text-destructive">
                      Row {r.rowIndex}: {r.errors.join(' · ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Cat</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Notes</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 50).map(r => (
                    <tr key={r.rowIndex} className={`border-b last:border-0 ${r.errors.length > 0 ? 'bg-destructive/5 opacity-60' : ''}`}>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.rowIndex}</td>
                      <td className="px-4 py-2.5 font-medium">{r.catName || '—'}</td>
                      <td className="px-4 py-2.5 capitalize">{r.eventType ? EVENT_TYPE_LABELS[r.eventType] : '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {r.occurredAt ? new Date(r.occurredAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[160px] truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-2.5">
                        {r.errors.length === 0
                          ? <CheckCircle2 className="size-4 text-green-500" />
                          : <XCircle className="size-4 text-destructive" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-3 border-t">
                  Showing first 50 of {previewRows.length} rows
                </p>
              )}
            </div>

            {importProgress && (
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <svg className="animate-spin size-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Importing…
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {importProgress.sent.toLocaleString()} / {importProgress.total.toLocaleString()} events
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${Math.round((importProgress.sent / importProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((importProgress.sent / importProgress.total) * 100)}% complete — do not close this tab
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                disabled={importMutation.isPending}
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <button
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
                disabled={validRows.length === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? 'Working…' : `Import ${validRows.length} events`}
                {!importMutation.isPending && <ChevronRight className="size-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Result ──────────────────────────────────────────────── */}
        {step === 4 && importResult && (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
              <CheckCircle2 className="size-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold">{importResult.imported} events imported</h2>
              {importResult.failed.length > 0 && (
                <p className="text-sm text-muted-foreground">{importResult.failed.length} rows failed on the server.</p>
              )}
            </div>

            {importResult.failed.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">Server-side failures</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {importResult.failed.map(f => (
                    <p key={f.row} className="text-xs text-destructive">Row {f.row}: {f.error}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="px-5 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => { setStep(1); setRows([]); setColumns([]); setFileName(''); setImportResult(null) }}
              >
                Import another file
              </button>
              <button
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* File info pill */}
        {fileName && step > 1 && step < 4 && (
          <p className="mt-6 text-xs text-muted-foreground flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" /> {fileName} — {rows.length} rows
          </p>
        )}
      </div>
    </div>
  )
}
