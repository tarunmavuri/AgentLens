"""Application configuration.

Every value can be overridden through environment variables so the same code
runs locally, in tests and on a hosted platform without edits.
"""

import json
import os
from typing import Any, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip())
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "").strip())
    except (TypeError, ValueError):
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


# Models the platform will send to the Gemini API. Users may only pick from
# this allowlist, which keeps arbitrary model strings out of outbound calls.
DEFAULT_ALLOWED_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


class Settings(BaseModel):
    app_name: str = "AgentLens"
    version: str = "1.1.0"
    environment: str = os.getenv("APP_ENV", "development")

    # Providers -----------------------------------------------------------------
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    default_model: str = os.getenv("DEFAULT_MODEL", "gemini-2.5-flash")
    search_timeout_seconds: float = Field(
        default_factory=lambda: _env_float("SEARCH_TIMEOUT_SECONDS", 8.0)
    )
    allowed_models: list[str] = Field(
        default_factory=lambda: _env_list("ALLOWED_MODELS", DEFAULT_ALLOWED_MODELS)
    )
    # Tried in order when the requested model is unavailable (404), out of
    # quota (429) or temporarily overloaded (503) after normal retries.
    model_fallbacks: list[str] = Field(
        default_factory=lambda: _env_list(
            "MODEL_FALLBACK_MODELS",
            ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash"],
        )
    )
    # When no API key is configured the platform runs deterministic offline
    # simulations and labels every run with `llm_mode: "offline_simulation"`.
    # A configured key never silently falls back to simulation.
    allow_offline_simulation: bool = Field(
        default_factory=lambda: _env_bool("ALLOW_OFFLINE_SIMULATION", True)
    )
    llm_timeout_seconds: float = Field(
        default_factory=lambda: _env_float("LLM_TIMEOUT_SECONDS", 60.0)
    )
    llm_max_attempts: int = Field(
        default_factory=lambda: max(1, _env_int("LLM_MAX_ATTEMPTS", 3))
    )
    llm_repair_attempts: int = Field(
        default_factory=lambda: max(0, _env_int("LLM_REPAIR_ATTEMPTS", 1))
    )

    # Storage -------------------------------------------------------------------
    db_path: str = os.getenv("DB_PATH", "agentlens.db")

    # HTTP ----------------------------------------------------------------------
    cors_origins: list[str] = Field(
        default_factory=lambda: _env_list("CORS_ORIGINS", ["*"])
    )
    rate_limit_requests: int = Field(
        default_factory=lambda: _env_int("RATE_LIMIT_REQUESTS", 30)
    )
    rate_limit_window_seconds: int = Field(
        default_factory=lambda: _env_int("RATE_LIMIT_WINDOW_SECONDS", 60)
    )

    # Sandbox -------------------------------------------------------------------
    sandbox_timeout_seconds: int = Field(
        default_factory=lambda: _env_int("SANDBOX_TIMEOUT_SECONDS", 20)
    )
    sandbox_max_output_chars: int = Field(
        default_factory=lambda: _env_int("SANDBOX_MAX_OUTPUT_CHARS", 10000)
    )

    # Orchestration guardrails --------------------------------------------------
    max_steps_default: int = Field(
        default_factory=lambda: _env_int("MAX_STEPS_DEFAULT", 25)
    )
    max_tokens_default: int = Field(
        default_factory=lambda: _env_int("MAX_TOKENS_DEFAULT", 60000)
    )
    max_seconds_default: int = Field(
        default_factory=lambda: _env_int("MAX_SECONDS_DEFAULT", 300)
    )
    max_retries_default: int = Field(
        default_factory=lambda: _env_int("MAX_RETRIES_DEFAULT", 2)
    )
    max_tasks_per_plan: int = 5

    @property
    def usable_models(self) -> list[str]:
        """Allowlisted models, deduplicated, in configuration order."""
        seen: list[str] = []
        for model in self.allowed_models:
            if model and model not in seen:
                seen.append(model)
        return seen

    @property
    def llm_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def llm_mode(self) -> str:
        if self.llm_configured:
            return "gemini"
        return "offline_simulation" if self.allow_offline_simulation else "disabled"

    def public_dict(self) -> dict[str, Any]:
        """Non-secret configuration safe to expose to the browser."""
        return {
            "app_name": self.app_name,
            "version": self.version,
            "environment": self.environment,
            "llm_mode": self.llm_mode,
            "llm_configured": self.llm_configured,
            "default_model": self.default_model,
            "allowed_models": self.usable_models,
            "search_provider": "tavily" if self.tavily_api_key else "duckduckgo",
            "sandbox_timeout_seconds": self.sandbox_timeout_seconds,
            "limits": {
                "max_steps": self.max_steps_default,
                "max_tokens": self.max_tokens_default,
                "max_seconds": self.max_seconds_default,
                "max_retries": self.max_retries_default,
                "max_tasks_per_plan": self.max_tasks_per_plan,
            },
            "rate_limit": {
                "requests": self.rate_limit_requests,
                "window_seconds": self.rate_limit_window_seconds,
            },
        }


settings = Settings()


def model_pricing_overrides() -> Optional[dict[str, dict[str, float]]]:
    """Optional JSON pricing table from MODEL_PRICING_JSON."""
    raw = os.getenv("MODEL_PRICING_JSON", "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    return {
        str(name): {
            "input_cost_per_million": float(vals.get("input_cost_per_million", 0.0)),
            "output_cost_per_million": float(vals.get("output_cost_per_million", 0.0)),
        }
        for name, vals in parsed.items()
        if isinstance(vals, dict)
    }
