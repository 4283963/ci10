package com.audit.gateway.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodeFixDiff {

    private Integer lineNumber;
    private String originalCode;
    private String fixedCode;
    private String changeType;
    private String reason;
}
