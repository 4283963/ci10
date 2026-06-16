import json
import uuid
import math
import httpx
from retrying import retry
from typing import List, Optional, Tuple

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


USER_PROMPT_TEMPLATE_SHORT = """审计以下低代码组件的安全性：

组件：{component_name}
代码：
```
{code}
```

输出JSON：
{{"semantic_findings": [{{"anomaly_type": "...", "risk_level": "...", "description": "...", "confidence": 0.0}}], "risk_summary": "...", "overall_assessment": "..."}}
只输出JSON。"""


def _estimate_tokens(text: str) -> int:
    """
    粗略估算 token 数量：英文约 0.75 字符/token，中文约 1.5 字符/token
    这里采用保守估算策略，宁多勿少，避免超限
    """
    if not text:
        return 0
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars
    tokens_chinese = math.ceil(chinese_chars / 1.2)
    tokens_other = math.ceil(other_chars / 3.5)
    return tokens_chinese + tokens_other


def _truncate_code_smart(code: str, max_tokens: int, preserve_top_ratio: float = 0.6) -> Tuple[str, bool]:
    """
    智能截断代码：保留前部分（入口）和后部分（收尾），中间截断
    返回 (截断后的代码, 是否被截断)
    """
    code_tokens = _estimate_tokens(code)
    if code_tokens <= max_tokens:
        return code, False

    lines = code.split('\n')
    total_lines = len(lines)
    
    if total_lines <= 20:
        return code, False
    
    top_lines_count = int(total_lines * preserve_top_ratio)
    bottom_lines_count = total_lines - top_lines_count - 10
    if bottom_lines_count < 5:
        bottom_lines_count = min(5, total_lines - top_lines_count)
    
    top_part = '\n'.join(lines[:top_lines_count])
    bottom_part = '\n'.join(lines[-bottom_lines_count:]) if bottom_lines_count > 0 else ''
    
    truncated = f"{top_part}\n\n// ... [代码已智能截断，中间省略约 {total_lines - top_lines_count - bottom_lines_count} 行] ...\n\n{bottom_part}"
    
    while _estimate_tokens(truncated) > max_tokens and top_lines_count > 10:
        top_lines_count -= 5
        top_part = '\n'.join(lines[:top_lines_count])
        truncated = f"{top_part}\n\n// ... [代码已截断] ...\n\n{bottom_part}"
    
    return truncated, True


def _extract_code_skeleton(code: str) -> str:
    """
    提取代码骨架（函数声明、关键调用），用于超长代码的降级分析
    """
    lines = code.split('\n')
    skeleton_lines = []
    for line in lines:
        stripped = line.strip()
        if (
            stripped.startswith('function ')
            or stripped.startswith('const ')
            or stripped.startswith('let ')
            or stripped.startswith('var ')
            or stripped.startswith('class ')
            or stripped.startswith('return ')
            or 'eval(' in stripped
            or 'Function(' in stripped
            or 'innerHTML' in stripped
            or 'fetch(' in stripped
            or 'XMLHttpRequest' in stripped
            or 'localStorage' in stripped
            or '__proto__' in stripped
            or 'prototype' in stripped
            or 'document.cookie' in stripped
            or 'window.location' in stripped
            or 'importScripts' in stripped
            or 'postMessage' in stripped
            or 'WebSocket' in stripped
            or 'window.open' in stripped
        ):
            skeleton_lines.append(line)
    
    return '\n'.join(skeleton_lines[:200])


def _retry_on_exception(exception: Exception) -> bool:
    """
    只对网络/超时错误重试，对 token 超限等不可恢复错误不重试
    """
    if isinstance(exception, (httpx.HTTPError, httpx.TimeoutException)):
        return True
    
    if isinstance(exception, httpx.HTTPStatusError):
        if exception.response.status_code == 429:
            return True
        if exception.response.status_code == 500:
            return True
        if exception.response.status_code >= 500:
            return True
    
    return False


@retry(
    retry_on_exception=_retry_on_exception,
    stop_max_attempt_number=2,
    wait_exponential_multiplier=1000,
    wait_exponential_max=5000,
)
async def call_llm_api(prompt: str, max_tokens: Optional[int] = None) -> str:
    if not settings.LLM_API_KEY:
        raise ValueError("LLM_API_KEY is not configured")

    output_tokens = max_tokens if max_tokens else settings.LLM_MAX_TOKENS
    
    url = f"{settings.LLM_API_BASE}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
    }
    payload = {
        "model": settings.LLM_MODEL,
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": output_tokens,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            try:
                error_body = e.response.json()
                error_msg = error_body.get("error", {}).get("message", "")
                if "token" in error_msg.lower() and ("limit" in error_msg.lower() or "maximum" in error_msg.lower() or "exceed" in error_msg.lower()):
                    raise TokenLimitExceededError(f"Token 超出限制: {error_msg}")
            except Exception:
                pass
        raise


class TokenLimitExceededError(Exception):
    """Token 超出限制错误"""
    pass


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
        raise ValueError(f"无法解析 LLM 响应为 JSON: {response_text[:200]}")


def _build_findings_from_result(result: dict) -> List[AnomalyFinding]:
    findings: List[AnomalyFinding] = []
    for item in result.get("semantic_findings", []):
        try:
            anomaly_type_str = item.get("anomaly_type", "unknown")
            try:
                anomaly_type = AnomalyType(anomaly_type_str)
            except ValueError:
                anomaly_type = AnomalyType.UNKNOWN
            
            risk_level_str = item.get("risk_level", "medium")
            try:
                risk_level = RiskLevel(risk_level_str)
            except ValueError:
                risk_level = RiskLevel.MEDIUM
            
            finding = AnomalyFinding(
                finding_id=f"llm-{uuid.uuid4().hex[:8]}",
                anomaly_type=anomaly_type,
                risk_level=risk_level,
                description=item.get("description", ""),
                code_snippet=item.get("code_snippet", ""),
                line_number=item.get("line_number"),
                confidence=float(item.get("confidence", 0.7)),
                remediation=item.get("remediation"),
                evidence=item.get("evidence"),
            )
            findings.append(finding)
        except Exception:
            continue
    return findings


async def analyze_with_llm(component: ComponentSource) -> LlmAnalysisResult:
    """
    LLM 分析入口，带多级降级策略：
    Level 0: 完整代码 + 完整 Prompt (正常情况)
    Level 1: 智能截断代码 + 完整 Prompt (代码过长时)
    Level 2: 代码骨架 + 简短 Prompt (仍超限时)
    Level 3: 完全降级，返回空结果 (彻底失败时)
    """
    if not settings.LLM_ANALYSIS_ENABLED or not settings.LLM_API_KEY:
        return LlmAnalysisResult(
            semantic_findings=[],
            risk_summary="LLM分析未启用或未配置API密钥",
            overall_assessment="跳过LLM语义分析",
        )

    code = component.code or ""
    system_tokens = _estimate_tokens(SYSTEM_PROMPT)
    
    max_total_input_tokens = settings.LLM_MAX_INPUT_TOKENS
    max_output_tokens = settings.LLM_MAX_TOKENS
    available_input_tokens = max_total_input_tokens - system_tokens - max_output_tokens - 200
    
    if available_input_tokens < 500:
        available_input_tokens = 500

    levels_to_try = []
    
    code_tokens = _estimate_tokens(code)
    logs_tokens = _estimate_tokens(component.runtime_logs or "")
    base_prompt_tokens = 500
    
    total_approx = code_tokens + logs_tokens + base_prompt_tokens
    
    if total_approx <= available_input_tokens:
        levels_to_try.append("full")
    else:
        truncated_code, was_truncated = _truncate_code_smart(code, int(available_input_tokens * 0.7))
        if was_truncated:
            levels_to_try.append("truncated")
        
        skeleton_code = _extract_code_skeleton(code)
        skeleton_tokens = _estimate_tokens(skeleton_code)
        if skeleton_tokens < available_input_tokens * 0.5:
            levels_to_try.append("skeleton")
    
    if not levels_to_try:
        levels_to_try = ["skeleton"]
    
    warnings = []
    
    for level in levels_to_try:
        try:
            if level == "full":
                prompt = USER_PROMPT_TEMPLATE.format(
                    component_id=component.component_id,
                    component_name=component.component_name,
                    language=component.language,
                    component_type=component.component_type,
                    code=code,
                    runtime_logs=component.runtime_logs or "无",
                )
            elif level == "truncated":
                truncated_code, _ = _truncate_code_smart(code, int(available_input_tokens * 0.7))
                warnings.append(f"代码过长，已智能截断后进行分析 (原始 {code_tokens} tokens)")
                prompt = USER_PROMPT_TEMPLATE.format(
                    component_id=component.component_id,
                    component_name=component.component_name,
                    language=component.language,
                    component_type=component.component_type,
                    code=truncated_code,
                    runtime_logs=component.runtime_logs or "无",
                )
            else:
                skeleton_code = _extract_code_skeleton(code)
                warnings.append("代码过长，使用代码骨架进行降级分析，结果可能不完整")
                prompt = USER_PROMPT_TEMPLATE_SHORT.format(
                    component_name=component.component_name,
                    code=skeleton_code,
                )
            
            prompt_tokens = _estimate_tokens(prompt)
            output_tokens = min(max_output_tokens, max_total_input_tokens - system_tokens - prompt_tokens - 100)
            output_tokens = max(output_tokens, 200)
            
            response_text = await call_llm_api(prompt, max_tokens=output_tokens)
            result = _parse_llm_response(response_text)
            findings = _build_findings_from_result(result)
            
            risk_summary = result.get("risk_summary", "")
            overall_assessment = result.get("overall_assessment", "")
            
            if warnings:
                risk_summary = " | ".join(warnings) + " | " + risk_summary
                overall_assessment = "【提示】" + "；".join(warnings) + "\n" + overall_assessment
            
            return LlmAnalysisResult(
                semantic_findings=findings,
                risk_summary=risk_summary,
                overall_assessment=overall_assessment,
            )
        
        except TokenLimitExceededError:
            continue
        
        except httpx.TimeoutException:
            warnings.append("LLM 调用超时")
            continue
        
        except Exception as e:
            warnings.append(f"LLM 调用异常 (level={level}): {str(e)[:100]}")
            continue
    
    return LlmAnalysisResult(
        semantic_findings=[],
        risk_summary="LLM分析失败，所有降级策略均未成功: " + "; ".join(warnings),
        overall_assessment="LLM 语义分析不可用，请参考静态分析结果。原因：" + "; ".join(warnings[:3]),
    )
