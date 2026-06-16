package com.audit.gateway.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentSource {

    @NotBlank(message = "组件ID不能为空")
    private String componentId;

    @NotBlank(message = "组件名称不能为空")
    private String componentName;

    @NotBlank(message = "组件代码不能为空")
    @Size(max = 50000, message = "组件代码不能超过50000字符")
    private String code;

    @Builder.Default
    private String language = "javascript";

    @Builder.Default
    private String componentType = "lowcode";

    private String runtimeLogs;
}
