import { useState, useCallback } from 'react'
import auditApi from '../services/auditApi'
import type { ComponentSource, AuditReport, FullAuditResult } from '../types'

export const useAudit = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auditComponent = useCallback(async (component: ComponentSource): Promise<AuditReport | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await auditApi.auditComponent(component)
      if (response.data.success) {
        return response.data.data
      }
      throw new Error(response.data.message)
    } catch (err: any) {
      setError(err.message || '审计失败')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const fullAudit = useCallback(async (component: ComponentSource): Promise<FullAuditResult | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await auditApi.fullAudit(component)
      if (response.data.success) {
        return response.data.data
      }
      throw new Error(response.data.message)
    } catch (err: any) {
      setError(err.message || '完整审计失败')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const sandboxExecute = useCallback(async (component: ComponentSource) => {
    setLoading(true)
    setError(null)
    try {
      const response = await auditApi.sandboxExecute(component)
      if (response.data.success) {
        return response.data.data
      }
      throw new Error(response.data.message)
    } catch (err: any) {
      setError(err.message || '沙箱执行失败')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    auditComponent,
    fullAudit,
    sandboxExecute,
  }
}

export default useAudit
