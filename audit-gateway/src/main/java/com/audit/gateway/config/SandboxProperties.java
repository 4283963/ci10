package com.audit.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "audit.sandbox")
public class SandboxProperties {

    private boolean enabled = true;
    private int timeoutSeconds = 30;
    private int maxMemoryMb = 256;
    private String workDir = "./sandbox-workspace";
    private boolean networkRestricted = true;
    private List<String> allowedDomains;
}
