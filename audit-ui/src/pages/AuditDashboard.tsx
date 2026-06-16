import React, { useState } from 'react'
import ScoreGauge from '../components/ScoreGauge'
import CodeViewer from '../components/CodeViewer'
import FindingsList from '../components/FindingsList'
import RiskDistributionChart from '../components/RiskDistributionChart'
import StatsCard from '../components/StatsCard'
import { useAudit } from '../hooks/useAudit'
import type { ComponentSource, AuditReport, FullAuditResult } from '../types'
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

const AuditDashboard: React.FC = () => {
  const [componentId, setComponentId] = useState('comp-001')
  const [componentName, setComponentName] = useState('用户资料组件')
  const [code, setCode] = useState(SAMPLE_CODE)
  const [auditResult, setAuditResult] = useState<FullAuditResult | null>(null)
  const [activeTab, setActiveTab] = useState<'code' | 'findings' | 'overview'>('overview')

  const { loading, error, fullAudit } = useAudit()

  const handleAudit = async () => {
    const component: ComponentSource = {
      componentId,
      componentName,
      code,
      language: 'javascript',
      componentType: 'lowcode',
    }

    const result = await fullAudit(component)
    if (result) {
      setAuditResult(result)
    }
  }

  const report = auditResult?.auditReport

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
            <div style={{ fontSize: 12, color: '#6b7280' }}>AI 智能审计系统</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280' }}>
          <span>系统状态: <span style={{ color: '#16a34a' }}>● 正常</span></span>
        </div>
      </header>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* 输入区域 */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 20,
            marginBottom: 20,
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
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner">⏳</span>
                    审计中...
                  </>
                ) : (
                  <>🔍 开始审计</>
                )}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 6 }}>
              组件代码
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

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              ❌ {error}
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
                      <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a' }}>
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
        {!report && !loading && (
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
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditDashboard
