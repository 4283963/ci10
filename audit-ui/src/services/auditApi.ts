import axios, { CancelTokenSource } from 'axios'
import type {
  ComponentSource,
  AuditReport,
  AuditResponse,
  SandboxExecutionResult,
  ExtractedLogData,
  FullAuditResult,
  CodeFixRequest,
  CodeFixResult,
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
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message)
    } else {
      console.error('API Error:', error?.message || error)
    }
    return Promise.reject(error)
  }
)

export function createCancelToken(): CancelTokenSource {
  return axios.CancelToken.source()
}

export const auditApi = {
  healthCheck: () => {
    return api.get<AuditResponse<Record<string, unknown>>>('/health', { timeout: 5000 })
  },

  auditComponent: (component: ComponentSource, cancelToken?: CancelTokenSource) => {
    return api.post<AuditResponse<AuditReport>>('/audit', component, {
      cancelToken: cancelToken?.token,
    })
  },

  fullAudit: (component: ComponentSource, cancelToken?: CancelTokenSource) => {
    return api.post<AuditResponse<FullAuditResult>>('/audit/full', component, {
      cancelToken: cancelToken?.token,
      timeout: 120000,
    })
  },

  batchAudit: (components: ComponentSource[], cancelToken?: CancelTokenSource) => {
    return api.post<AuditResponse<AuditReport[]>>('/audit/batch', components, {
      cancelToken: cancelToken?.token,
    })
  },

  sandboxExecute: (component: ComponentSource, cancelToken?: CancelTokenSource) => {
    return api.post<AuditResponse<SandboxExecutionResult>>('/sandbox/execute', component, {
      cancelToken: cancelToken?.token,
    })
  },

  fixCode: (request: CodeFixRequest, cancelToken?: CancelTokenSource) => {
    return api.post<AuditResponse<CodeFixResult>>('/audit/fix', request, {
      cancelToken: cancelToken?.token,
      timeout: 180000,
    })
  },

  analyzeLogs: (logs: string[]) => {
    return api.post<AuditResponse<ExtractedLogData>>('/logs/analyze', logs)
  },

  getSystemStatus: () => {
    return api.get<AuditResponse<Record<string, unknown>>>('/status', { timeout: 5000 })
  },
}

export default auditApi
