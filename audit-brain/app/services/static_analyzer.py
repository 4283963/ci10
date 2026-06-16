import re
import uuid
from typing import List, Tuple
from app.models.audit_models import (
    StaticAnalysisResult,
    AnomalyFinding,
    AnomalyType,
    RiskLevel,
)


DANGEROUS_PATTERNS = [
    {
        "pattern": r"eval\s*\(",
        "anomaly_type": AnomalyType.UNSAFE_EVAL,
        "risk_level": RiskLevel.HIGH,
        "description": "使用了 eval() 函数，可能导致代码注入攻击",
        "remediation": "避免使用 eval()，改用更安全的替代方案如 JSON.parse() 或安全的解析器",
    },
    {
        "pattern": r"Function\s*\(",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.HIGH,
        "description": "使用了 Function 构造器，存在代码注入风险",
        "remediation": "避免使用 Function 构造器动态创建函数",
    },
    {
        "pattern": r"setTimeout\s*\(\s*['\"]",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.MEDIUM,
        "description": "setTimeout 使用字符串参数，存在代码注入风险",
        "remediation": "使用函数引用而非字符串作为 setTimeout 参数",
    },
    {
        "pattern": r"setInterval\s*\(\s*['\"]",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.MEDIUM,
        "description": "setInterval 使用字符串参数，存在代码注入风险",
        "remediation": "使用函数引用而非字符串作为 setInterval 参数",
    },
    {
        "pattern": r"document\.write\s*\(",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.HIGH,
        "description": "使用 document.write() 可能导致 XSS 攻击",
        "remediation": "使用 textContent 或安全的 DOM 操作方法替代 document.write()",
    },
    {
        "pattern": r"innerHTML\s*=",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.HIGH,
        "description": "直接设置 innerHTML 可能导致 XSS 攻击",
        "remediation": "使用 textContent 或创建 DOM 节点的方式来安全地插入内容",
    },
    {
        "pattern": r"outerHTML\s*=",
        "anomaly_type": AnomalyType.CODE_INJECTION,
        "risk_level": RiskLevel.HIGH,
        "description": "直接设置 outerHTML 可能导致 XSS 攻击",
        "remediation": "使用安全的 DOM 操作方法替代 outerHTML",
    },
    {
        "pattern": r"window\.location\s*=",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.MEDIUM,
        "description": "直接修改 window.location 可能导致开放重定向漏洞",
        "remediation": "对跳转 URL 进行白名单校验",
    },
    {
        "pattern": r"XMLHttpRequest\s*\(",
        "anomaly_type": AnomalyType.UNAUTHORIZED_NETWORK,
        "risk_level": RiskLevel.MEDIUM,
        "description": "使用 XMLHttpRequest 发起网络请求，需确认目标地址的安全性",
        "remediation": "确保请求目标在可信域内，并对响应数据进行安全处理",
    },
    {
        "pattern": r"fetch\s*\(",
        "anomaly_type": AnomalyType.UNAUTHORIZED_NETWORK,
        "risk_level": RiskLevel.MEDIUM,
        "description": "使用 fetch API 发起网络请求，需确认目标地址的安全性",
        "remediation": "确保请求目标在可信域内，并对响应数据进行安全处理",
    },
    {
        "pattern": r"localStorage",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.LOW,
        "description": "使用 localStorage 存储数据，注意敏感数据不应明文存储",
        "remediation": "敏感数据应加密存储或使用服务端存储方案",
    },
    {
        "pattern": r"sessionStorage",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.LOW,
        "description": "使用 sessionStorage 存储数据，注意敏感数据不应明文存储",
        "remediation": "敏感数据应加密存储或使用服务端存储方案",
    },
    {
        "pattern": r"document\.cookie",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.MEDIUM,
        "description": "直接操作 cookie，可能存在安全风险",
        "remediation": "设置 cookie 时使用 secure 和 httpOnly 属性",
    },
    {
        "pattern": r"__proto__\s*:",
        "anomaly_type": AnomalyType.PROTOTYPE_POLLUTION,
        "risk_level": RiskLevel.HIGH,
        "description": "直接修改 __proto__ 属性，存在原型污染风险",
        "remediation": "避免直接操作 __proto__，使用 Object.create(null) 创建纯净对象",
    },
    {
        "pattern": r"constructor\.prototype",
        "anomaly_type": AnomalyType.PROTOTYPE_POLLUTION,
        "risk_level": RiskLevel.HIGH,
        "description": "修改构造函数原型，存在原型污染风险",
        "remediation": "避免修改内置对象的原型",
    },
    {
        "pattern": r"atob\s*\(|btoa\s*\(",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.LOW,
        "description": "使用 base64 编解码，可能用于混淆恶意代码",
        "remediation": "审查 base64 解码后的内容，确保无恶意代码",
    },
    {
        "pattern": r"new\s+WebSocket\s*\(",
        "anomaly_type": AnomalyType.UNAUTHORIZED_NETWORK,
        "risk_level": RiskLevel.MEDIUM,
        "description": "创建 WebSocket 连接，需确认目标地址的安全性",
        "remediation": "确保 WebSocket 连接到可信服务器",
    },
    {
        "pattern": r"postMessage\s*\(",
        "anomaly_type": AnomalyType.DATA_LEAKAGE,
        "risk_level": RiskLevel.MEDIUM,
        "description": "使用 postMessage 进行跨域通信，需验证消息来源",
        "remediation": "接收消息时验证 origin，发送消息时指定目标 origin",
    },
    {
        "pattern": r"window\.open\s*\(",
        "anomaly_type": AnomalyType.UNAUTHORIZED_NETWORK,
        "risk_level": RiskLevel.LOW,
        "description": "使用 window.open 打开新窗口，可能存在钓鱼风险",
        "remediation": "对打开的 URL 进行校验，设置 noopener noreferrer",
    },
    {
        "pattern": r"importScripts\s*\(",
        "anomaly_type": AnomalyType.UNAUTHORIZED_NETWORK,
        "risk_level": RiskLevel.HIGH,
        "description": "importScripts 动态加载脚本，存在代码注入风险",
        "remediation": "确保加载的脚本来自可信源",
    },
]


def _find_line_number(code: str, match_start: int) -> int:
    return code[:match_start].count("\n") + 1


def _extract_snippet(code: str, match_start: int, match_end: int, context_lines: int = 2) -> str:
    lines = code.split("\n")
    line_num = _find_line_number(code, match_start) - 1
    start_line = max(0, line_num - context_lines)
    end_line = min(len(lines), line_num + context_lines + 1)
    return "\n".join(lines[start_line:end_line])


def analyze_syntax(code: str) -> Tuple[bool, str | None]:
    try:
        import ast
        ast.parse(code)
        return True, None
    except SyntaxError as e:
        return False, str(e)
    except Exception:
        return True, None


def calculate_complexity(code: str) -> float:
    lines = code.split("\n")
    code_lines = [l for l in lines if l.strip() and not l.strip().startswith("//")]
    
    complexity_patterns = [
        r"\bif\b", r"\belse\b", r"\bfor\b", r"\bwhile\b", r"\bswitch\b",
        r"\bcatch\b", r"\btry\b", r"\bfunction\b", r"=>",
        r"\b&&\b", r"\|\|\b", r"\?",
    ]
    
    complexity_score = 0.0
    for line in code_lines:
        for pattern in complexity_patterns:
            complexity_score += len(re.findall(pattern, line))
    
    if len(code_lines) > 0:
        complexity_score = complexity_score / len(code_lines)
    
    return round(min(complexity_score, 10.0), 2)


MAX_CODE_LENGTH = 500000
MAX_FINDINGS_PER_PATTERN = 20
MAX_TOTAL_FINDINGS = 100


def analyze_static(code: str) -> StaticAnalysisResult:
    findings: List[AnomalyFinding] = []
    
    if len(code) > MAX_CODE_LENGTH:
        code = code[:MAX_CODE_LENGTH]
        findings.append(
            AnomalyFinding(
                finding_id=f"static-limit-{uuid.uuid4().hex[:8]}",
                anomaly_type=AnomalyType.UNKNOWN,
                risk_level=RiskLevel.MEDIUM,
                description=f"代码过长（超过 {MAX_CODE_LENGTH} 字符），已截断进行静态分析，结果可能不完整",
                code_snippet=f"// 代码已截断，原始长度: {len(code)} 字符",
                line_number=1,
                confidence=0.9,
                remediation="建议拆分过大的组件，减小单文件代码量",
                evidence=[f"原始长度: {len(code)} 字符"],
            )
        )
    
    syntax_valid, syntax_error = analyze_syntax(code)
    
    total_findings = 0
    for pattern_info in DANGEROUS_PATTERNS:
        if total_findings >= MAX_TOTAL_FINDINGS:
            break
            
        pattern = pattern_info["pattern"]
        matches = list(re.finditer(pattern, code, re.IGNORECASE))
        
        if len(matches) > MAX_FINDINGS_PER_PATTERN:
            matches = matches[:MAX_FINDINGS_PER_PATTERN]
        
        for match in matches:
            if total_findings >= MAX_TOTAL_FINDINGS:
                break
                
            line_num = _find_line_number(code, match.start())
            snippet = _extract_snippet(code, match.start(), match.end())
            
            finding = AnomalyFinding(
                finding_id=f"static-{uuid.uuid4().hex[:8]}",
                anomaly_type=pattern_info["anomaly_type"],
                risk_level=pattern_info["risk_level"],
                description=pattern_info["description"],
                code_snippet=snippet,
                line_number=line_num,
                confidence=0.85,
                remediation=pattern_info["remediation"],
                evidence=[match.group()],
            )
            findings.append(finding)
            total_findings += 1
    
    code_lines = len([l for l in code.split("\n") if l.strip()])
    
    if code_lines > 2000:
        complexity_score = 10.0
    else:
        complexity_score = calculate_complexity(code)
    
    return StaticAnalysisResult(
        syntax_valid=syntax_valid,
        syntax_error=syntax_error,
        pattern_matches=findings,
        complexity_score=complexity_score,
        code_lines=code_lines,
    )
