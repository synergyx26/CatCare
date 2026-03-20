import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
        No events in this period
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="30%"
          outerRadius="50%"
          dataKey="value"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          formatter={(val, name) => [val ?? 0, name]}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
