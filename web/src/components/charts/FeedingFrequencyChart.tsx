import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { DayStats } from '@/types/api'

interface Props {
  data: DayStats[]
}

export function FeedingFrequencyChart({ data }: Props) {
  const formatted = data.map((d) => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    count: d.types['feeding'] ?? 0,
  }))

  const maxVal = Math.max(...formatted.map((d) => d.count), 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={data.length > 14 ? 'preserveStartEnd' : 0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          formatter={(val) => [val ?? 0, 'Feedings']}
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {formatted.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.count === 0 ? 'var(--color-muted)' : '#f59e0b'}
              opacity={entry.count === 0 ? 0.5 : 0.75 + (entry.count / maxVal) * 0.25}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
