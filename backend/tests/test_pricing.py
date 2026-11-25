from backend.app.pricing import calculate_cost, get_model_pricing, pricing_table


def test_cost_matches_configured_price_per_million():
    price = get_model_pricing("gemini-2.5-flash")
    expected = (1_000_000 / 1_000_000 * price["input_cost_per_million"]) + (
        1_000_000 / 1_000_000 * price["output_cost_per_million"]
    )
    assert calculate_cost("gemini-2.5-flash", 1_000_000, 1_000_000) == round(expected, 6)


def test_unknown_model_uses_default_pricing():
    default = get_model_pricing("default")
    assert calculate_cost("some-new-model", 1_000_000, 0) == round(
        default["input_cost_per_million"], 6
    )


def test_zero_tokens_cost_nothing():
    assert calculate_cost("gemini-2.5-flash", 0, 0) == 0.0


def test_pricing_table_is_public_and_complete():
    table = pricing_table()
    assert "default" not in table
    assert all(
        {"input_cost_per_million", "output_cost_per_million"} <= set(prices)
        for prices in table.values()
    )
