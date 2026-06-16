import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { AnomalyFinding } from '../types'
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '../types'

interface RiskDistributionChartProps {
  findings: AnomalyFinding[]
  title?: string
}

const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({ findings, title = '风险分布' }) => {
  const data = [
    {
      name: '严重',
      value: findings.filter((f) => f.riskLevel === 'critical').length,
      color: RISK_LEVEL_COLORS.critical,
    },
    {
      name: '高危',
      value: findings.filter((f) => f.riskLevel === 'high').length,
      color: RISK_LEVEL_COLORS.high,
    },
    {
      name: '中危',
      value: findings.filter((f) => f.riskLevel === 'medium').length,
      color: RISK_LEVEL_COLORS.medium,
    },
    {
      name: '低危',
      value: findings.filter((f) => f.riskLevel === 'low').length,
      color: RISK_LEVEL_COLORS.low,
    },
    {
      name: '信息',
      value: findings.filter((f) => f.riskLevel === 'info').length,
      color: RISK_LEVEL_COLORS.info,
    },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
        暂无风险数据
      </div>
    )
  }

  return (
    <div className="risk-distribution-chart">
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>{title}</h3>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} 个`, '数量']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default RiskDistributionChart
