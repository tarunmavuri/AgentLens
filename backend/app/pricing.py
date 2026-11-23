"""Model pricing configuration for cost calculation."""

# Pricing per million tokens (USD)
MODEL_PRICING = {
    "gemini-2.5-flash": {
        "input_cost_per_million": 0.075,
        "output_cost_per_million": 0.30,
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
        "input_cost_per_million": 0.10,
        "output_cost_per_million": 0.40,
    }
}

def calculate_cost(model_name: str, in_tokens: int, out_tokens: int) -> float:
    pricing = MODEL_PRICING.get(model_name, MODEL_PRICING["default"])
    in_cost = (in_tokens / 1_000_000.0) * pricing["input_cost_per_million"]
    out_cost = (out_tokens / 1_000_000.0) * pricing["output_cost_per_million"]
    return round(in_cost + out_cost, 6)

