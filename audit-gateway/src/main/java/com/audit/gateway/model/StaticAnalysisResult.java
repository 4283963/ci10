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
public class StaticAnalysisResult {

    private Boolean syntaxValid;
    private String syntaxError;
    private List<AnomalyFinding> patternMatches;
    private Double complexityScore;
    private Integer codeLines;
}
