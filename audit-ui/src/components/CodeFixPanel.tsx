import React, { useMemo, useState } from 'react'
import type { CodeFixResult, CodeFixDiff } from '../types'
import type { CodeFixProgress, FixStage } from '../hooks/useCodeFix'
import { FIX_SCOPE_LABELS, type FixScope } from '../types'

interface CodeFixPanelProps {
  loading: boolean
  progress: CodeFixProgress
  fixResult: CodeFixResult | null
  error: string | null
  currentScore: number
  onStartFix: (scope: FixScope) => void
  onCancelFix: () => void
  onApplyFix: () => void
  onReset: () => void
}

const STAGE_LABELS: Record<FixStage, { icon: string; color: string }> = {
  idle: { icon: '🛠️', color: '#6b7280' },
  analyzing: { icon: '🔍', color: '#3b82f6' },
  generating: { icon: '🤖', color: '#8b5cf6' },
  applying: { icon: '✨', color: '#16a34a' },
  done: { icon: '✅', color: '#16a34a' },
  error: { icon: '❌', color: '#dc2626' },
  cancelled: { icon: '⏹️', color: '#6b7280' },
}

const renderCodeWithDiff = (
  code: string,
  changes: CodeFixDiff[],
  mode: 'original' | 'fixed'
): JSX.Element[] => {
  const lines = code.split('\n')
  const changeMap = new Map<number, CodeFixDiff>()
  changes.forEach((c) => changeMap.set(c.lineNumber, c))

  return lines.map((line, idx) => {
    const lineNum = idx + 1
    const change = changeMap.get(lineNum)
    let bg = 'transparent'
    let prefix = ''
    let textColor = 'inherit'

    if (change) {
      if (mode === 'original') {
        bg = '#fef2f2'
        prefix = '− '
        textColor = '#991b1b'
      } else {
        bg = '#ecfdf5'
        prefix = '+ '
        textColor = '#065f46'
      }
    }

    return (
      <tr key={lineNum} style={{ backgroundColor: bg }}>
        <td
          style={{
            width: 50,
            textAlign: 'right',
            padding: '0 8px',
            color: '#9ca3af',
            userSelect: 'none',
            borderRight: '1px solid #f3f4f6',
            backgroundColor: '#fafafa',
          }}
        >
          {lineNum}
        </td>
        <td
          style={{
            width: 20,
            textAlign: 'center',
            color: change ? textColor : '#d1d5db',
            fontWeight: 600,
            userSelect: 'none',
          }}
        >
          {prefix}
        </td>
        <td
          style={{
            padding: '0 12px',
            whiteSpace: 'pre',
            fontFamily: 'monospace',
            fontSize: 12,
            color: textColor,
          }}
        >
          {line || '\u00A0'}
        </td>
      </tr>
    )
  })
}

const CodeFixPanel: React.FC<CodeFixPanelProps> = ({
  loading,
  progress,
  fixResult,
  error,
  currentScore,
  onStartFix,
  onCancelFix,
  onApplyFix,
  onReset,
}) => {
  const [selectedScope, setSelectedScope] = useState<FixScope>('all')
  const stageMeta = STAGE_LABELS[progress.stage]

  const improvedScore = useMemo(() => {
    if (!fixResult) return null
    return Math.min(100, currentScore + fixResult.estimatedScoreImprovement).toFixed(1)
  }, [fixResult, currentScore])

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        marginTop: 20,
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, #eff6ff 0%, #f5f3ff 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: 'white',
            }}
          >
            🛡️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
              AI 自动安全修复
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#6b7280' }}>
              一键修复安全问题，保持业务逻辑不变
            </p>
          </div>
        </div>

        {/* 操作区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {progress.stage === 'idle' && !fixResult && (
            <>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value as FixScope)}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  backgroundColor: 'white',
                }}
              >
                {(Object.keys(FIX_SCOPE_LABELS) as FixScope[]).map((k) => (
                  <option key={k} value={k}>
                    {FIX_SCOPE_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onStartFix(selectedScope)}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🤖 开始自动修复
              </button>
            </>
          )}

          {loading && (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: stageMeta.color,
                  fontWeight: 500,
                }}
              >
                <span className="spinner">{stageMeta.icon}</span>
                {progress.message}（{formatMs(progress.elapsedMs)}）
              </span>
              <button
                onClick={onCancelFix}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </>
          )}

          {fixResult && (
            <>
              <button
                onClick={onReset}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                重置
              </button>
              <button
                onClick={onApplyFix}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ✅ 应用修复代码
              </button>
            </>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            color: '#991b1b',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 修复摘要 */}
      {fixResult && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>修改行数</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
              {fixResult.changes.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>预估评分提升</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>
              +{fixResult.estimatedScoreImprovement.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>当前评分</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#6b7280' }}>
              {currentScore.toFixed(1)} →{' '}
              <span style={{ color: '#16a34a' }}>{improvedScore}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>修复问题数</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>
              {fixResult.fixedFindings.length}
            </div>
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              padding: '10px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: 8,
              fontSize: 13,
              color: '#1e40af',
              lineHeight: 1.5,
            }}
          >
            📝 <strong>修复摘要：</strong>
            {fixResult.fixSummary}
          </div>

          {fixResult.warning && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '10px 14px',
                backgroundColor: '#fefce8',
                borderRadius: 8,
                fontSize: 13,
                color: '#854d0e',
                lineHeight: 1.5,
              }}
            >
              ⚠️ <strong>注意事项：</strong>
              {fixResult.warning}
            </div>
          )}
        </div>
      )}

      {/* 修改明细列表 */}
      {fixResult && fixResult.changes.length > 0 && (
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            📋 修改明细（{fixResult.changes.length} 处）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {fixResult.changes.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 1fr',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ color: '#6b7280', fontWeight: 600 }}>第 {c.lineNumber} 行</div>
                <div style={{ color: '#991b1b', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: '#dc2626', marginRight: 4 }}>−</span>
                  {c.originalCode || '(空)'}
                </div>
                <div style={{ color: '#065f46', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: '#16a34a', marginRight: 4 }}>+</span>
                  {c.fixedCode || '(空)'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 代码对比视图 */}
      {fixResult && (
        <div style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 12,
            }}
          >
            🔀 代码对比视图
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* 原始代码 */}
            <div
              style={{
                border: '1px solid #fee2e2',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #fee2e2',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ❌ 原始代码（含安全问题）
              </div>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>{renderCodeWithDiff(fixResult.originalCode, fixResult.changes, 'original')}</tbody>
                </table>
              </div>
            </div>

            {/* 修复后代码 */}
            <div
              style={{
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#ecfdf5',
                  borderBottom: '1px solid #bbf7d0',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#065f46',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ✅ AI 修复后代码（安全版本）
              </div>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>{renderCodeWithDiff(fixResult.fixedCode, fixResult.changes, 'fixed')}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!fixResult && !loading && !error && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            选择修复范围，点击 <strong style={{ color: '#3b82f6' }}>开始自动修复</strong>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            AI 将智能分析代码中的安全问题并生成修复版本，您可以预览后一键应用
          </div>
        </div>
      )}
    </div>
  )
}

export default CodeFixPanel
