import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { VetSummaryData } from '@/lib/vetExport'
import { formatDateRange } from '@/lib/vetExport'

// ─── Styles ───────────────────────────────────────────────────────────────────
// @react-pdf/renderer uses its own layout engine (not CSS/Tailwind).
// All styling must go through StyleSheet.create().

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    paddingHorizontal: 40,
    paddingVertical: 40,
    lineHeight: 1.4,
  },
  // Cover
  coverTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  coverMeta: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  // Section
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Two-column profile grid
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  profileCell: {
    width: '48%',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 3,
  },
  profileLabel: {
    fontSize: 9,
    color: '#6b7280',
    width: 80,
  },
  profileValue: {
    fontSize: 9,
    flex: 1,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    fontSize: 9,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Weight table col widths
  colDate: { width: '22%' },
  colWeight: { width: '20%' },
  // Medication col widths
  colMedDate: { width: '18%' },
  colMedName: { width: '30%' },
  colMedDose: { width: '20%' },
  colMedNotes: { width: '32%' },
  // Vet visit col widths
  colVetDate: { width: '16%' },
  colVetReason: { width: '28%' },
  colVetName: { width: '28%' },
  colVetNotes: { width: '28%' },
  // Event summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  // Care notes
  noteItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  noteTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  noteBody: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  // Empty state
  empty: {
    fontSize: 9,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  feeding: 'Feeding', litter: 'Litter', water: 'Water', weight: 'Weight',
  note: 'Note', medication: 'Medication', vet_visit: 'Vet Visit', grooming: 'Grooming',
  symptom: 'Symptom', tooth_brushing: 'Toothbrushing',
}

const SEVERITY_LABELS: Record<string, string> = {
  mild: 'Mild', moderate: 'Moderate', severe: 'Severe',
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function VetSummaryDocument({ data }: { data: VetSummaryData }) {
  const { cat, stats, medicationRows, vetVisitRows, careNotes, generatedAt } = data

  const birthday = cat.birthday
    ? new Date(cat.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const profileFields: Array<[string, string | null]> = [
    ['Species',   cat.species],
    ['Sex',       cat.sex === 'unknown' ? null : cat.sex],
    ['Breed',     cat.breed],
    ['Birthday',  birthday],
    ['Microchip', cat.microchip_number],
    ['Spayed/Neutered', cat.sterilized ? 'Yes' : 'No'],
    ['Vet',       [cat.vet_name, cat.vet_clinic].filter(Boolean).join(' · ') || null],
    ['Vet phone', cat.vet_phone],
  ].filter(([, v]) => !!v) as Array<[string, string]>

  const hasWeightData    = stats.weight_series.length > 0
  const hasMedications   = medicationRows.length > 0
  const hasVetVisits     = vetVisitRows.length > 0
  const hasCareNotes     = careNotes.length > 0
  const hasSymptoms      = stats.symptom_series.length > 0
  const eventTypesUsed   = Object.entries(stats.by_type).filter(([, v]) => (v ?? 0) > 0)

  return (
    <Document
      title={`${cat.name} – Vet Visit Summary`}
      author="CatCare"
      subject={`Care history ${formatDateRange(stats)}`}
    >
      <Page size="A4" style={S.page}>

        {/* ── Cover ── */}
        <Text style={S.coverTitle}>{cat.name}</Text>
        <Text style={S.coverSubtitle}>Vet Visit Summary · {formatDateRange(stats)}</Text>
        {cat.health_conditions.length > 0 && (
          <Text style={S.coverSubtitle}>
            Known conditions: {cat.health_conditions.join(', ')}
          </Text>
        )}
        <Text style={S.coverMeta}>
          Generated {new Date(generatedAt).toLocaleString()} · CatCare
        </Text>

        {/* ── Cat profile ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Patient Profile</Text>
          <View style={S.profileGrid}>
            {profileFields.map(([label, value]) => (
              <View key={label} style={S.profileCell}>
                <Text style={S.profileLabel}>{label}</Text>
                <Text style={S.profileValue}>{value}</Text>
              </View>
            ))}
          </View>
          {cat.health_notes && (
            <View style={{ marginTop: 6 }}>
              <Text style={S.profileLabel}>Health notes</Text>
              <Text style={{ ...S.tableCell, marginTop: 2 }}>{cat.health_notes}</Text>
            </View>
          )}
        </View>

        {/* ── Weight history ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Weight History</Text>
          {!hasWeightData ? (
            <Text style={S.empty}>No weight measurements in this period.</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={{ ...S.tableHeaderCell, ...S.colDate }}>Date</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colWeight }}>Weight</Text>
              </View>
              {stats.weight_series.map((pt, i) => (
                <View key={i} style={S.tableRow}>
                  <Text style={{ ...S.tableCell, ...S.colDate }}>
                    {new Date(pt.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={{ ...S.tableCell, ...S.colWeight }}>
                    {pt.value} {pt.unit}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Medication history ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Medication History</Text>
          {!hasMedications ? (
            <Text style={S.empty}>No medications logged in this period.</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={{ ...S.tableHeaderCell, ...S.colMedDate }}>Date</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colMedName }}>Medication</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colMedDose }}>Dose</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colMedNotes }}>Notes</Text>
              </View>
              {medicationRows.map((row, i) => (
                <View key={i} style={S.tableRow}>
                  <Text style={{ ...S.tableCell, ...S.colMedDate }}>{row.date}</Text>
                  <Text style={{ ...S.tableCell, ...S.colMedName }}>{row.name}</Text>
                  <Text style={{ ...S.tableCell, ...S.colMedDose }}>
                    {row.dosage} {row.unit}
                  </Text>
                  <Text style={{ ...S.tableCell, ...S.colMedNotes }}>
                    {row.notes ?? '—'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Vet visits ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Vet Visits</Text>
          {!hasVetVisits ? (
            <Text style={S.empty}>No vet visits logged in this period.</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={{ ...S.tableHeaderCell, ...S.colVetDate }}>Date</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colVetReason }}>Reason</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colVetName }}>Vet / Clinic</Text>
                <Text style={{ ...S.tableHeaderCell, ...S.colVetNotes }}>Notes</Text>
              </View>
              {vetVisitRows.map((row, i) => (
                <View key={i} style={S.tableRow}>
                  <Text style={{ ...S.tableCell, ...S.colVetDate }}>{row.date}</Text>
                  <Text style={{ ...S.tableCell, ...S.colVetReason }}>{row.reason}</Text>
                  <Text style={{ ...S.tableCell, ...S.colVetName }}>
                    {[row.vet_name, row.vet_clinic].filter((v) => v && v !== '—').join(' · ') || '—'}
                  </Text>
                  <Text style={{ ...S.tableCell, ...S.colVetNotes }}>
                    {row.notes ?? '—'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Symptoms ── */}
        {hasSymptoms && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Symptoms Logged</Text>
            <View style={S.tableHeader}>
              <Text style={{ ...S.tableHeaderCell, ...S.colDate }}>Date</Text>
              <Text style={{ ...S.tableHeaderCell, width: '30%' }}>Symptom</Text>
              <Text style={{ ...S.tableHeaderCell, width: '20%' }}>Severity</Text>
              <Text style={{ ...S.tableHeaderCell, width: '28%' }}>Duration</Text>
            </View>
            {stats.symptom_series.map((s, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={{ ...S.tableCell, ...S.colDate }}>
                  {new Date(s.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ ...S.tableCell, width: '30%' }}>
                  {s.symptom_type?.replace(/_/g, ' ') ?? '—'}
                </Text>
                <Text style={{ ...S.tableCell, width: '20%' }}>
                  {s.severity ? SEVERITY_LABELS[s.severity] ?? s.severity : '—'}
                </Text>
                <Text style={{ ...S.tableCell, width: '28%' }}>
                  {s.duration_minutes ? `${s.duration_minutes} min` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Care summary ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Care Summary ({formatDateRange(stats)})</Text>
          <View style={{ ...S.summaryRow, borderBottomWidth: 0, paddingBottom: 0 }}>
            <Text style={{ ...S.tableHeaderCell, width: '60%' }}>Event type</Text>
            <Text style={{ ...S.tableHeaderCell, width: '40%' }}>Count</Text>
          </View>
          {eventTypesUsed.map(([type, count]) => (
            <View key={type} style={S.summaryRow}>
              <Text style={{ ...S.tableCell, width: '60%' }}>
                {EVENT_TYPE_LABELS[type] ?? type}
              </Text>
              <Text style={{ ...S.tableCell, width: '40%' }}>{count}</Text>
            </View>
          ))}
          <View style={{ ...S.summaryRow, borderBottomWidth: 0, marginTop: 4 }}>
            <Text style={{ ...S.tableHeaderCell, width: '60%' }}>Total</Text>
            <Text style={{ ...S.tableHeaderCell, width: '40%' }}>{stats.total_events}</Text>
          </View>
        </View>

        {/* ── Care notes ── */}
        {hasCareNotes && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Care Notes</Text>
            {careNotes.map((note) => (
              <View key={note.id} style={S.noteItem}>
                <Text style={S.noteTitle}>{note.title}</Text>
                <Text style={S.noteBody}>{note.body}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text>{cat.name} – Vet Visit Summary</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
