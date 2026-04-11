import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_LABELS } from '@/types/api'
import type { ExpenseCategory } from '@/types/api'
import { formatCurrency } from '@/lib/currency'

interface Props {
  data: Partial<Record<ExpenseCategory, number>>
  total: number
  currency: string
}

export function ExpenseCategoryDonutChart({ data, total, currency }: Props) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: EXPENSE_CATEGORY_LABELS[key as ExpenseCategory],
      value: value as number,
      color: EXPENSE_CATEGORY_COLORS[key as ExpenseCategory],
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <ChartCard title="By Category" subtitle="Spending breakdown">
      <div className="relative" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius="52%"
              outerRadius="72%"
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value ?? 0)
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0'
                return [`${formatCurrency(v, currency)} (${pct}%)`, name]
              }}
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-20px' }}>
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-bold tabular-nums">{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </ChartCard>
  )
}
