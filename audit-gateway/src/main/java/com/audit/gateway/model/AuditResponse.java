package com.audit.gateway.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditResponse<T> {

    private Boolean success;
    private String message;
    private T data;

    public static <T> AuditResponse<T> success(T data) {
        return AuditResponse.<T>builder()
                .success(true)
                .message("操作成功")
                .data(data)
                .build();
    }

    public static <T> AuditResponse<T> success(String message, T data) {
        return AuditResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> AuditResponse<T> error(String message) {
        return AuditResponse.<T>builder()
                .success(false)
                .message(message)
                .data(null)
                .build();
    }
}
