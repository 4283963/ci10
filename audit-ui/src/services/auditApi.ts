import axios from 'axios'
import type {
  ComponentSource,
  AuditReport,
  AuditResponse,
  SandboxExecutionResult,
  ExtractedLogData,
  FullAuditResult,
} from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const auditApi = {
  healthCheck: () => {
    return api.get<AuditResponse<Record<string, unknown>>>('/health')
  },

  auditComponent: (component: ComponentSource) => {
    return api.post<AuditResponse<AuditReport>>('/audit', component)
  },

  fullAudit: (component: ComponentSource) => {
    return api.post<AuditResponse<FullAuditResult>>('/audit/full', component)
  },

  batchAudit: (components: ComponentSource[]) => {
    return api.post<AuditResponse<AuditReport[]>>('/audit/batch', components)
  },

  sandboxExecute: (component: ComponentSource) => {
    return api.post<AuditResponse<SandboxExecutionResult>>('/sandbox/execute', component)
  },

  analyzeLogs: (logs: string[]) => {
    return api.post<AuditResponse<ExtractedLogData>>('/logs/analyze', logs)
  },

  getSystemStatus: () => {
    return api.get<AuditResponse<Record<string, unknown>>>('/status')
  },
}

export default auditApi
