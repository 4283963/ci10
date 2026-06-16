import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "audit-brain"
    APP_VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    LLM_API_BASE: str = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1024"))
    LLM_MAX_INPUT_TOKENS: int = int(os.getenv("LLM_MAX_INPUT_TOKENS", "8192"))
    LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "30"))

    STATIC_ANALYSIS_ENABLED: bool = True
    LLM_ANALYSIS_ENABLED: bool = True

    RISK_WEIGHTS = {
        "critical": 25,
        "high": 15,
        "medium": 8,
        "low": 3,
        "info": 1,
    }


settings = Settings()
