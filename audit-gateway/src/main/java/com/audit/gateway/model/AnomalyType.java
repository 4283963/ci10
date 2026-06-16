package com.audit.gateway.model;

public enum AnomalyType {
    CODE_INJECTION,
    DATA_LEAKAGE,
    UNAUTHORIZED_NETWORK,
    UNSAFE_EVAL,
    SENSITIVE_API,
    MEMORY_TAMPERING,
    PROTOTYPE_POLLUTION,
    UNKNOWN
}
