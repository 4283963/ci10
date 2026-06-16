import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import auditApi, { createCancelToken } from '../services/auditApi'
import type { CodeFixRequest, CodeFixResult, FixScope } from '../types'
import type { AnomalyFinding } from '../types'

export type FixStage =
  | 'idle'
  | 'analyzing'
  | 'generating'
  | 'applying'
  | 'done'
  | 'error'
  | 'cancelled'

export interface CodeFixProgress {
  stage: FixStage
  message: string
  elapsedMs: number
}

export const useCodeFix = () => {
  const [loading, setLoading] = useState(false)
  const [fixResult, setFixResult] = useState<CodeFixResult | null>(null)
  const [progress, setProgress] = useState<CodeFixProgress>({
    stage: 'idle',
    message: '待修复',
    elapsedMs: 0,
  })
  const [error, setError] = useState<string | null>(null)

  const cancelTokenRef = useRef<ReturnType<typeof createCancelToken> | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const updateStage = useCallback((stage: FixStage, message?: string) => {
    const messages: Record<FixStage, string> = {
      idle: '待修复',
      analyzing: '分析安全问题中...',
      generating: 'AI 生成安全代码中...',
      applying: '正在应用修复...',
      done: '修复完成',
      error: '修复失败',
      cancelled: '已取消',
    }
    setProgress({
      stage,
      message: message || messages[stage],
      elapsedMs: Date.now() - startTimeRef.current,
    })
  }, [])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      setProgress((prev) => ({
        ...prev,
        elapsedMs: Date.now() - startTimeRef.current,
      }))
    }, 200)
  }, [])

  const cancelFix = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('用户取消修复')
      cancelTokenRef.current = null
    }
    clearTimers()
    updateStage('cancelled')
    setLoading(false)
  }, [clearTimers, updateStage])

  const reset = useCallback(() => {
    cancelFix()
    setFixResult(null)
    setError(null)
    setProgress({ stage: 'idle', message: '待修复', elapsedMs: 0 })
  }, [cancelFix])

  const startFix = useCallback(
    async (params: {
      componentId: string
      componentName: string
      code: string
      language?: string
      findings?: AnomalyFinding[]
      fixScope?: FixScope
    }): Promise<CodeFixResult | null> => {
      setLoading(true)
      setError(null)
      setFixResult(null)
      startTimer()

      const cancelToken = createCancelToken()
      cancelTokenRef.current = cancelToken

      const timeoutId = window.setTimeout(() => {
        if (cancelTokenRef.current) {
          cancelTokenRef.current.cancel('修复超时')
        }
      }, 180000)

      const request: CodeFixRequest = {
        componentId: params.componentId,
        componentName: params.componentName,
        code: params.code,
        language: params.language || 'javascript',
        findings: params.findings,
        fixScope: params.fixScope || 'all',
      }

      try {
        updateStage('analyzing')
        await new Promise((r) => setTimeout(r, 300))

        updateStage('generating')

        const response = await auditApi.fixCode(request, cancelToken)

        if (response.data.success && response.data.data) {
          const result = response.data.data
          setFixResult(result)
          updateStage('done')
          clearTimers()
          window.clearTimeout(timeoutId)
          setLoading(false)
          cancelTokenRef.current = null
          return result
        }
        throw new Error(response.data.message || '修复失败')
      } catch (err: any) {
        window.clearTimeout(timeoutId)
        clearTimers()
        if (axios.isCancel(err)) {
          updateStage('cancelled')
          setError(null)
        } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          updateStage('error', '修复超时')
          setError('代码修复超时，建议使用本地规则快速修复或稍后重试')
        } else {
          const msg = err?.response?.data?.detail || err?.message || '未知错误'
          updateStage('error')
          setError(msg)
        }
        setLoading(false)
        cancelTokenRef.current = null
        return null
      }
    },
    [startTimer, clearTimers, updateStage]
  )

  const applyFix = useCallback(
    (onApply: (fixedCode: string) => void) => {
      if (!fixResult) return
      updateStage('applying')
      try {
        onApply(fixResult.fixedCode)
        updateStage('done', '修复已应用到代码编辑区')
        setFixResult(null)
      } catch (e: any) {
        updateStage('error', '应用失败')
        setError(e.message || '应用修复失败')
      }
    },
    [fixResult, updateStage]
  )

  useEffect(() => {
    return () => {
      clearTimers()
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('组件卸载')
      }
    }
  }, [clearTimers])

  return {
    loading,
    progress,
    fixResult,
    error,
    startFix,
    cancelFix,
    applyFix,
    reset,
  }
}

export default useCodeFix
