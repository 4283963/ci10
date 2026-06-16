from fastapi import APIRouter, HTTPException
from fastapi import Request
from typing import List
import asyncio

from app.models.audit_models import ComponentSource, AuditResponse
from app.services.audit_service import perform_audit

router = APIRouter(prefix="/api/v1", tags=["audit"])

AUDIT_TIMEOUT = 90


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "audit-brain"}


@router.post("/audit", response_model=AuditResponse)
async def audit_component(component: ComponentSource, request: Request):
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    if len(component.code) > 500000:
        raise HTTPException(status_code=413, detail="代码长度超过限制 (最大 500000 字符)")
    
    try:
        result = await asyncio.wait_for(
            perform_audit(component),
            timeout=AUDIT_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"审计超时（超过 {AUDIT_TIMEOUT} 秒），请稍后重试或使用静态分析接口"
        )
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.message)
    
    return result


@router.post("/audit/batch", response_model=List[AuditResponse])
async def batch_audit_components(components: List[ComponentSource]):
    if not components:
        raise HTTPException(status_code=400, detail="组件列表不能为空")
    
    if len(components) > 20:
        raise HTTPException(status_code=400, detail="批量审计最多支持20个组件")
    
    results = []
    for component in components:
        try:
            result = await perform_audit(component)
        except Exception as e:
            result = AuditResponse(
                success=False,
                message=f"审计异常: {str(e)}",
                data=None
            )
        results.append(result)
    
    return results


@router.post("/audit/static")
async def static_audit(component: ComponentSource):
    from app.services.static_analyzer import analyze_static
    
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    if len(component.code) > 500000:
        raise HTTPException(status_code=413, detail="代码长度超过限制")
    
    try:
        result = analyze_static(component.code)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"静态分析失败: {str(e)}")


@router.post("/audit/llm")
async def llm_audit(component: ComponentSource):
    from app.services.llm_service import analyze_with_llm
    
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    if len(component.code) > 500000:
        raise HTTPException(status_code=413, detail="代码长度超过限制")
    
    try:
        result = await asyncio.wait_for(
            analyze_with_llm(component),
            timeout=60
        )
        return {"success": True, "data": result}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="LLM分析超时")
    except Exception as e:
        return {
            "success": False,
            "message": f"LLM分析失败: {str(e)}",
            "data": {
                "semantic_findings": [],
                "risk_summary": f"LLM分析异常: {str(e)}",
                "overall_assessment": "LLM分析不可用，请参考静态分析结果"
            }
        }
