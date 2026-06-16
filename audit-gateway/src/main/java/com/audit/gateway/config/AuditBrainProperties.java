package com.audit.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "audit.brain")
public class AuditBrainProperties {

    private String url = "http://localhost:8000";
    private int timeout = 60000;
    private int connectTimeout = 10000;
}
