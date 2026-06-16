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
public class LlmAnalysisResult {

    private List<AnomalyFinding> semanticFindings;
    private String riskSummary;
    private String overallAssessment;
}
