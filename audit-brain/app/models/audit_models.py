from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AnomalyType(str, Enum):
    CODE_INJECTION = "code_injection"
    DATA_LEAKAGE = "data_leakage"
    UNAUTHORIZED_NETWORK = "unauthorized_network"
    UNSAFE_EVAL = "unsafe_eval"
    SENSITIVE_API = "sensitive_api"
    MEMORY_TAMPERING = "memory_tampering"
    PROTOTYPE_POLLUTION = "prototype_pollution"
    UNKNOWN = "unknown"


class ComponentSource(BaseModel):
    component_id: str = Field(..., description="组件唯一标识")
    component_name: str = Field(..., description="组件名称")
    code: str = Field(..., description="待审计的组件源代码")
    language: str = Field(default="javascript", description="代码语言")
    component_type: str = Field(default="lowcode", description="组件类型")
    runtime_logs: Optional[str] = Field(None, description="运行时日志")


class AnomalyFinding(BaseModel):
    finding_id: str
    anomaly_type: AnomalyType
    risk_level: RiskLevel
    description: str
    code_snippet: str
    line_number: Optional[int] = None
    confidence: float = Field(ge=0.0, le=1.0)
    remediation: Optional[str] = None
    evidence: Optional[List[str]] = None


class StaticAnalysisResult(BaseModel):
    syntax_valid: bool
    syntax_error: Optional[str] = None
    pattern_matches: List[AnomalyFinding] = []
    complexity_score: float = 0.0
    code_lines: int = 0


class LlmAnalysisResult(BaseModel):
    semantic_findings: List[AnomalyFinding] = []
    risk_summary: str = ""
    overall_assessment: str = ""


class AuditReport(BaseModel):
    report_id: str
    component_id: str
    component_name: str
    timestamp: datetime
    static_analysis: StaticAnalysisResult
    llm_analysis: LlmAnalysisResult
    overall_score: float = Field(ge=0.0, le=100.0, description="安全评分，0-100，越高越安全")
    risk_level: RiskLevel
    all_findings: List[AnomalyFinding] = []
    recommendations: List[str] = []


class CodeFixRequest(BaseModel):
    component_id: str = Field(..., description="组件唯一标识")
    component_name: str = Field(..., description="组件名称")
    code: str = Field(..., description="待修复的组件源代码")
    language: str = Field(default="javascript", description="代码语言")
    findings: List[AnomalyFinding] = Field(default_factory=list, description="已识别的安全问题")
    fix_scope: Optional[str] = Field(default="all", description="修复范围: all/critical_high/medium_and_above")


class CodeFixDiff(BaseModel):
    line_number: int = Field(..., description="修改的行号")
    original_code: str = Field(..., description="原始代码行")
    fixed_code: str = Field(..., description="修复后代码行")
    change_type: str = Field(..., description="修改类型: replace/insert/delete")
    reason: str = Field(..., description="修改原因")


class CodeFixResult(BaseModel):
    original_code: str = Field(..., description="原始完整代码")
    fixed_code: str = Field(..., description="修复后的完整代码")
    changes: List[CodeFixDiff] = Field(default_factory=list, description="逐行修改明细")
    fix_summary: str = Field(..., description="修复摘要")
    fixed_findings: List[str] = Field(default_factory=list, description="已修复的问题ID列表")
    warning: Optional[str] = Field(None, description="修复时的注意事项")
    estimated_score_improvement: float = Field(
        default=0.0, description="预估安全评分提升幅度"
    )


class AuditResponse(BaseModel):
    success: bool
    message: str
    data: Optional[AuditReport] = None


class CodeFixResponse(BaseModel):
    success: bool
    message: str
    data: Optional[CodeFixResult] = None
