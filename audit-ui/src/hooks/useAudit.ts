import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import auditApi, { createCancelToken } from '../services/auditApi'
import type { ComponentSource, AuditReport, FullAuditResult } from '../types'

export type AuditStage = 'idle' | 'parsing' | 'static' | 'sandbox' | 'llm' | 'scoring' | 'done' | 'error' | 'timeout' | 'cancelled'

export interface AuditProgress {
  stage: AuditStage
  progress: number
  message: string
  elapsedMs: number
}

const STAGE_MESSAGES: Record<AuditStage, string> = {
  idle: '待审计',
  parsing: '解析代码中...',
  static: '静态分析中...',
  sandbox: '沙箱执行中...',
  llm: 'AI 语义分析中...',
  scoring: '计算安全评分中...',
  done: '审计完成',
  error: '审计失败',
  timeout: '审计超时',
  cancelled: '已取消',
}

const STAGE_PROGRESS: Record<AuditStage, number> = {
  idle: 0,
  parsing: 10,
  static: 30,
  sandbox: 50,
  llm: 75,
  scoring: 90,
  done: 100,
  error: 100,
  timeout: 100,
  cancelled: 100,
}

const MAX_AUDIT_DURATION_MS = 120000

export const useAudit = () => {
  const [progress, setProgress] = useState<AuditProgress>({
    stage: 'idle',
    progress: 0,
    message: '待审计',
    elapsedMs: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)

  const cancelTokenRef = useRef<ReturnType<typeof createCancelToken> | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)
  const stageTimerRef = useRef<number | null>(null)

  const updateProgress = useCallback((stage: AuditStage, message?: string) => {
    setProgress({
      stage,
      progress: STAGE_PROGRESS[stage],
      message: message || STAGE_MESSAGES[stage],
      elapsedMs: Date.now() - startTimeRef.current,
    })
  }, [])

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (stageTimerRef.current) {
      window.clearTimeout(stageTimerRef.current)
      stageTimerRef.current = null
    }
  }, [])

  const startProgressTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      setProgress((prev) => ({
        ...prev,
        elapsedMs: Date.now() - startTimeRef.current,
      }))
    }, 200)
  }, [])

  const cancelAudit = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('用户取消审计')
      cancelTokenRef.current = null
    }
    clearAllTimers()
    updateProgress('cancelled', '审计已取消')
    setIsAuditing(false)
  }, [clearAllTimers, updateProgress])

  const handleError = useCallback((err: any) => {
    clearAllTimers()

    if (axios.isCancel(err)) {
      updateProgress('cancelled', '审计已取消')
      setError(null)
    } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      updateProgress('timeout', '审计超时，请稍后重试')
      setError('请求超时，服务端可能正在处理复杂代码。请稍后重试，或使用静态分析模式。')
    } else {
      const msg = err?.response?.data?.detail || err?.message || '未知错误'
      updateProgress('error', `审计失败: ${msg}`)
      setError(msg)
    }

    setIsAuditing(false)
    cancelTokenRef.current = null
  }, [clearAllTimers, updateProgress])

  const fullAudit = useCallback(async (component: ComponentSource): Promise<FullAuditResult | null> => {
    setIsAuditing(true)
    setError(null)
    startProgressTimer()
    updateProgress('parsing')

    const cancelToken = createCancelToken()
    cancelTokenRef.current = cancelToken

    const timeoutId = window.setTimeout(() => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('审计超时')
      }
    }, MAX_AUDIT_DURATION_MS)

    try {
      updateProgress('static', '静态代码分析中...')
      await new Promise((resolve) => setTimeout(resolve, 300))

      updateProgress('sandbox', '沙箱安全执行中...')
      await new Promise((resolve) => setTimeout(resolve, 200))

      updateProgress('llm', 'AI 智能语义分析中...')

      const response = await auditApi.fullAudit(component, cancelToken)

      updateProgress('scoring', '计算安全评分...')
      await new Promise((resolve) => setTimeout(resolve, 200))

      if (response.data.success) {
        updateProgress('done')
        clearAllTimers()
        window.clearTimeout(timeoutId)
        setIsAuditing(false)
        cancelTokenRef.current = null
        return response.data.data
      }
      throw new Error(response.data.message)

    } catch (err: any) {
      window.clearTimeout(timeoutId)
      handleError(err)
      return null
    }
  }, [startProgressTimer, updateProgress, clearAllTimers, handleError])

  const auditComponent = useCallback(async (component: ComponentSource): Promise<AuditReport | null> => {
    setIsAuditing(true)
    setError(null)
    startProgressTimer()
    updateProgress('parsing')

    const cancelToken = createCancelToken()
    cancelTokenRef.current = cancelToken

    const timeoutId = window.setTimeout(() => {
      cancelToken.cancel('审计超时')
    }, MAX_AUDIT_DURATION_MS)

    try {
      updateProgress('static', '静态代码分析中...')
      await new Promise((resolve) => setTimeout(resolve, 200))

      updateProgress('llm', 'AI 智能语义分析中...')

      const response = await auditApi.auditComponent(component, cancelToken)

      updateProgress('scoring', '计算安全评分...')
      await new Promise((resolve) => setTimeout(resolve, 200))

      if (response.data.success) {
        updateProgress('done')
        clearAllTimers()
        window.clearTimeout(timeoutId)
        setIsAuditing(false)
        cancelTokenRef.current = null
        return response.data.data
      }
      throw new Error(response.data.message)

    } catch (err: any) {
      window.clearTimeout(timeoutId)
      handleError(err)
      return null
    }
  }, [startProgressTimer, updateProgress, clearAllTimers, handleError])

  useEffect(() => {
    return () => {
      clearAllTimers()
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('组件卸载')
      }
    }
  }, [clearAllTimers])

  const reset = useCallback(() => {
    clearAllTimers()
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('重置')
      cancelTokenRef.current = null
    }
    setProgress({
      stage: 'idle',
      progress: 0,
      message: '待审计',
      elapsedMs: 0,
    })
    setError(null)
    setIsAuditing(false)
  }, [clearAllTimers])

  return {
    isAuditing,
    progress,
    error,
    auditComponent,
    fullAudit,
    cancelAudit,
    reset,
  }
}

export default useAudit
