export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type AnomalyType =
  | 'code_injection'
  | 'data_leakage'
  | 'unauthorized_network'
  | 'unsafe_eval'
  | 'sensitive_api'
  | 'memory_tampering'
  | 'prototype_pollution'
  | 'unknown'

export interface ComponentSource {
  componentId: string
  componentName: string
  code: string
  language?: string
  componentType?: string
  runtimeLogs?: string
}

export interface AnomalyFinding {
  findingId: string
  anomalyType: AnomalyType
  riskLevel: RiskLevel
  description: string
  codeSnippet: string
  lineNumber?: number
  confidence: number
  remediation?: string
  evidence?: string[]
}

export interface StaticAnalysisResult {
  syntaxValid: boolean
  syntaxError?: string
  patternMatches: AnomalyFinding[]
  complexityScore: number
  codeLines: number
}

export interface LlmAnalysisResult {
  semanticFindings: AnomalyFinding[]
  riskSummary: string
  overallAssessment: string
}

export interface AuditReport {
  reportId: string
  componentId: string
  componentName: string
  timestamp: string
  staticAnalysis: StaticAnalysisResult
  llmAnalysis: LlmAnalysisResult
  overallScore: number
  riskLevel: RiskLevel
  allFindings: AnomalyFinding[]
  recommendations: string[]
}

export interface AuditResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface SandboxExecutionResult {
  success: boolean
  timeout: boolean
  exitCode: number
  output: string
  logs: string[]
}

export interface ExtractedLogData {
  totalLines: number
  errorCount: number
  warningCount: number
  errorLogs: string[]
  networkActivities: string[]
  sensitiveDataHits: string[]
  suspiciousPatterns: SuspiciousPattern[]
}

export interface SuspiciousPattern {
  type: string
  lineNumber: number
  description: string
  severity: string
  evidence: string
}

export interface FullAuditResult {
  auditReport: AuditReport
  sandboxResult: SandboxExecutionResult
  logAnalysis: ExtractedLogData
}

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
  info: '#2563eb',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  code_injection: '代码注入',
  data_leakage: '数据泄露',
  unauthorized_network: '未授权网络访问',
  unsafe_eval: '不安全的代码执行',
  sensitive_api: '敏感API调用',
  memory_tampering: '内存篡改',
  prototype_pollution: '原型污染',
  unknown: '未知类型',
}

export type FixScope = 'all' | 'critical_high' | 'medium_and_above'

export interface CodeFixDiff {
  lineNumber: number
  originalCode: string
  fixedCode: string
  changeType: 'replace' | 'insert' | 'delete'
  reason: string
}

export interface CodeFixResult {
  originalCode: string
  fixedCode: string
  changes: CodeFixDiff[]
  fixSummary: string
  fixedFindings: string[]
  warning?: string
  estimatedScoreImprovement: number
}

export interface CodeFixRequest {
  componentId: string
  componentName: string
  code: string
  language?: string
  findings?: AnomalyFinding[]
  fixScope?: FixScope
}

export const FIX_SCOPE_LABELS: Record<FixScope, string> = {
  all: '全部安全问题',
  critical_high: '仅严重和高危',
  medium_and_above: '中危及以上',
}
