from typing import List
from app.config import settings
from app.models.audit_models import (
    AnomalyFinding,
    RiskLevel,
    StaticAnalysisResult,
    LlmAnalysisResult,
)


def calculate_risk_score(
    static_result: StaticAnalysisResult,
    llm_result: LlmAnalysisResult,
) -> float:
    all_findings = static_result.pattern_matches + llm_result.semantic_findings
    
    if not all_findings:
        return 95.0
    
    total_penalty = 0.0
    seen_findings = set()
    
    for finding in all_findings:
        finding_key = (finding.anomaly_type.value, finding.code_snippet.strip()[:50])
        if finding_key in seen_findings:
            continue
        seen_findings.add(finding_key)
        
        base_weight = settings.RISK_WEIGHTS.get(finding.risk_level.value, 1)
        confidence_factor = finding.confidence
        penalty = base_weight * confidence_factor
        total_penalty += penalty
    
    base_score = 100.0
    final_score = base_score - total_penalty
    
    if not static_result.syntax_valid:
        final_score -= 10
    
    complexity_factor = static_result.complexity_score * 0.5
    final_score -= complexity_factor
    
    final_score = max(0.0, min(100.0, final_score))
    
    return round(final_score, 1)


def determine_risk_level(score: float, findings: List[AnomalyFinding]) -> RiskLevel:
    has_critical = any(f.risk_level == RiskLevel.CRITICAL for f in findings)
    has_high = any(f.risk_level == RiskLevel.HIGH for f in findings)
    
    if has_critical or score < 40:
        return RiskLevel.CRITICAL
    elif has_high or score < 60:
        return RiskLevel.HIGH
    elif score < 75:
        return RiskLevel.MEDIUM
    elif score < 90:
        return RiskLevel.LOW
    else:
        return RiskLevel.INFO


def generate_recommendations(
    static_result: StaticAnalysisResult,
    llm_result: LlmAnalysisResult,
) -> List[str]:
    recommendations = []
    all_findings = static_result.pattern_matches + llm_result.semantic_findings
    
    if not static_result.syntax_valid:
        recommendations.append("修复代码语法错误，确保代码可以正常解析")
    
    risk_types = set()
    for finding in all_findings:
        if finding.risk_level in (RiskLevel.CRITICAL, RiskLevel.HIGH):
            risk_types.add(finding.anomaly_type.value)
    
    risk_recommendations = {
        "code_injection": "对所有用户输入进行严格的输入验证和输出编码，避免使用动态代码执行函数",
        "data_leakage": "敏感数据应加密存储，避免在客户端存储敏感信息，使用安全的传输协议",
        "unauthorized_network": "实施严格的网络白名单策略，验证所有外部请求的目标地址",
        "unsafe_eval": "彻底移除 eval()、Function() 等动态代码执行函数，使用安全替代方案",
        "sensitive_api": "限制对敏感API的访问，实施最小权限原则",
        "memory_tampering": "避免直接操作内存对象，使用安全的数据访问模式",
        "prototype_pollution": "使用 Object.create(null) 创建纯净对象，避免直接修改原型",
        "unknown": "进行全面的代码安全审查，识别未知风险模式",
    }
    
    for risk_type in risk_types:
        if risk_type in risk_recommendations:
            recommendations.append(risk_recommendations[risk_type])
    
    if static_result.complexity_score > 5:
        recommendations.append("代码复杂度较高，建议重构以降低维护和安全审计难度")
    
    if not recommendations:
        recommendations.append("代码整体安全状况良好，建议持续监控并定期进行安全审计")
    
    return recommendations
