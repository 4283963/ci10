import React from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: string
  trend?: {
    value: number
    isUp: boolean
  }
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  color = '#3b82f6',
  trend,
}) => {
  return (
    <div
      className="stats-card"
      style={{
        padding: 20,
        borderRadius: 12,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: '#6b7280',
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 'bold',
          color,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitle}</div>
      )}
      {trend && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: trend.isUp ? '#dc2626' : '#16a34a',
          }}
        >
          {trend.isUp ? '↑' : '↓'} {trend.value}%
        </div>
      )}
    </div>
  )
}

export default StatsCard
