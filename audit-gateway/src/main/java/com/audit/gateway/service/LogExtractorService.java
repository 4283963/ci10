package com.audit.gateway.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.*;

@Slf4j
@Service
public class LogExtractorService {

    private static final Pattern ERROR_PATTERN = Pattern.compile(
            "(error|exception|fail|fatal|critical)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern WARNING_PATTERN = Pattern.compile(
            "(warn|warning|alert)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern NETWORK_PATTERN = Pattern.compile(
            "(http|https|fetch|xhr|xmlhttprequest|websocket|ws://|wss://)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SENSITIVE_DATA_PATTERN = Pattern.compile(
            "(password|token|secret|key|credential|auth)",
            Pattern.CASE_INSENSITIVE
    );

    public ExtractedLogData extractLogInfo(List<String> logs) {
        if (logs == null || logs.isEmpty()) {
            return ExtractedLogData.builder()
                    .totalLines(0)
                    .errorCount(0)
                    .warningCount(0)
                    .errorLogs(Collections.emptyList())
                    .networkActivities(Collections.emptyList())
                    .sensitiveDataHits(Collections.emptyList())
                    .suspiciousPatterns(Collections.emptyList())
                    .build();
        }

        List<String> errorLogs = new ArrayList<>();
        List<String> networkActivities = new ArrayList<>();
        List<String> sensitiveDataHits = new ArrayList<>();
        List<SuspiciousPattern> suspiciousPatterns = new ArrayList<>();

        int errorCount = 0;
        int warningCount = 0;

        for (int i = 0; i < logs.size(); i++) {
            String logLine = logs.get(i);
            int lineNum = i + 1;

            Matcher errorMatcher = ERROR_PATTERN.matcher(logLine);
            if (errorMatcher.find()) {
                errorCount++;
                if (errorLogs.size() < 50) {
                    errorLogs.add("[" + lineNum + "] " + logLine);
                }
            }

            Matcher warningMatcher = WARNING_PATTERN.matcher(logLine);
            if (warningMatcher.find()) {
                warningCount++;
            }

            Matcher networkMatcher = NETWORK_PATTERN.matcher(logLine);
            if (networkMatcher.find()) {
                networkActivities.add("[" + lineNum + "] " + logLine);
                suspiciousPatterns.add(SuspiciousPattern.builder()
                        .type("network_activity")
                        .lineNumber(lineNum)
                        .description("检测到网络活动")
                        .severity("medium")
                        .evidence(logLine)
                        .build());
            }

            Matcher sensitiveMatcher = SENSITIVE_DATA_PATTERN.matcher(logLine);
            if (sensitiveMatcher.find()) {
                sensitiveDataHits.add("[" + lineNum + "] " + logLine);
                suspiciousPatterns.add(SuspiciousPattern.builder()
                        .type("sensitive_data")
                        .lineNumber(lineNum)
                        .description("检测到敏感数据关键词")
                        .severity("high")
                        .evidence(logLine)
                        .build());
            }
        }

        detectMemoryIssues(logs, suspiciousPatterns);
        detectInfiniteLoop(logs, suspiciousPatterns);

        return ExtractedLogData.builder()
                .totalLines(logs.size())
                .errorCount(errorCount)
                .warningCount(warningCount)
                .errorLogs(errorLogs)
                .networkActivities(networkActivities)
                .sensitiveDataHits(sensitiveDataHits)
                .suspiciousPatterns(suspiciousPatterns)
                .build();
    }

    private void detectMemoryIssues(List<String> logs, List<SuspiciousPattern> suspiciousPatterns) {
        Pattern memoryPattern = Pattern.compile(
                "(memory|heap|out of memory|oom|leak)",
                Pattern.CASE_INSENSITIVE
        );

        for (int i = 0; i < logs.size(); i++) {
            Matcher matcher = memoryPattern.matcher(logs.get(i));
            if (matcher.find()) {
                suspiciousPatterns.add(SuspiciousPattern.builder()
                        .type("memory_issue")
                        .lineNumber(i + 1)
                        .description("检测到内存相关问题")
                        .severity("high")
                        .evidence(logs.get(i))
                        .build());
                break;
            }
        }
    }

    private void detectInfiniteLoop(List<String> logs, List<SuspiciousPattern> suspiciousPatterns) {
        if (logs.size() > 500) {
            Set<String> uniqueLogs = new HashSet<>(logs);
            double repeatRatio = 1.0 - (double) uniqueLogs.size() / logs.size();
            if (repeatRatio > 0.8) {
                suspiciousPatterns.add(SuspiciousPattern.builder()
                        .type("potential_infinite_loop")
                        .lineNumber(0)
                        .description("日志重复率过高，可能存在死循环")
                        .severity("high")
                        .evidence("日志总行数: " + logs.size() + ", 重复率: " + String.format("%.2f%%", repeatRatio * 100))
                        .build());
            }
        }
    }

    public String extractRuntimeLogsAsString(List<String> logs) {
        if (logs == null || logs.isEmpty()) {
            return "";
        }
        return String.join("\n", logs);
    }

    public List<String> filterSuspiciousLogs(List<String> logs) {
        ExtractedLogData data = extractLogInfo(logs);
        return data.getErrorLogs();
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ExtractedLogData {
        private int totalLines;
        private int errorCount;
        private int warningCount;
        private List<String> errorLogs;
        private List<String> networkActivities;
        private List<String> sensitiveDataHits;
        private List<SuspiciousPattern> suspiciousPatterns;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SuspiciousPattern {
        private String type;
        private int lineNumber;
        private String description;
        private String severity;
        private String evidence;
    }
}
