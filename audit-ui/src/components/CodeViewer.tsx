import React, { useMemo } from 'react'
import type { AnomalyFinding } from '../types'
import { RISK_LEVEL_COLORS } from '../types'

interface CodeViewerProps {
  code: string
  findings?: AnomalyFinding[]
  language?: string
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code, findings = [], language = 'javascript' }) => {
  const lines = useMemo(() => code.split('\n'), [code])

  const findingByLine = useMemo(() => {
    const map = new Map<number, AnomalyFinding[]>()
    findings.forEach((f) => {
      if (f.lineNumber) {
        const existing = map.get(f.lineNumber) || []
        map.set(f.lineNumber, [...existing, f])
      }
    })
    return map
  }, [findings])

  const getLineBackground = (lineNum: number) => {
    const lineFindings = findingByLine.get(lineNum)
    if (!lineFindings) return 'transparent'

    const levels = lineFindings.map((f) => f.riskLevel)
    if (levels.includes('critical')) return '#fef2f2'
    if (levels.includes('high')) return '#fff7ed'
    if (levels.includes('medium')) return '#fefce8'
    return 'transparent'
  }

  const getHighestRiskColor = (lineNum: number) => {
    const lineFindings = findingByLine.get(lineNum)
    if (!lineFindings) return ''

    const levels = lineFindings.map((f) => f.riskLevel)
    if (levels.includes('critical')) return RISK_LEVEL_COLORS.critical
    if (levels.includes('high')) return RISK_LEVEL_COLORS.high
    if (levels.includes('medium')) return RISK_LEVEL_COLORS.medium
    return ''
  }

  return (
    <div className="code-viewer" style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 12,
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>源代码 ({lines.length} 行)</span>
          <span>{language}</span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {lines.map((line, index) => {
                const lineNum = index + 1
                const hasIssue = findingByLine.has(lineNum)
                return (
                  <tr key={lineNum} style={{ backgroundColor: getLineBackground(lineNum) }}>
                    <td
                      style={{
                        width: 50,
                        textAlign: 'right',
                        padding: '0 12px',
                        color: '#9ca3af',
                        userSelect: 'none',
                        borderRight: hasIssue ? `3px solid ${getHighestRiskColor(lineNum)}` : '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      {lineNum}
                    </td>
                    <td
                      style={{
                        padding: '2px 12px',
                        whiteSpace: 'pre',
                        color: '#1f2937',
                      }}
                    >
                      {line || '\u00A0'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default CodeViewer
