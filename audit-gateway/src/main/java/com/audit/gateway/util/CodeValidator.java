package com.audit.gateway.util;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class CodeValidator {

    private static final int MAX_CODE_LENGTH = 50000;
    private static final int MAX_LINES = 2000;

    private static final Pattern DANGEROUS_FILE_OPERATION = Pattern.compile(
            "(require\\(['\"]fs['\"]\\)|child_process|execFile|spawn|execSync)",
            Pattern.CASE_INSENSITIVE
    );

    public ValidationResult validate(String code, String language) {
        if (code == null || code.trim().isEmpty()) {
            return ValidationResult.builder()
                    .valid(false)
                    .message("代码不能为空")
                    .build();
        }

        if (code.length() > MAX_CODE_LENGTH) {
            return ValidationResult.builder()
                    .valid(false)
                    .message("代码长度超过限制: " + MAX_CODE_LENGTH + " 字符")
                    .build();
        }

        long lineCount = code.lines().count();
        if (lineCount > MAX_LINES) {
            return ValidationResult.builder()
                    .valid(false)
                    .message("代码行数超过限制: " + MAX_LINES + " 行")
                    .build();
        }

        return ValidationResult.builder()
                .valid(true)
                .message("代码验证通过")
                .build();
    }

    public boolean containsDangerousPatterns(String code) {
        if (code == null) {
            return false;
        }
        return DANGEROUS_FILE_OPERATION.matcher(code).find();
    }

    public String sanitizeCode(String code) {
        if (code == null) {
            return "";
        }
        return code.replace("\0", "");
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ValidationResult {
        private boolean valid;
        private String message;
    }
}
