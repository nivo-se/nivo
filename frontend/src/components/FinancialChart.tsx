import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface FinancialData {
  year: number
  revenue: number | null
  ebit: number | null
}

interface FinancialChartProps {
  data: FinancialData[]
  companyName?: string
}

const FinancialChart: React.FC<FinancialChartProps> = ({ data, companyName }) => {
  // Filter out null values and prepare data for the chart
  const chartData = data
    .filter(d => d.revenue !== null || d.ebit !== null)
    .map(d => ({
      year: d.year,
      revenue: d.revenue || 0,
      ebit: d.ebit || 0,
      revenueLabel: d.revenue ? `${(d.revenue / 1000).toFixed(0)}K` : 'N/A',
      ebitLabel: d.ebit ? `${(d.ebit / 1000).toFixed(0)}K` : 'N/A'
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No Financial Data Available</p>
          <p className="text-sm">Historical data not available for this company</p>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Year: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'revenue' ? 'Revenue' : 'EBIT'}: {entry.value ? `${(entry.value / 1_000_000).toFixed(1)} mSEK` : 'N/A'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const maxValue = Math.max(
    ...chartData.map(d => Math.max(d.revenue, d.ebit))
  )

  const formatYAxis = (value: number) => {
    // Database now stores values in actual SEK (multiplied by 1000 from Allabolag)
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(0)}B SEK`
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(0)}M SEK`
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K SEK`
    }
    return `${value} SEK`
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 10,
            right: 10,
            left: 10,
            bottom: 10,
          }}
        >
          <CartesianGrid strokeDasharray="2 2" stroke="#f0f0f0" />
          <XAxis 
            dataKey="year" 
            stroke="#666"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#666"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="rect"
            fontSize={10}
          />
          <Bar 
            dataKey="revenue" 
            fill="#3b82f6" 
            name="Revenue"
            radius={[1, 1, 0, 0]}
            maxBarSize={40}
          />
          <Bar 
            dataKey="ebit" 
            fill="#10b981" 
            name="EBIT"
            radius={[1, 1, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FinancialChart
