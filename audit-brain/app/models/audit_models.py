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


class AuditResponse(BaseModel):
    success: bool
    message: str
    data: Optional[AuditReport] = None
