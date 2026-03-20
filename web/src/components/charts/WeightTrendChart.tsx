import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { WeightPoint } from '@/types/api'

interface Props {
  data: WeightPoint[]
}

export function WeightTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
        No weight entries in this period
      </div>
    )
  }

  const unit = data[0]?.unit ?? 'kg'
  const formatted = data.map((p) => ({
    date: new Date(p.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: p.value,
    unit: p.unit,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={formatted} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}${unit}`}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600, marginBottom: 2 }}
          formatter={(val, _, props) =>
            [`${val ?? ''} ${(props.payload as { unit?: string }).unit ?? ''}`, 'Weight']
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={{ fill: '#22c55e', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
