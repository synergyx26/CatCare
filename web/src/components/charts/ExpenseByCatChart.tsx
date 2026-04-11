import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LabelList, ResponsiveContainer, Cell,
} from 'recharts'
import { ChartCard } from './ChartCard'
import type { Cat } from '@/types/api'
import { formatCurrency } from '@/lib/currency'

interface Props {
  data: Record<string, number>   // cat_id as string (or "null") -> total
  cats: Cat[]
  currency: string
}

export function ExpenseByCatChart({ data, cats, currency }: Props) {
  const catName = (key: string) => {
    if (key === 'null' || key === '') return 'Household'
    const cat = cats.find((c) => c.id === Number(key))
    return cat?.name ?? 'Unknown'
  }

  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: catName(key), value }))
    .sort((a, b) => b.value - a.value)

  const barHeight = 36
  const minHeight = 120
  const chartHeight = Math.max(minHeight, chartData.length * barHeight + 40)

  return (
    <ChartCard title="By Cat" subtitle="Spending per cat">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrency(v, currency)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: 'var(--foreground)' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Total']}
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chartData.map((_, i) => (
              <Cell key={i} fill="#8b5cf6" fillOpacity={1 - i * 0.12} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => formatCurrency(Number(v ?? 0), currency)}
              style={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
