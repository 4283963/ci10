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
public class CodeFixResult {

    private String originalCode;
    private String fixedCode;
    private List<CodeFixDiff> changes;
    private String fixSummary;
    private List<String> fixedFindings;
    private String warning;
    private Double estimatedScoreImprovement;
}
