"""Model pricing used for cost estimation.

Prices are per million tokens in USD and can be overridden at runtime with the
MODEL_PRICING_JSON environment variable, e.g.

    MODEL_PRICING_JSON='{"gemini-2.5-flash": {"input_cost_per_million": 0.3,
                                              "output_cost_per_million": 2.5}}'

Always verify current rates with the provider before relying on cost figures
for billing.
"""

from typing import Any

from backend.app.config import model_pricing_overrides

DEFAULT_MODEL_PRICING: dict[str, dict[str, float]] = {
    "gemini-2.5-flash": {
        "input_cost_per_million": 0.30,
        "output_cost_per_million": 2.50,
    },
    "gemini-2.5-pro": {
        "input_cost_per_million": 1.25,
        "output_cost_per_million": 10.00,
    },
    "gemini-2.0-flash": {
        "input_cost_per_million": 0.10,
        "output_cost_per_million": 0.40,
    },
    "gemini-1.5-flash": {
        "input_cost_per_million": 0.075,
        "output_cost_per_million": 0.30,
    },
    "gemini-1.5-pro": {
        "input_cost_per_million": 1.25,
        "output_cost_per_million": 5.00,
    },
    "default": {
        "input_cost_per_million": 0.30,
        "output_cost_per_million": 2.50,
    },
}


def _pricing_table() -> dict[str, dict[str, float]]:
    table = dict(DEFAULT_MODEL_PRICING)
    for model, prices in (model_pricing_overrides() or {}).items():
        table[model] = prices
    return table


def get_model_pricing(model_name: str) -> dict[str, float]:
    return _pricing_table().get(model_name, DEFAULT_MODEL_PRICING["default"])


def calculate_cost(model_name: str, in_tokens: int, out_tokens: int) -> float:
    pricing = get_model_pricing(model_name)
    in_cost = (max(in_tokens, 0) / 1_000_000.0) * pricing["input_cost_per_million"]
    out_cost = (max(out_tokens, 0) / 1_000_000.0) * pricing["output_cost_per_million"]
    return round(in_cost + out_cost, 6)


def pricing_table() -> dict[str, Any]:
    """Public pricing snapshot (no secrets) for the settings screen."""
    table = _pricing_table()
    table.pop("default", None)
    return table
