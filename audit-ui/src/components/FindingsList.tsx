import React, { useState } from 'react'
import type { AnomalyFinding, RiskLevel } from '../types'
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS, ANOMALY_TYPE_LABELS } from '../types'

interface FindingsListProps {
  findings: AnomalyFinding[]
  title?: string
}

const FindingsList: React.FC<FindingsListProps> = ({ findings, title = '安全问题' }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')

  const filteredFindings = filter === 'all'
    ? findings
    : findings.filter((f) => f.riskLevel === filter)

  const counts = {
    critical: findings.filter((f) => f.riskLevel === 'critical').length,
    high: findings.filter((f) => f.riskLevel === 'high').length,
    medium: findings.filter((f) => f.riskLevel === 'medium').length,
    low: findings.filter((f) => f.riskLevel === 'low').length,
    info: findings.filter((f) => f.riskLevel === 'info').length,
  }

  const FilterButton: React.FC<{ level: RiskLevel | 'all'; count: number }> = ({ level, count }) => {
    const isActive = filter === level
    const color = level === 'all' ? '#6b7280' : RISK_LEVEL_COLORS[level as RiskLevel]
    const label = level === 'all' ? '全部' : RISK_LEVEL_LABELS[level as RiskLevel]

    return (
      <button
        onClick={() => setFilter(level as RiskLevel | 'all')}
        style={{
          padding: '4px 12px',
          borderRadius: 12,
          border: `1px solid ${isActive ? color : '#e5e7eb'}`,
          backgroundColor: isActive ? color + '15' : 'white',
          color: isActive ? color : '#6b7280',
          fontSize: 12,
          cursor: 'pointer',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {label} ({count})
      </button>
    )
  }

  return (
    <div className="findings-list">
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
          {title} ({findings.length})
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterButton level="all" count={findings.length} />
          <FilterButton level="critical" count={counts.critical} />
          <FilterButton level="high" count={counts.high} />
          <FilterButton level="medium" count={counts.medium} />
          <FilterButton level="low" count={counts.low} />
          <FilterButton level="info" count={counts.info} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredFindings.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: '#9ca3af',
              backgroundColor: '#f9fafb',
              borderRadius: 8,
            }}
          >
            暂无问题
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isExpanded = expandedId === finding.findingId
            const color = RISK_LEVEL_COLORS[finding.riskLevel]

            return (
              <div
                key={finding.findingId}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: 'white',
                }}
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : finding.findingId)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: color + '20',
                      color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {RISK_LEVEL_LABELS[finding.riskLevel]}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: '#374151',
                      fontWeight: 500,
                    }}
                  >
                    {ANOMALY_TYPE_LABELS[finding.anomalyType]}
                  </span>
                  {finding.lineNumber && (
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      第 {finding.lineNumber} 行
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: '#6b7280',
                    }}
                  >
                    置信度 {(finding.confidence * 100).toFixed(0)}%
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid #e5e7eb',
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#4b5563' }}>
                      {finding.description}
                    </p>

                    {finding.codeSnippet && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>代码片段:</div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 12px',
                            backgroundColor: '#1f2937',
                            color: '#e5e7eb',
                            borderRadius: 4,
                            fontSize: 12,
                            overflowX: 'auto',
                          }}
                        >
                          {finding.codeSnippet}
                        </pre>
                      </div>
                    )}

                    {finding.remediation && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>修复建议:</div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: '#059669',
                            padding: '8px 12px',
                            backgroundColor: '#ecfdf5',
                            borderRadius: 4,
                          }}
                        >
                          {finding.remediation}
                        </p>
                      </div>
                    )}

                    {finding.evidence && finding.evidence.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>证据:</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#4b5563' }}>
                          {finding.evidence.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default FindingsList
