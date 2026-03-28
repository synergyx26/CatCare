import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { SymptomPoint } from '@/types/api'

const SYMPTOM_LABELS: Record<string, string> = {
  vomiting:      'Vomiting',
  coughing:      'Coughing',
  asthma_attack: 'Breathing issue',
  sneezing:      'Sneezing',
  diarrhea:      'Diarrhea',
  lethargy:      'Lethargy',
  not_eating:    'Not eating',
  limping:       'Limping',
  eye_discharge: 'Eye discharge',
  seizure:       'Seizure',
  other:         'Other',
}

const SEVERITY_VALUE: Record<string, number> = {
  mild:     1,
  moderate: 2,
  severe:   3,
}

const SEVERITY_COLOR: Record<number, string> = {
  1: '#fbbf24', // mild — amber
  2: '#f97316', // moderate — orange
  3: '#dc2626', // severe — red
}

interface ChartPoint {
  x: number
  y: number
  label: string
  symptom_type: string | null
  severity: string | null
  duration_minutes: number | null
}

interface Props {
  data: SymptomPoint[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: ChartPoint = payload[0].payload
  const severityLabel = d.severity
    ? d.severity.charAt(0).toUpperCase() + d.severity.slice(1)
    : null

  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ fontWeight: 600, color: 'var(--color-foreground)', marginBottom: 2 }}>
        {SYMPTOM_LABELS[d.symptom_type ?? ''] ?? d.symptom_type ?? 'Symptom'}
      </p>
      {severityLabel && (
        <p style={{ color: 'var(--color-muted-foreground)' }}>
          Severity: {severityLabel}
        </p>
      )}
      {d.duration_minutes != null && (
        <p style={{ color: 'var(--color-muted-foreground)' }}>
          Duration: {d.duration_minutes} min
        </p>
      )}
      <p style={{ color: 'var(--color-muted-foreground)', marginTop: 2 }}>{d.label}</p>
    </div>
  )
}

export function SymptomLogChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
        No symptoms logged in this period
      </div>
    )
  }

  const points: ChartPoint[] = data.map((p) => ({
    x:                new Date(p.occurred_at).getTime(),
    y:                SEVERITY_VALUE[p.severity ?? 'mild'] ?? 1,
    label:            new Date(p.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    symptom_type:     p.symptom_type,
    severity:         p.severity,
    duration_minutes: p.duration_minutes,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={[0.5, 3.5]}
          ticks={[1, 2, 3]}
          tickFormatter={(v) => ['', 'Mild', 'Moderate', 'Severe'][v] ?? ''}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={68}
        />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={points} shape="circle">
          {points.map((entry, index) => (
            <Cell
              key={index}
              fill={SEVERITY_COLOR[entry.y] ?? '#f97316'}
              opacity={0.88}
              r={entry.y === 3 ? 9 : entry.y === 2 ? 7 : 6}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
