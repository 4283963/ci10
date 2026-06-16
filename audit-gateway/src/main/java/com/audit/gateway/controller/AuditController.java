package com.audit.gateway.controller;

import com.audit.gateway.model.*;
import com.audit.gateway.service.AuditGatewayService;
import com.audit.gateway.service.LogExtractorService;
import com.audit.gateway.service.SandboxService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class AuditController {

    private final AuditGatewayService auditGatewayService;

    public AuditController(AuditGatewayService auditGatewayService) {
        this.auditGatewayService = auditGatewayService;
    }

    @GetMapping("/health")
    public ResponseEntity<AuditResponse<Map<String, Object>>> healthCheck() {
        return ResponseEntity.ok(auditGatewayService.getSystemStatus());
    }

    @PostMapping("/audit/full")
    public ResponseEntity<AuditResponse<AuditGatewayService.FullAuditResult>> fullAudit(
            @Valid @RequestBody ComponentSource component) {
        log.info("收到完整审计请求: {}", component.getComponentId());
        AuditResponse<AuditGatewayService.FullAuditResult> response = auditGatewayService.fullAudit(component);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/audit")
    public ResponseEntity<AuditResponse<AuditReport>> auditComponent(
            @Valid @RequestBody ComponentSource component) {
        log.info("收到审计请求: {}", component.getComponentId());
        AuditResponse<AuditReport> response = auditGatewayService.staticAudit(component);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/audit/batch")
    public ResponseEntity<AuditResponse<List<AuditReport>>> batchAudit(
            @RequestBody List<ComponentSource> components) {
        log.info("收到批量审计请求，组件数量: {}", components.size());
        AuditResponse<List<AuditReport>> response = auditGatewayService.batchAudit(components);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sandbox/execute")
    public ResponseEntity<AuditResponse<SandboxService.SandboxExecutionResult>> sandboxExecute(
            @Valid @RequestBody ComponentSource component) {
        log.info("收到沙箱执行请求: {}", component.getComponentId());
        AuditResponse<SandboxService.SandboxExecutionResult> response = auditGatewayService.sandboxExecute(component);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logs/analyze")
    public ResponseEntity<AuditResponse<LogExtractorService.ExtractedLogData>> analyzeLogs(
            @RequestBody List<String> logs) {
        log.info("收到日志分析请求，日志行数: {}", logs != null ? logs.size() : 0);
        AuditResponse<LogExtractorService.ExtractedLogData> response = auditGatewayService.analyzeLogs(logs);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    public ResponseEntity<AuditResponse<Map<String, Object>>> getSystemStatus() {
        return ResponseEntity.ok(auditGatewayService.getSystemStatus());
    }
}
