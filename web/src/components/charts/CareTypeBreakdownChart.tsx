import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import type { CatStats } from '@/types/api'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/eventColors'

interface Props {
  byType: CatStats['by_type']
}

export function CareTypeBreakdownChart({ byType }: Props) {
  const data = Object.entries(byType)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => ({
      name: EVENT_LABELS[type] ?? type,
      value: count ?? 0,
      color: EVENT_COLORS[type] ?? '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
        No events in this period
      </div>
    )
  }

  const chartHeight = Math.max(120, data.length * 38 + 16)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 4, left: 4 }}
        role="img"
        aria-label="Care event breakdown by type"
      >
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={78}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          formatter={(val, name) => [val ?? 0, name]}
          cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} opacity={0.9} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            style={{ fill: 'var(--color-muted-foreground)', fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
