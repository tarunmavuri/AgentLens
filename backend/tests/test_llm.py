import json

import pytest
from pydantic import BaseModel

from backend.app import llm as llm_module
from backend.app.llm import LLMClient, LLMError


class Demo(BaseModel):
    answer: str
    score: int


@pytest.mark.asyncio
async def test_offline_mode_is_labelled_and_free():
    client = LLMClient(api_key="")
    result, usage = await client.generate_structured(
        schema=Demo,
        system_instruction="Return JSON.",
        prompt="Say hello",
        mock_response_generator={"answer": "hello", "score": 1},
    )
    assert result.answer == "hello"
    assert client.mode == "offline_simulation"
    assert usage.cost_usd == 0.0
    assert "offline-simulation" in usage.model


@pytest.mark.asyncio
async def test_unknown_model_is_rejected():
    client = LLMClient(api_key="")
    with pytest.raises(LLMError, match="allowlist"):
        await client.generate_structured(
            schema=Demo,
            system_instruction="Return JSON.",
            prompt="x",
            model="gpt-4o",
        )


@pytest.mark.asyncio
async def test_live_provider_error_is_not_silently_mocked(monkeypatch):
    client = LLMClient(api_key="test-key")

    async def raise_auth(**_kwargs):
        raise LLMError("Gemini API returned HTTP 401", status_code=401)

    monkeypatch.setattr(client, "_call_api", raise_auth)

    with pytest.raises(LLMError, match="401"):
        await client.generate_structured(
            schema=Demo,
            system_instruction="Return JSON.",
            prompt="hello",
            mock_response_generator={"answer": "should not be used", "score": 0},
        )


@pytest.mark.asyncio
async def test_transient_errors_are_retried(monkeypatch):
    client = LLMClient(api_key="test-key")
    calls = {"count": 0}
    valid = json.dumps({"answer": "ok", "score": 5})

    async def flaky(**_kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise llm_module._TransientLLMError("rate limited", status_code=429, retry_after=0)
        return valid, llm_module.Usage(in_tokens=10, out_tokens=5)

    monkeypatch.setattr(client, "_call_api", flaky)
    monkeypatch.setattr(llm_module.settings, "llm_max_attempts", 2, raising=False)

    result, usage = await client.generate_structured(
        schema=Demo, system_instruction="Return JSON.", prompt="hello"
    )
    assert calls["count"] == 2
    assert result.answer == "ok"
    assert usage.in_tokens == 10


@pytest.mark.asyncio
async def test_invalid_json_triggers_one_repair_call(monkeypatch):
    client = LLMClient(api_key="test-key")
    responses = iter([
        "not json at all",
        json.dumps({"answer": "repaired", "score": 7}),
    ])
    calls = {"count": 0}

    async def fake_call(**_kwargs):
        calls["count"] += 1
        return next(responses), llm_module.Usage(in_tokens=5, out_tokens=5)

    monkeypatch.setattr(client, "_call_api", fake_call)
    monkeypatch.setattr(llm_module.settings, "llm_repair_attempts", 1, raising=False)

    result, usage = await client.generate_structured(
        schema=Demo, system_instruction="Return JSON.", prompt="hello"
    )
    assert calls["count"] == 2
    assert result.answer == "repaired"
    assert usage.in_tokens == 10  # repair call usage is accumulated


@pytest.mark.asyncio
async def test_unrepairable_output_raises(monkeypatch):
    client = LLMClient(api_key="test-key")

    async def fake_call(**_kwargs):
        return "still not json", llm_module.Usage()

    monkeypatch.setattr(client, "_call_api", fake_call)
    with pytest.raises(LLMError, match="invalid structured output"):
        await client.generate_structured(
            schema=Demo, system_instruction="Return JSON.", prompt="hello"
        )


def test_api_key_is_not_in_request_url():
    """The key travels in a header, so it cannot leak through URL logging."""
    from pathlib import Path

    source = Path(llm_module.__file__).read_text(encoding="utf-8")
    assert "?key=" not in source
    assert "x-goog-api-key" in source


@pytest.mark.asyncio
async def test_quota_failure_falls_back_to_next_model(monkeypatch):
    from backend.app.config import settings
    from backend.app.llm import Usage

    primary = settings.default_model
    fallback = "test-fallback-model"
    monkeypatch.setattr(settings, "allowed_models", [primary, fallback], raising=False)
    monkeypatch.setattr(settings, "model_fallbacks", [fallback], raising=False)
    monkeypatch.setattr(settings, "llm_max_attempts", 1, raising=False)
    llm_module._UNHEALTHY_MODELS.clear()

    client = LLMClient(api_key="test-key")
    calls: list[str] = []

    async def fake_call_api(*, model, system_instruction, prompt, temperature):
        calls.append(model)
        if model == primary:
            raise llm_module._TransientLLMError(
                "quota", status_code=429, retry_after=0.0
            )
        return '{"answer": "ok", "score": 5}', Usage(
            in_tokens=10, out_tokens=5, cost_usd=0.0, model=model
        )

    monkeypatch.setattr(client, "_call_api", fake_call_api)

    try:
        result, usage = await client.generate_structured(
            schema=Demo,
            system_instruction="Return JSON.",
            prompt="hello",
        )
        # The failed model was marked unhealthy so later calls skip its retries.
        marked_unhealthy = primary in llm_module._UNHEALTHY_MODELS
    finally:
        llm_module._UNHEALTHY_MODELS.clear()

    assert result.answer == "ok"
    assert calls == [primary, fallback]
    assert usage.model == fallback
    assert marked_unhealthy
