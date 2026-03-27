import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { FeedingDayStat } from '@/types/api'

interface Props {
  data: FeedingDayStat[]
}

const FOOD_COLORS: Record<string, string> = {
  wet:    '#38bdf8',
  dry:    '#fb923c',
  treats: '#f472b6',
  other:  '#94a3b8',
}

const FOOD_LABELS: Record<string, string> = {
  wet:    'Wet',
  dry:    'Dry / Kibble',
  treats: 'Treats',
  other:  'Other',
}

// Only include a food type in the legend/chart if it has any data at all
function activeTypes(data: FeedingDayStat[]): Array<keyof FeedingDayStat> {
  const keys: Array<keyof FeedingDayStat> = ['wet', 'dry', 'treats', 'other']
  return keys.filter((k) => data.some((d) => (d[k] as number) > 0))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((p: { value: number }) => p.value > 0)
  const total = entries.reduce((sum: number, p: { value: number }) => sum + p.value, 0)

  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        fontSize: '12px',
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        minWidth: '140px',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-foreground)' }}>
        {label}
      </p>
      {entries.map((p: { name: string; value: number; fill: string }) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-muted-foreground)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block' }} />
            {FOOD_LABELS[p.name] ?? p.name}
          </span>
          <span style={{ fontWeight: 500, color: 'var(--color-foreground)' }}>
            {p.value % 1 === 0 ? p.value : p.value.toFixed(1)}g
          </span>
        </div>
      ))}
      {entries.length > 1 && (
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 12,
            marginTop: 6, paddingTop: 6,
            borderTop: '1px solid var(--color-border)',
            fontWeight: 600, color: 'var(--color-foreground)',
          }}
        >
          <span>Total</span>
          <span>{total % 1 === 0 ? total : total.toFixed(1)}g</span>
        </div>
      )}
    </div>
  )
}

export function DailyFoodIntakeChart({ data }: Props) {
  const types = activeTypes(data)

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={data.length > 14 ? 'preserveStartEnd' : 0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `${v}g`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.35 }} />
        <Legend
          iconType="square"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
              {FOOD_LABELS[value] ?? value}
            </span>
          )}
        />
        {types.map((type, i) => (
          <Bar
            key={type}
            dataKey={type as string}
            stackId="food"
            fill={FOOD_COLORS[type as string]}
            radius={i === types.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
