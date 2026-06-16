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
public class CodeFixRequest {

    private String componentId;
    private String componentName;
    private String code;
    private String language;
    private List<AnomalyFinding> findings;
    private String fixScope;
}
