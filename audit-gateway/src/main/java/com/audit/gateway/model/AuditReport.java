package com.audit.gateway.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditReport {

    private String reportId;
    private String componentId;
    private String componentName;
    private LocalDateTime timestamp;
    private StaticAnalysisResult staticAnalysis;
    private LlmAnalysisResult llmAnalysis;
    private Double overallScore;
    private RiskLevel riskLevel;
    private List<AnomalyFinding> allFindings;
    private List<String> recommendations;
}
