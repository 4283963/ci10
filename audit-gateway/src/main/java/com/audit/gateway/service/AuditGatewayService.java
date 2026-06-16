package com.audit.gateway.service;

import com.audit.gateway.model.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class AuditGatewayService {

    private final SandboxService sandboxService;
    private final LogExtractorService logExtractorService;
    private final AuditBrainService auditBrainService;

    public AuditGatewayService(SandboxService sandboxService,
                               LogExtractorService logExtractorService,
                               AuditBrainService auditBrainService) {
        this.sandboxService = sandboxService;
        this.logExtractorService = logExtractorService;
        this.auditBrainService = auditBrainService;
    }

    public AuditResponse<FullAuditResult> fullAudit(ComponentSource component) {
        try {
            log.info("开始完整审计组件: {}", component.getComponentId());

            SandboxService.SandboxExecutionResult sandboxResult = sandboxService.executeInSandbox(component);

            String runtimeLogs = logExtractorService.extractRuntimeLogsAsString(sandboxResult.getLogs());
            component.setRuntimeLogs(runtimeLogs);

            LogExtractorService.ExtractedLogData logData = logExtractorService.extractLogInfo(sandboxResult.getLogs());

            AuditReport auditReport = auditBrainService.auditComponent(component);

            FullAuditResult result = FullAuditResult.builder()
                    .auditReport(auditReport)
                    .sandboxResult(sandboxResult)
                    .logAnalysis(logData)
                    .build();

            return AuditResponse.success("完整审计完成", result);

        } catch (Exception e) {
            log.error("完整审计失败: {}", e.getMessage(), e);
            return AuditResponse.error("审计失败: " + e.getMessage());
        }
    }

    public AuditResponse<AuditReport> staticAudit(ComponentSource component) {
        try {
            AuditReport report = auditBrainService.auditComponent(component);
            return AuditResponse.success("静态审计完成", report);
        } catch (Exception e) {
            log.error("静态审计失败: {}", e.getMessage(), e);
            return AuditResponse.error("静态审计失败: " + e.getMessage());
        }
    }

    public AuditResponse<SandboxService.SandboxExecutionResult> sandboxExecute(ComponentSource component) {
        try {
            SandboxService.SandboxExecutionResult result = sandboxService.executeInSandbox(component);
            return AuditResponse.success("沙箱执行完成", result);
        } catch (Exception e) {
            log.error("沙箱执行失败: {}", e.getMessage(), e);
            return AuditResponse.error("沙箱执行失败: " + e.getMessage());
        }
    }

    public AuditResponse<LogExtractorService.ExtractedLogData> analyzeLogs(List<String> logs) {
        try {
            LogExtractorService.ExtractedLogData result = logExtractorService.extractLogInfo(logs);
            return AuditResponse.success("日志分析完成", result);
        } catch (Exception e) {
            log.error("日志分析失败: {}", e.getMessage(), e);
            return AuditResponse.error("日志分析失败: " + e.getMessage());
        }
    }

    public AuditResponse<Map<String, Object>> getSystemStatus() {
        Map<String, Object> status = new HashMap<>();

        boolean brainHealthy = auditBrainService.healthCheck();
        status.put("auditBrain", Map.of(
                "healthy", brainHealthy,
                "status", brainHealthy ? "running" : "unavailable"
        ));

        status.put("sandbox", Map.of(
                "enabled", true,
                "status", "available"
        ));

        status.put("gateway", Map.of(
                "status", "running",
                "version", "1.0.0"
        ));

        return AuditResponse.success(status);
    }

    public AuditResponse<List<AuditReport>> batchAudit(List<ComponentSource> components) {
        try {
            List<AuditReport> reports = auditBrainService.batchAudit(components);
            return AuditResponse.success("批量审计完成", reports);
        } catch (Exception e) {
            log.error("批量审计失败: {}", e.getMessage(), e);
            return AuditResponse.error("批量审计失败: " + e.getMessage());
        }
    }

    public AuditResponse<CodeFixResult> fixCode(CodeFixRequest request) {
        try {
            log.info("开始代码修复: {}, 修复范围: {}", request.getComponentId(), request.getFixScope());
            CodeFixResult result = auditBrainService.fixCode(request);
            return AuditResponse.success("代码修复完成", result);
        } catch (Exception e) {
            log.error("代码修复服务异常: {}", e.getMessage(), e);
            return AuditResponse.error("代码修复失败: " + e.getMessage());
        }
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class FullAuditResult {
        private AuditReport auditReport;
        private SandboxService.SandboxExecutionResult sandboxResult;
        private LogExtractorService.ExtractedLogData logAnalysis;
    }
}
