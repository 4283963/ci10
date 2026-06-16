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
    CodeFixRequest,
    CodeFixResult,
    CodeFixDiff,
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


CODE_FIX_SYSTEM_PROMPT = """你是一位资深的代码安全修复专家，专注于修复低代码组件中的安全漏洞。
你的职责是：
1. 精确修复代码中的安全问题，保持原有业务逻辑不变
2. 不改变代码的输入输出接口和正常功能
3. 对每个修改提供清晰的修改说明

修复原则：
- eval() → JSON.parse() 或安全解析函数
- innerHTML → textContent 或 createElement/DOM 操作
- document.write() → 安全 DOM 方法
- __proto__ / prototype 修改 → 使用 Object.create(null) 或 Map
- localStorage/sessionStorage 存储敏感信息 → 移除或加密提示
- fetch/XHR 无白名单 → 增加域名校验
- 死循环/嵌套循环过深 → 增加循环保护或重构
- document.cookie 直接设置 → 增加 secure/httpOnly 属性说明

非常重要：
1. 必须保留所有原有的非安全相关代码逻辑
2. 只修改有安全问题的代码行
3. 修复后的代码必须语法正确、可以直接运行"""


CODE_FIX_PROMPT_TEMPLATE = """请修复以下低代码组件中的安全问题。

组件信息：
- 组件ID: {component_id}
- 组件名称: {component_name}
- 代码语言: {language}

已识别的安全问题：
{findings_summary}

需要修复的范围: {fix_scope}
（说明: all=全部问题, critical_high=只修严重和高危, medium_and_above=修中危及以上）

原始代码：
```
{code}
```

请严格按以下 JSON 格式输出修复结果，不要包含其他文字：
{{
  "fixed_code": "完整的修复后代码，必须包含所有原始逻辑",
  "fix_summary": "简要说明修复了哪些问题，修复思路是什么",
  "estimated_score_improvement": 预估安全评分能提升多少分（0到100之间的数字）,
  "changes": [
    {{
      "line_number": 行号（原始代码中的行号，整数）,
      "original_code": "原始代码内容",
      "fixed_code": "修复后的代码内容",
      "change_type": "replace|insert|delete",
      "reason": "为什么要做这个修改"
    }}
  ],
  "fixed_findings": ["已修复的问题ID1", "已修复的问题ID2"],
  "warning": "是否需要人工确认的注意事项，可为空字符串"
}}"""


FINDING_LABELS = {
    "critical": "【严重】",
    "high": "【高危】",
    "medium": "【中危】",
    "low": "【低危】",
    "info": "【信息】",
}


def _format_findings_for_prompt(findings: List[AnomalyFinding]) -> str:
    if not findings:
        return "（无已识别的具体问题，基于通用安全规范进行全面优化）"

    lines = []
    for i, f in enumerate(findings, 1):
        level_label = FINDING_LABELS.get(f.risk_level.value, "")
        line_info = f"第{f.line_number}行" if f.line_number else "位置未知"
        lines.append(
            f"{i}. {level_label} {f.description} ({line_info})\n"
            f"   类型: {f.anomaly_type.value}\n"
            f"   建议: {f.remediation or '请根据通用规范修复'}"
        )
    return "\n".join(lines)


def _parse_fix_result(raw: dict, original_code: str, findings: List[AnomalyFinding]) -> CodeFixResult:
    changes_data = raw.get("changes", [])
    changes: List[CodeFixDiff] = []

    for c in changes_data:
        try:
            changes.append(CodeFixDiff(
                line_number=int(c.get("line_number", 0)),
                original_code=str(c.get("original_code", "")),
                fixed_code=str(c.get("fixed_code", "")),
                change_type=str(c.get("change_type", "replace")),
                reason=str(c.get("reason", "")),
            ))
        except Exception:
            continue

    fixed_code = str(raw.get("fixed_code", original_code)).strip()
    if not fixed_code:
        fixed_code = original_code

    fixed_ids = raw.get("fixed_findings", [])
    if isinstance(fixed_ids, list):
        fixed_id_list = [str(x) for x in fixed_ids]
    else:
        fixed_id_list = [f.finding_id for f in findings]

    estimated = float(raw.get("estimated_score_improvement", 0.0))
    if estimated < 0:
        estimated = 0.0
    if estimated > 100:
        estimated = 100.0

    return CodeFixResult(
        original_code=original_code,
        fixed_code=fixed_code,
        changes=changes,
        fix_summary=str(raw.get("fix_summary", "已按通用安全规范进行修复")),
        fixed_findings=fixed_id_list,
        warning=str(raw.get("warning", "")) or None,
        estimated_score_improvement=round(estimated, 1),
    )


def _apply_local_fixes(code: str) -> Tuple[str, List[CodeFixDiff], str, float]:
    """
    本地规则修复（无需 LLM，作为降级方案）
    """
    import re as _re

    changes: List[CodeFixDiff] = []
    lines = code.split("\n")
    fixed_lines = list(lines)
    score_improve = 0.0
    summary_parts = []

    for i, line in enumerate(lines):
        line_num = i + 1
        original = line
        new_line = line

        if "eval(" in line and not line.strip().startswith("//"):
            new_line = new_line.replace("eval(", "JSON.parse(")
            score_improve += 15
            summary_parts.append(f"第{line_num}行: eval() → JSON.parse()")

        if ".innerHTML =" in line and not line.strip().startswith("//"):
            new_line = new_line.replace(".innerHTML =", ".textContent =")
            score_improve += 12
            summary_parts.append(f"第{line_num}行: innerHTML → textContent")

        if "document.write(" in line and not line.strip().startswith("//"):
            indent = len(line) - len(line.lstrip())
            new_line = (
                " " * indent
                + "// [已移除] document.write() 存在XSS风险，请使用 DOM API 替代"
            )
            score_improve += 10
            summary_parts.append(f"第{line_num}行: 注释掉 document.write()")

        if "__proto__" in line and not line.strip().startswith("//"):
            new_line = "// " + new_line + "  // [已注释] __proto__修改存在原型污染风险"
            score_improve += 10
            summary_parts.append(f"第{line_num}行: 注释掉 __proto__ 修改")

        if "localStorage.setItem(" in line and "token" in line.lower():
            new_line = new_line.replace(
                "localStorage.setItem(",
                "// [建议加密] localStorage.setItem("
            )
            score_improve += 5
            summary_parts.append(f"第{line_num}行: 标记敏感信息存储需加密")

        if new_line != original:
            fixed_lines[i] = new_line
            changes.append(CodeFixDiff(
                line_number=line_num,
                original_code=original,
                fixed_code=new_line,
                change_type="replace",
                reason=summary_parts[-1] if summary_parts else "安全修复",
            ))

    fixed_code = "\n".join(fixed_lines)
    summary = "本地规则快速修复: " + "；".join(summary_parts) if summary_parts else "未识别到可自动修复的通用安全问题"

    return fixed_code, changes, summary, min(score_improve, 60.0)


async def fix_code_with_llm(request: CodeFixRequest) -> CodeFixResult:
    """
    代码修复入口，带两级降级：
    Level 1: LLM 智能修复（结合已知问题）
    Level 2: 本地规则快速修复（LLM 不可用时的保底方案）
    """
    original_code = request.code
    findings = request.findings or []

    if request.fix_scope != "all":
        scope = request.fix_scope
        filtered = []
        for f in findings:
            if scope == "critical_high" and f.risk_level.value in ("critical", "high"):
                filtered.append(f)
            elif scope == "medium_and_above" and f.risk_level.value in ("critical", "high", "medium"):
                filtered.append(f)
            elif scope == "all":
                filtered.append(f)
        findings = filtered

    if not settings.LLM_ANALYSIS_ENABLED or not settings.LLM_API_KEY:
        fixed_code, changes, summary, score_improve = _apply_local_fixes(original_code)
        return CodeFixResult(
            original_code=original_code,
            fixed_code=fixed_code,
            changes=changes,
            fix_summary=summary + "（LLM未启用，已使用本地规则）",
            fixed_findings=[f.finding_id for f in findings],
            warning="LLM服务未配置，仅执行了本地规则修复。建议启用LLM以获得更精准的修复结果。",
            estimated_score_improvement=score_improve,
        )

    findings_summary = _format_findings_for_prompt(findings)
    scope_label = {
        "all": "全部安全问题",
        "critical_high": "仅严重和高危",
        "medium_and_above": "中危及以上",
    }.get(request.fix_scope or "all", "全部安全问题")

    code_tokens = _estimate_tokens(original_code)
    available_tokens = settings.LLM_MAX_INPUT_TOKENS - _estimate_tokens(CODE_FIX_SYSTEM_PROMPT) - settings.LLM_MAX_TOKENS - 1000

    work_code = original_code
    truncation_warning = ""
    if code_tokens > available_tokens and available_tokens > 0:
        work_code, was_truncated = _truncate_code_smart(original_code, int(available_tokens * 0.9))
        if was_truncated:
            truncation_warning = "代码过长，已截取核心部分进行修复，完整修复请人工确认。"

    prompt = CODE_FIX_PROMPT_TEMPLATE.format(
        component_id=request.component_id,
        component_name=request.component_name,
        language=request.language,
        findings_summary=findings_summary,
        fix_scope=scope_label,
        code=work_code,
    )

    try:
        output_tokens = min(settings.LLM_MAX_TOKENS * 2, 4096)
        response_text = await call_llm_api(prompt, max_tokens=output_tokens)
        raw = _parse_llm_response(response_text)

        result = _parse_fix_result(raw, original_code, findings)
        if truncation_warning:
            if result.warning:
                result.warning = truncation_warning + " " + result.warning
            else:
                result.warning = truncation_warning

        if not result.changes and result.fixed_code == original_code:
            fixed_code, changes, summary, score_improve = _apply_local_fixes(original_code)
            if fixed_code != original_code:
                result.fixed_code = fixed_code
                result.changes = changes
                result.fix_summary = summary
                result.estimated_score_improvement = max(result.estimated_score_improvement, score_improve)

        return result

    except TokenLimitExceededError:
        fixed_code, changes, summary, score_improve = _apply_local_fixes(original_code)
        return CodeFixResult(
            original_code=original_code,
            fixed_code=fixed_code,
            changes=changes,
            fix_summary="（Token超限降级）" + summary,
            fixed_findings=[f.finding_id for f in findings],
            warning="输入代码过长导致LLM调用失败，已使用本地规则进行基础修复。建议拆分代码后重试。",
            estimated_score_improvement=score_improve,
        )

    except Exception as e:
        fixed_code, changes, summary, score_improve = _apply_local_fixes(original_code)
        warning = f"LLM修复失败: {str(e)[:80]}，已使用本地规则修复"
        return CodeFixResult(
            original_code=original_code,
            fixed_code=fixed_code,
            changes=changes,
            fix_summary="（LLM降级）" + summary,
            fixed_findings=[f.finding_id for f in findings],
            warning=warning,
            estimated_score_improvement=score_improve,
        )
