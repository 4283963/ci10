package com.audit.gateway.service;

import com.audit.gateway.config.SandboxProperties;
import com.audit.gateway.model.ComponentSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
public class SandboxService {

    private final SandboxProperties sandboxProperties;
    private final ExecutorService executorService;

    public SandboxService(SandboxProperties sandboxProperties) {
        this.sandboxProperties = sandboxProperties;
        this.executorService = Executors.newFixedThreadPool(10);
    }

    public SandboxExecutionResult executeInSandbox(ComponentSource component) {
        if (!sandboxProperties.isEnabled()) {
            return SandboxExecutionResult.builder()
                    .success(false)
                    .output("沙箱执行未启用")
                    .logs(Collections.emptyList())
                    .build();
        }

        try {
            Path workDir = createWorkDirectory(component.getComponentId());
            writeComponentFile(workDir, component);
            return executeWithTimeout(workDir, component);
        } catch (Exception e) {
            log.error("沙箱执行异常: {}", e.getMessage(), e);
            return SandboxExecutionResult.builder()
                    .success(false)
                    .output("执行异常: " + e.getMessage())
                    .logs(Collections.singletonList("ERROR: " + e.getMessage()))
                    .build();
        }
    }

    private Path createWorkDirectory(String componentId) throws IOException {
        Path workDir = Paths.get(sandboxProperties.getWorkDir(), componentId + "-" + UUID.randomUUID());
        Files.createDirectories(workDir);
        return workDir;
    }

    private void writeComponentFile(Path workDir, ComponentSource component) throws IOException {
        String fileName = "component." + getFileExtension(component.getLanguage());
        Path filePath = workDir.resolve(fileName);
        Files.writeString(filePath, component.getCode());
    }

    private String getFileExtension(String language) {
        return switch (language.toLowerCase()) {
            case "javascript", "js" -> "js";
            case "typescript", "ts" -> "ts";
            case "python", "py" -> "py";
            default -> "js";
        };
    }

    private SandboxExecutionResult executeWithTimeout(Path workDir, ComponentSource component) {
        Future<SandboxExecutionResult> future = executorService.submit(() -> executeCode(workDir, component));

        try {
            return future.get(sandboxProperties.getTimeoutSeconds(), TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            cleanupWorkDirectory(workDir);
            return SandboxExecutionResult.builder()
                    .success(false)
                    .timeout(true)
                    .output("执行超时，已终止")
                    .logs(Collections.singletonList("TIMEOUT: 执行超过 " + sandboxProperties.getTimeoutSeconds() + " 秒"))
                    .build();
        } catch (Exception e) {
            cleanupWorkDirectory(workDir);
            return SandboxExecutionResult.builder()
                    .success(false)
                    .output("执行失败: " + e.getMessage())
                    .logs(Collections.singletonList("ERROR: " + e.getMessage()))
                    .build();
        }
    }

    private SandboxExecutionResult executeCode(Path workDir, ComponentSource component) throws IOException, InterruptedException {
        List<String> command = buildCommand(component, workDir);

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.directory(workDir.toFile());
        processBuilder.redirectErrorStream(true);

        Map<String, String> env = processBuilder.environment();
        if (sandboxProperties.isNetworkRestricted()) {
            env.put("NODE_DISABLE_NETWORK", "true");
        }
        env.put("NODE_OPTIONS", "--max-old-space-size=" + sandboxProperties.getMaxMemoryMb());

        Process process = processBuilder.start();

        StringBuilder output = new StringBuilder();
        List<String> logs = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                logs.add(line);
                if (logs.size() > 1000) {
                    logs.add("[日志截断，超过1000行]");
                    break;
                }
            }
        }

        int exitCode = process.waitFor();
        boolean success = exitCode == 0;

        cleanupWorkDirectory(workDir);

        return SandboxExecutionResult.builder()
                .success(success)
                .exitCode(exitCode)
                .output(output.toString())
                .logs(logs)
                .build();
    }

    private List<String> buildCommand(ComponentSource component, Path workDir) {
        String language = component.getLanguage().toLowerCase();
        return switch (language) {
            case "javascript", "js" -> Arrays.asList("node", "--disable-proto=throw", "component.js");
            case "python", "py" -> Arrays.asList("python3", "-S", "-c", component.getCode());
            default -> Arrays.asList("node", "--disable-proto=throw", "component.js");
        };
    }

    private void cleanupWorkDirectory(Path workDir) {
        try {
            if (Files.exists(workDir)) {
                Files.walk(workDir)
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
            }
        } catch (IOException e) {
            log.warn("清理工作目录失败: {}", workDir, e);
        }
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SandboxExecutionResult {
        private boolean success;
        private boolean timeout;
        private int exitCode;
        private String output;
        private List<String> logs;
    }
}
