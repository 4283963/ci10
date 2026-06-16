package com.audit.gateway.service;

import com.audit.gateway.config.AuditBrainProperties;
import com.audit.gateway.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AuditBrainService {

    private final RestTemplate restTemplate;
    private final AuditBrainProperties auditBrainProperties;
    private final ObjectMapper objectMapper;

    public AuditBrainService(RestTemplate restTemplate,
                             AuditBrainProperties auditBrainProperties,
                             ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.auditBrainProperties = auditBrainProperties;
        this.objectMapper = objectMapper;
    }

    public AuditReport auditComponent(ComponentSource component) {
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
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    return convertToAuditReport(data);
                } else {
                    String message = (String) body.get("message");
                    throw new RuntimeException("审计失败: " + message);
                }
            }

            throw new RuntimeException("审计服务响应异常");

        } catch (Exception e) {
            log.error("调用审计大脑服务失败: {}", e.getMessage(), e);
            throw new RuntimeException("调用审计服务失败: " + e.getMessage(), e);
        }
    }

    public List<AuditReport> batchAudit(List<ComponentSource> components) {
        String url = buildUrl("/api/v1/audit/batch");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<List<ComponentSource>> request = new HttpEntity<>(components, headers);

            ResponseEntity<List> response = restTemplate.postForEntity(url, request, List.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // 简化处理，实际项目中应使用更精确的类型转换
                return (List<AuditReport>) response.getBody();
            }

            throw new RuntimeException("批量审计服务响应异常");

        } catch (Exception e) {
            log.error("调用批量审计服务失败: {}", e.getMessage(), e);
            throw new RuntimeException("调用批量审计服务失败: " + e.getMessage(), e);
        }
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
                Map<String, Object> data = (Map<String, Object>) body.get("data");
                return convertToLlmAnalysisResult(data);
            }

            throw new RuntimeException("LLM分析服务响应异常");

        } catch (Exception e) {
            log.error("调用LLM分析服务失败: {}", e.getMessage(), e);
            throw new RuntimeException("调用LLM分析服务失败: " + e.getMessage(), e);
        }
    }

    public boolean healthCheck() {
        String url = buildUrl("/api/v1/health");
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
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
            return AuditReport.builder()
                    .reportId((String) data.get("reportId"))
                    .componentId((String) data.get("componentId"))
                    .componentName((String) data.get("componentName"))
                    .overallScore(((Number) data.get("overallScore")).doubleValue())
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
                    .build();
        }
    }
}
