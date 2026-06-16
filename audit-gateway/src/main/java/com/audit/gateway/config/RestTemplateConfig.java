package com.audit.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import java.time.Duration;

@Configuration
public class RestTemplateConfig {

    private final AuditBrainProperties auditBrainProperties;

    public RestTemplateConfig(AuditBrainProperties auditBrainProperties) {
        this.auditBrainProperties = auditBrainProperties;
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(auditBrainProperties.getConnectTimeout()))
                .setReadTimeout(Duration.ofMillis(auditBrainProperties.getTimeout()))
                .build();
    }

    @Bean("healthCheckRestTemplate")
    public RestTemplate healthCheckRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(2000))
                .setReadTimeout(Duration.ofMillis(3000))
                .build();
    }
}
