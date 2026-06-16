import React, { useState, useCallback } from 'react'
import ScoreGauge from '../components/ScoreGauge'
import CodeViewer from '../components/CodeViewer'
import FindingsList from '../components/FindingsList'
import RiskDistributionChart from '../components/RiskDistributionChart'
import StatsCard from '../components/StatsCard'
import { useAudit } from '../hooks/useAudit'
import type { ComponentSource, FullAuditResult } from '../types'
import { RISK_LEVEL_COLORS } from '../types'

const SAMPLE_CODE = `// 低代码组件示例
function UserProfileComponent(props) {
  const { userId, data } = props;
  
  // 不安全的代码示例
  const userInput = document.getElementById('input').value;
  const result = eval(userInput + ' * 2');
  
  // 直接操作DOM
  document.getElementById('output').innerHTML = userInput;
  
  // 网络请求
  fetch('https://api.external.com/data', {
    method: 'POST',
    body: JSON.stringify({ token: localStorage.getItem('auth_token') })
  });
  
  // 原型污染风险
  const obj = {};
  obj.__proto__.polluted = true;
  
  // cookie操作
  document.cookie = "session=" + userInput;
  
  return result;
}`

const NESTED_LOOP_TEST_CODE = `// 测试用：20层嵌套循环
function maliciousComponent() {
  let count = 0;
  for (let i1 = 0; i1 < 10; i1++) {
    for (let i2 = 0; i2 < 10; i2++) {
      for (let i3 = 0; i3 < 10; i3++) {
        for (let i4 = 0; i4 < 10; i4++) {
          for (let i5 = 0; i5 < 10; i5++) {
            for (let i6 = 0; i6 < 10; i6++) {
              for (let i7 = 0; i7 < 10; i7++) {
                for (let i8 = 0; i8 < 10; i8++) {
                  for (let i9 = 0; i9 < 10; i9++) {
                    for (let i10 = 0; i10 < 10; i10++) {
                      for (let i11 = 0; i11 < 10; i11++) {
                        for (let i12 = 0; i12 < 10; i12++) {
                          for (let i13 = 0; i13 < 10; i13++) {
                            for (let i14 = 0; i14 < 10; i14++) {
                              for (let i15 = 0; i15 < 10; i15++) {
                                for (let i16 = 0; i16 < 10; i16++) {
                                  for (let i17 = 0; i17 < 10; i17++) {
                                    for (let i18 = 0; i18 < 10; i18++) {
                                      for (let i19 = 0; i19 < 10; i19++) {
                                        for (let i20 = 0; i20 < 10; i20++) {
                                          count++;
                                          eval("count = " + count);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return count;
}`

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
}

const AuditDashboard: React.FC = () => {
  const [componentId, setComponentId] = useState('comp-001')
  const [componentName, setComponentName] = useState('用户资料组件')
  const [code, setCode] = useState(SAMPLE_CODE)
  const [auditResult, setAuditResult] = useState<FullAuditResult | null>(null)
  const [activeTab, setActiveTab] = useState<'code' | 'findings' | 'overview'>('overview')

  const { isAuditing, progress, error, fullAudit, cancelAudit, reset } = useAudit()

  const handleAudit = useCallback(async () => {
    const component: ComponentSource = {
      componentId,
      componentName,
      code,
      language: 'javascript',
      componentType: 'lowcode',
    }

    setAuditResult(null)
    const result = await fullAudit(component)
    if (result) {
      setAuditResult(result)
    }
  }, [componentId, componentName, code, fullAudit])

  const handleReset = useCallback(() => {
    reset()
    setAuditResult(null)
  }, [reset])

  const loadTestCode = useCallback(() => {
    setComponentId('comp-malicious-001')
    setComponentName('恶意嵌套循环测试组件')
    setCode(NESTED_LOOP_TEST_CODE)
    handleReset()
  }, [handleReset])

  const report = auditResult?.auditReport

  const isErrorState = progress.stage === 'error' || progress.stage === 'timeout' || progress.stage === 'cancelled'

  return (
    <div className="audit-dashboard" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* 顶部导航 */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            AI
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>低代码组件安全审计工作台</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>AI 智能审计系统 v2.0（异常边界防护版）</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', alignItems: 'center' }}>
          <span>系统状态: <span style={{ color: '#16a34a' }}>● 正常</span></span>
          <button
            onClick={loadTestCode}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              backgroundColor: 'white',
              color: '#6b7280',
              cursor: 'pointer',
            }}
          >
            🧪 加载嵌套循环测试用例
          </button>
        </div>
      </header>

      {/* 进度条 */}
      {isAuditing && (
        <div
          style={{
            position: 'sticky',
            top: 60,
            zIndex: 99,
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '12px 24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: '#374151', fontWeight: 500 }}>
                  {progress.message}
                </span>
                <span style={{ color: '#6b7280' }}>
                  用时: {formatDuration(progress.elapsedMs)}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress.progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease-out',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                {['parsing', 'static', 'sandbox', 'llm', 'scoring', 'done'].map((stage, i) => {
                  const stages = ['parsing', 'static', 'sandbox', 'llm', 'scoring', 'done']
                  const currentIdx = stages.indexOf(progress.stage)
                  const stageIdx = stages.indexOf(stage)
                  const isDone = stageIdx <= currentIdx
                  const isCurrent = stageIdx === currentIdx
                  return (
                    <div
                      key={stage}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: isCurrent ? '#3b82f6' : isDone ? '#16a34a' : '#d1d5db',
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                    >
                      <span>{isDone ? '✓' : isCurrent ? '●' : '○'}</span>
                      <span>
                        {stage === 'parsing' && '解析'}
                        {stage === 'static' && '静态分析'}
                        {stage === 'sandbox' && '沙箱执行'}
                        {stage === 'llm' && 'AI分析'}
                        {stage === 'scoring' && '评分'}
                        {stage === 'done' && '完成'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <button
              onClick={cancelAudit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              ✕ 取消审计
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* 输入区域 */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 20,
            marginBottom: 20,
            opacity: isAuditing ? 0.6 : 1,
            pointerEvents: isAuditing ? 'none' : 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                组件ID
              </label>
              <input
                type="text"
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                组件名称
              </label>
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleAudit}
                disabled={isAuditing}
                style={{
                  padding: '10px 24px',
                  backgroundColor: isAuditing ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: isAuditing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isAuditing ? (
                  <>
                    <span className="spinner">⏳</span>
                    审计中 ({progress.progress}%)
                  </>
                ) : (
                  <>🔍 开始审计</>
                )}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>
              组件代码（最长 500,000 字符）
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                width: '100%',
                minHeight: 200,
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 12,
                resize: 'vertical',
              }}
              spellCheck={false}
            />
          </div>

          {isErrorState && error && (
            <div
              style={{
                marginTop: 12,
                padding: '12px 16px',
                backgroundColor:
                  progress.stage === 'timeout' ? '#fefce8' : '#fef2f2',
                color: progress.stage === 'timeout' ? '#92400e' : '#dc2626',
                borderRadius: 6,
                fontSize: 13,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>
                {progress.stage === 'timeout' ? '⏰' : '❌'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {progress.stage === 'timeout' && '审计超时'}
                  {progress.stage === 'error' && '审计失败'}
                  {progress.stage === 'cancelled' && '审计已取消'}
                </div>
                <div>{error}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleAudit}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 重新审计
                  </button>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 审计结果 */}
        {report && (
          <div>
            {/* 概览Tab */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['overview', 'code', 'findings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    backgroundColor: activeTab === tab ? 'white' : 'transparent',
                    color: activeTab === tab ? '#3b82f6' : '#6b7280',
                    fontSize: 14,
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
                  }}
                >
                  {tab === 'overview' && '📊 审计概览'}
                  {tab === 'code' && '💻 代码视图'}
                  {tab === 'findings' && '⚠️ 问题详情'}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div>
                {/* 评分卡片 */}
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    padding: 24,
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 40,
                  }}
                >
                  <ScoreGauge score={report.overallScore} riskLevel={report.riskLevel} size={220} />

                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: 20 }}>{report.componentName}</h2>
                    <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 13 }}>
                      报告ID: {report.reportId} | 审计时间: {new Date(report.timestamp).toLocaleString()}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                      <StatsCard
                        title="问题总数"
                        value={report.allFindings.length}
                        color={RISK_LEVEL_COLORS[report.riskLevel]}
                        subtitle="个安全问题"
                      />
                      <StatsCard
                        title="严重/高危"
                        value={
                          report.allFindings.filter(
                            (f) => f.riskLevel === 'critical' || f.riskLevel === 'high'
                          ).length
                        }
                        color="#dc2626"
                        subtitle="需立即修复"
                      />
                      <StatsCard
                        title="代码行数"
                        value={report.staticAnalysis.codeLines}
                        color="#3b82f6"
                        subtitle="有效代码行"
                      />
                      <StatsCard
                        title="复杂度"
                        value={report.staticAnalysis.complexityScore.toFixed(1)}
                        color="#8b5cf6"
                        subtitle="圈复杂度"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* 风险分布 */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      padding: 20,
                    }}
                  >
                    <RiskDistributionChart findings={report.allFindings} title="风险等级分布" />
                  </div>

                  {/* 审计摘要 */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      padding: 20,
                    }}
                  >
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
                      📝 AI 审计摘要
                    </h3>
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#eff6ff',
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 500, marginBottom: 4 }}>
                        整体评估
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a', whiteSpace: 'pre-wrap' }}>
                        {report.llmAnalysis.overallAssessment || '暂无评估'}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#fefce8',
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#854d0e', fontWeight: 500, marginBottom: 4 }}>
                        风险摘要
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>
                        {report.llmAnalysis.riskSummary || '暂无摘要'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 修复建议 */}
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    padding: 20,
                    marginTop: 20,
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
                    💡 修复建议
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 24 }}>
                    {report.recommendations.map((rec, index) => (
                      <li key={index} style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  padding: 20,
                }}
              >
                <CodeViewer code={code} findings={report.allFindings} />
              </div>
            )}

            {activeTab === 'findings' && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  padding: 20,
                }}
              >
                <FindingsList findings={report.allFindings} title="安全问题列表" />
              </div>
            )}
          </div>
        )}

        {/* 初始状态提示 */}
        {!report && !isAuditing && !isErrorState && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: 'white',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#374151' }}>
              准备好开始审计了吗？
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
              输入组件代码，点击"开始审计"按钮，AI 将为您进行全面的安全分析
            </p>
            <p style={{ margin: '12px 0 0 0', color: '#9ca3af', fontSize: 12 }}>
              系统已升级异常边界防护：多级降级、超时熔断、进度可追踪
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditDashboard
