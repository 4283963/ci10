package com.audit.gateway.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnomalyFinding {

    private String findingId;
    private AnomalyType anomalyType;
    private RiskLevel riskLevel;
    private String description;
    private String codeSnippet;
    private Integer lineNumber;
    private Double confidence;
    private String remediation;
    private List<String> evidence;
}
