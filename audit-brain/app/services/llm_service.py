import json
import uuid
import httpx
from retrying import retry
from typing import List

from app.config import settings
from app.models.audit_models import (
    LlmAnalysisResult,
    AnomalyFinding,
    AnomalyType,
    RiskLevel,
    ComponentSource,
)


SYSTEM_PROMPT = """你是一位专业的代码安全审计专家，专注于低代码组件的安全审查。
请对给定的组件代码进行深入的语义安全分析，识别潜在的安全风险和异常行为。

分析维度包括：
1. 代码注入风险（eval、Function 构造器、动态执行等）
2. 数据泄露风险（敏感信息存储、不安全的数据传输等）
3. 未授权网络访问（可疑的网络请求、跨域通信等）
4. 原型污染风险
5. 内存操作和越权访问
6. 恶意代码混淆
7. 权限提升和沙箱逃逸
8. 逻辑漏洞和业务安全问题

请以严格、专业的态度进行分析，不要漏报任何潜在风险。"""


USER_PROMPT_TEMPLATE = """请对以下低代码组件进行安全审计：

组件信息：
- 组件ID: {component_id}
- 组件名称: {component_name}
- 代码语言: {language}
- 组件类型: {component_type}

组件源代码：
```
{code}
```

运行时日志（如有）：
```
{runtime_logs}
```

请输出JSON格式的分析结果，格式如下：
{{
  "semantic_findings": [
    {{
      "anomaly_type": "code_injection|data_leakage|unauthorized_network|unsafe_eval|sensitive_api|memory_tampering|prototype_pollution|unknown",
      "risk_level": "critical|high|medium|low|info",
      "description": "详细描述问题",
      "code_snippet": "相关代码片段",
      "line_number": 行号,
      "confidence": 0.0到1.0之间的置信度,
      "remediation": "修复建议",
      "evidence": ["证据1", "证据2"]
    }}
  ],
  "risk_summary": "整体风险摘要",
  "overall_assessment": "整体安全评估"
}}

只输出JSON，不要有其他文字。"""


def _retry_on_exception(exception: Exception) -> bool:
    return isinstance(exception, (httpx.HTTPError, httpx.TimeoutException))


@retry(
    retry_on_exception=_retry_on_exception,
    stop_max_attempt_number=3,
    wait_exponential_multiplier=1000,
    wait_exponential_max=10000,
)
async def call_llm_api(prompt: str) -> str:
    if not settings.LLM_API_KEY:
        raise ValueError("LLM_API_KEY is not configured")

    url = f"{settings.LLM_API_BASE}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
    }
    payload = {
        "model": settings.LLM_MODEL,
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": settings.LLM_MAX_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def _parse_llm_response(response_text: str) -> dict:
    response_text = response_text.strip()
    if response_text.startswith("```"):
        response_text = response_text.strip("`")
        if response_text.lower().startswith("json"):
            response_text = response_text[4:].strip()
    
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        json_start = response_text.find("{")
        json_end = response_text.rfind("}")
        if json_start != -1 and json_end != -1:
            json_str = response_text[json_start : json_end + 1]
            return json.loads(json_str)
        raise


async def analyze_with_llm(component: ComponentSource) -> LlmAnalysisResult:
    if not settings.LLM_ANALYSIS_ENABLED or not settings.LLM_API_KEY:
        return LlmAnalysisResult(
            semantic_findings=[],
            risk_summary="LLM分析未启用或未配置API密钥",
            overall_assessment="跳过LLM语义分析",
        )

    prompt = USER_PROMPT_TEMPLATE.format(
        component_id=component.component_id,
        component_name=component.component_name,
        language=component.language,
        component_type=component.component_type,
        code=component.code,
        runtime_logs=component.runtime_logs or "无",
    )

    try:
        response_text = await call_llm_api(prompt)
        result = _parse_llm_response(response_text)

        findings: List[AnomalyFinding] = []
        for item in result.get("semantic_findings", []):
            finding = AnomalyFinding(
                finding_id=f"llm-{uuid.uuid4().hex[:8]}",
                anomaly_type=AnomalyType(item.get("anomaly_type", "unknown")),
                risk_level=RiskLevel(item.get("risk_level", "medium")),
                description=item.get("description", ""),
                code_snippet=item.get("code_snippet", ""),
                line_number=item.get("line_number"),
                confidence=float(item.get("confidence", 0.7)),
                remediation=item.get("remediation"),
                evidence=item.get("evidence"),
            )
            findings.append(finding)

        return LlmAnalysisResult(
            semantic_findings=findings,
            risk_summary=result.get("risk_summary", ""),
            overall_assessment=result.get("overall_assessment", ""),
        )

    except Exception as e:
        return LlmAnalysisResult(
            semantic_findings=[],
            risk_summary=f"LLM分析失败: {str(e)}",
            overall_assessment="LLM分析异常，结果可能不完整",
        )
