import React from 'react'
import { RiskLevel, RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '../types'

interface ScoreGaugeProps {
  score: number
  riskLevel: RiskLevel
  size?: number
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, riskLevel, size = 200 }) => {
  const color = RISK_LEVEL_COLORS[riskLevel]
  const label = RISK_LEVEL_LABELS[riskLevel]
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="score-gauge" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size / 2 + 20} style={{ transform: 'rotate(180deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: size * 0.18, fontWeight: 'bold', color }}>{score.toFixed(1)}</div>
        <div style={{ fontSize: size * 0.08, color: '#6b7280', marginTop: 4 }}>安全评分</div>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 12,
            backgroundColor: color + '20',
            color,
            fontSize: size * 0.07,
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

export default ScoreGauge
