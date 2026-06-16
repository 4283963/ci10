import uuid
from datetime import datetime
from typing import List

from app.models.audit_models import (
    ComponentSource,
    AuditReport,
    AnomalyFinding,
    AuditResponse,
)
from app.services.static_analyzer import analyze_static
from app.services.llm_service import analyze_with_llm
from app.services.risk_scorer import (
    calculate_risk_score,
    determine_risk_level,
    generate_recommendations,
)


def _deduplicate_findings(findings: List[AnomalyFinding]) -> List[AnomalyFinding]:
    seen = set()
    unique = []
    for finding in findings:
        key = (
            finding.anomaly_type.value,
            finding.code_snippet.strip()[:80],
            finding.line_number,
        )
        if key not in seen:
            seen.add(key)
            unique.append(finding)
    return unique


async def perform_audit(component: ComponentSource) -> AuditResponse:
    try:
        static_result = analyze_static(component.code)
        llm_result = await analyze_with_llm(component)

        all_findings = static_result.pattern_matches + llm_result.semantic_findings
        all_findings = _deduplicate_findings(all_findings)

        all_findings.sort(
            key=lambda f: (
                {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}[
                    f.risk_level.value
                ],
                -f.confidence,
            )
        )

        overall_score = calculate_risk_score(static_result, llm_result)
        risk_level = determine_risk_level(overall_score, all_findings)
        recommendations = generate_recommendations(static_result, llm_result)

        report = AuditReport(
            report_id=f"report-{uuid.uuid4().hex[:12]}",
            component_id=component.component_id,
            component_name=component.component_name,
            timestamp=datetime.utcnow(),
            static_analysis=static_result,
            llm_analysis=llm_result,
            overall_score=overall_score,
            risk_level=risk_level,
            all_findings=all_findings,
            recommendations=recommendations,
        )

        return AuditResponse(
            success=True,
            message="审计完成",
            data=report,
        )

    except Exception as e:
        return AuditResponse(
            success=False,
            message=f"审计失败: {str(e)}",
            data=None,
        )


def batch_audit(components: List[ComponentSource]) -> List[AuditResponse]:
    results = []
    for component in components:
        result = perform_audit(component)
        results.append(result)
    return results
