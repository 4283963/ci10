from fastapi import APIRouter, HTTPException
from typing import List

from app.models.audit_models import ComponentSource, AuditResponse
from app.services.audit_service import perform_audit

router = APIRouter(prefix="/api/v1", tags=["audit"])


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "audit-brain"}


@router.post("/audit", response_model=AuditResponse)
async def audit_component(component: ComponentSource):
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    result = await perform_audit(component)
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.message)
    
    return result


@router.post("/audit/batch", response_model=List[AuditResponse])
async def batch_audit_components(components: List[ComponentSource]):
    if not components:
        raise HTTPException(status_code=400, detail="组件列表不能为空")
    
    if len(components) > 50:
        raise HTTPException(status_code=400, detail="批量审计最多支持50个组件")
    
    results = []
    for component in components:
        result = await perform_audit(component)
        results.append(result)
    
    return results


@router.post("/audit/static")
async def static_audit(component: ComponentSource):
    from app.services.static_analyzer import analyze_static
    
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    result = analyze_static(component.code)
    return {"success": True, "data": result}


@router.post("/audit/llm")
async def llm_audit(component: ComponentSource):
    from app.services.llm_service import analyze_with_llm
    
    if not component.code or not component.code.strip():
        raise HTTPException(status_code=400, detail="组件代码不能为空")
    
    result = await analyze_with_llm(component)
    return {"success": True, "data": result}
