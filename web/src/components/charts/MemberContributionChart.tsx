import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MemberStats } from '@/types/api'

interface Props {
  data: MemberStats[]
}

export function MemberContributionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
        No data available
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.count - a.count)
  const chartHeight = Math.max(72, sorted.length * 52)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
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
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          formatter={(val) => [val ?? 0, 'Events logged']}
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
        />
        <Bar
          dataKey="count"
          fill="var(--color-primary)"
          radius={[0, 6, 6, 0]}
          maxBarSize={28}
          opacity={0.85}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
