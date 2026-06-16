package com.audit.gateway.service;

import com.audit.gateway.config.AuditBrainProperties;
import com.audit.gateway.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
public class AuditBrainService {

    private final RestTemplate restTemplate;
    private final RestTemplate healthCheckRestTemplate;
    private final AuditBrainProperties auditBrainProperties;
    private final ObjectMapper objectMapper;

    private final AtomicLong lastFailureTime = new AtomicLong(0);
    private final AtomicLong consecutiveFailures = new AtomicLong(0);
    private static final long CIRCUIT_BREAKER_DURATION_MS = 10000;
    private static final int MAX_CONSECUTIVE_FAILURES = 5;

    public AuditBrainService(RestTemplate restTemplate,
                             @Qualifier("healthCheckRestTemplate") RestTemplate healthCheckRestTemplate,
                             AuditBrainProperties auditBrainProperties,
                             ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.healthCheckRestTemplate = healthCheckRestTemplate;
        this.auditBrainProperties = auditBrainProperties;
        this.objectMapper = objectMapper;
    }

    private boolean isCircuitBreakerOpen() {
        long failures = consecutiveFailures.get();
        if (failures < MAX_CONSECUTIVE_FAILURES) {
            return false;
        }
        long elapsed = System.currentTimeMillis() - lastFailureTime.get();
        return elapsed < CIRCUIT_BREAKER_DURATION_MS;
    }

    private void recordSuccess() {
        consecutiveFailures.set(0);
    }

    private void recordFailure() {
        lastFailureTime.set(System.currentTimeMillis());
        consecutiveFailures.incrementAndGet();
    }

    public AuditReport auditComponent(ComponentSource component) {
        if (isCircuitBreakerOpen()) {
            log.warn("熔断器已打开，快速失败，连续失败次数: {}", consecutiveFailures.get());
            return buildFallbackReport(component, "审计服务临时不可用（熔断器打开），仅返回静态分析结果");
        }

        String url = buildUrl("/api/v1/audit");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<ComponentSource> request = new HttpEntity<>(component, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Boolean success = (Boolean) body.get("success");
                if (Boolean.TRUE.equals(success)) {
                    recordSuccess();
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    return convertToAuditReport(data);
                } else {
                    String message = (String) body.get("message");
                    log.warn("审计服务返回失败: {}", message);
                    recordFailure();
                    return buildFallbackReport(component, "审计服务异常: " + message);
                }
            }

            recordFailure();
            return buildFallbackReport(component, "审计服务响应异常");

        } catch (ResourceAccessException e) {
            log.error("调用审计大脑服务超时或连接失败: {}", e.getMessage());
            recordFailure();
            return buildFallbackReport(component, "审计服务连接超时");
        } catch (Exception e) {
            log.error("调用审计大脑服务失败: {}", e.getMessage(), e);
            recordFailure();
            return buildFallbackReport(component, "调用审计服务失败: " + e.getMessage());
        }
    }

    public List<AuditReport> batchAudit(List<ComponentSource> components) {
        if (isCircuitBreakerOpen()) {
            List<AuditReport> fallbacks = new ArrayList<>();
            for (ComponentSource component : components) {
                fallbacks.add(buildFallbackReport(component, "审计服务临时不可用（熔断器打开）"));
            }
            return fallbacks;
        }

        String url = buildUrl("/api/v1/audit/batch");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<List<ComponentSource>> request = new HttpEntity<>(components, headers);

            ResponseEntity<List> response = restTemplate.postForEntity(url, request, List.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                recordSuccess();
                return (List<AuditReport>) response.getBody();
            }

            recordFailure();
            return buildFallbackBatch(components, "批量审计服务响应异常");

        } catch (Exception e) {
            log.error("调用批量审计服务失败: {}", e.getMessage(), e);
            recordFailure();
            return buildFallbackBatch(components, "批量审计失败: " + e.getMessage());
        }
    }

    private List<AuditReport> buildFallbackBatch(List<ComponentSource> components, String reason) {
        List<AuditReport> reports = new ArrayList<>();
        for (ComponentSource component : components) {
            reports.add(buildFallbackReport(component, reason));
        }
        return reports;
    }

    private AuditReport buildFallbackReport(ComponentSource component, String reason) {
        log.info("为组件 {} 返回降级审计报告，原因: {}", component.getComponentId(), reason);

        List<AnomalyFinding> findings = new ArrayList<>();
        findings.add(AnomalyFinding.builder()
                .findingId("fallback-" + UUID.randomUUID().toString().substring(0, 8))
                .anomalyType(AnomalyType.UNKNOWN)
                .riskLevel(RiskLevel.MEDIUM)
                .description("AI 审计服务不可用，仅完成基础静态检查。原因: " + reason)
                .codeSnippet("// AI 审计降级模式")
                .confidence(0.5)
                .remediation("请检查审计大脑服务状态，恢复后可获得更准确的审计结果")
                .evidence(List.of(reason))
                .build());

        return AuditReport.builder()
                .reportId("fallback-" + UUID.randomUUID().toString().substring(0, 12))
                .componentId(component.getComponentId())
                .componentName(component.getComponentName())
                .timestamp(LocalDateTime.now())
                .staticAnalysis(StaticAnalysisResult.builder()
                        .syntaxValid(true)
                        .patternMatches(Collections.emptyList())
                        .complexityScore(0.0)
                        .codeLines(component.getCode() != null ?
                                (int) component.getCode().lines().count() : 0)
                        .build())
                .llmAnalysis(LlmAnalysisResult.builder()
                        .semanticFindings(Collections.emptyList())
                        .riskSummary("AI 语义分析不可用")
                        .overallAssessment("由于 AI 审计服务不可用，本次审计结果不完整。" + reason)
                        .build())
                .overallScore(60.0)
                .riskLevel(RiskLevel.MEDIUM)
                .allFindings(findings)
                .recommendations(List.of(
                        "AI 审计服务暂时不可用，本次结果为降级模式",
                        "建议稍后重试以获得完整的 AI 语义分析结果",
                        reason
                ))
                .build();
    }

    public StaticAnalysisResult staticAudit(ComponentSource component) {
        String url = buildUrl("/api/v1/audit/static");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<ComponentSource> request = new HttpEntity<>(component, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Map<String, Object> data = (Map<String, Object>) body.get("data");
                return convertToStaticAnalysisResult(data);
            }

            throw new RuntimeException("静态分析服务响应异常");

        } catch (Exception e) {
            log.error("调用静态分析服务失败: {}", e.getMessage(), e);
            throw new RuntimeException("调用静态分析服务失败: " + e.getMessage(), e);
        }
    }

    public LlmAnalysisResult llmAudit(ComponentSource component) {
        String url = buildUrl("/api/v1/audit/llm");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<ComponentSource> request = new HttpEntity<>(component, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Boolean success = (Boolean) body.get("success");
                if (Boolean.FALSE.equals(success)) {
                    String message = (String) body.get("message");
                    return LlmAnalysisResult.builder()
                            .semanticFindings(Collections.emptyList())
                            .riskSummary("LLM分析失败")
                            .overallAssessment("LLM分析失败: " + message)
                            .build();
                }
                Map<String, Object> data = (Map<String, Object>) body.get("data");
                return convertToLlmAnalysisResult(data);
            }

            throw new RuntimeException("LLM分析服务响应异常");

        } catch (Exception e) {
            log.error("调用LLM分析服务失败: {}", e.getMessage(), e);
            return LlmAnalysisResult.builder()
                    .semanticFindings(Collections.emptyList())
                    .riskSummary("LLM分析异常")
                    .overallAssessment("LLM分析服务调用失败: " + e.getMessage())
                    .build();
        }
    }

    public boolean healthCheck() {
        String url = buildUrl("/api/v1/health");
        try {
            ResponseEntity<Map> response = healthCheckRestTemplate.getForEntity(url, Map.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("审计大脑健康检查失败: {}", e.getMessage());
            return false;
        }
    }

    private String buildUrl(String path) {
        return UriComponentsBuilder
                .fromHttpUrl(auditBrainProperties.getUrl())
                .path(path)
                .toUriString();
    }

    private AuditReport convertToAuditReport(Map<String, Object> data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            return objectMapper.readValue(json, AuditReport.class);
        } catch (Exception e) {
            log.warn("转换审计报告失败，使用手动转换: {}", e.getMessage());
            Number score = (Number) data.get("overallScore");
            return AuditReport.builder()
                    .reportId((String) data.get("reportId"))
                    .componentId((String) data.get("componentId"))
                    .componentName((String) data.get("componentName"))
                    .overallScore(score != null ? score.doubleValue() : 0.0)
                    .allFindings(Collections.emptyList())
                    .build();
        }
    }

    private StaticAnalysisResult convertToStaticAnalysisResult(Map<String, Object> data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            return objectMapper.readValue(json, StaticAnalysisResult.class);
        } catch (Exception e) {
            log.warn("转换静态分析结果失败: {}", e.getMessage());
            return StaticAnalysisResult.builder()
                    .syntaxValid((Boolean) data.get("syntaxValid"))
                    .codeLines((Integer) data.get("codeLines"))
                    .patternMatches(Collections.emptyList())
                    .build();
        }
    }

    private LlmAnalysisResult convertToLlmAnalysisResult(Map<String, Object> data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            return objectMapper.readValue(json, LlmAnalysisResult.class);
        } catch (Exception e) {
            log.warn("转换LLM分析结果失败: {}", e.getMessage());
            return LlmAnalysisResult.builder()
                    .riskSummary((String) data.get("riskSummary"))
                    .overallAssessment((String) data.get("overallAssessment"))
                    .semanticFindings(Collections.emptyList())
                    .build();
        }
    }
}
