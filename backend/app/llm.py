"""Google Gemini client with strict structured output and honest failure modes.

Design rules:
* A configured API key is never silently replaced by simulated output. Provider
  errors surface as `LLMError` so a run fails with a real reason instead of
  pretending to have called a model.
* Without a key the platform runs explicit offline simulations, and every run
  records `llm_mode: "offline_simulation"` so no trace can be mistaken for a
  real model call.
* Structured output is enforced twice: the model is asked for JSON only and the
  result is validated against a Pydantic schema, with one repair round-trip.
* 429/5xx responses are retried with exponential backoff; the API key travels
  in a header, never in the URL or logs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Optional, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from backend.app.config import settings
from backend.app.events import Usage
from backend.app.pricing import calculate_cost

T = TypeVar("T", bound=BaseModel)

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
# After retries, these statuses mean "this model is unusable right now" rather
# than "the request is bad", so trying a configured fallback model is safe.
FALLBACK_STATUS = {404, 429, 503}
# Models that recently failed with a fallback status are skipped for this long
# so one exhausted quota does not add retry latency to every single call.
_UNHEALTHY_MODELS: dict[str, float] = {}
_UNHEALTHY_TTL_SECONDS = 600.0


def _mark_unhealthy(model: str) -> None:
    _UNHEALTHY_MODELS[model] = time.time()


def _is_unhealthy(model: str) -> bool:
    marked = _UNHEALTHY_MODELS.get(model)
    if marked is None:
        return False
    if time.time() - marked > _UNHEALTHY_TTL_SECONDS:
        _UNHEALTHY_MODELS.pop(model, None)
        return False
    return True


class LLMError(RuntimeError):
    """Raised when a live model call cannot produce a validated result."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class _TransientLLMError(LLMError):
    def __init__(self, message: str, *, status_code: int, retry_after: float) -> None:
        super().__init__(message, status_code=status_code, retryable=True)
        self.retry_after = retry_after


class LLMClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
    ) -> None:
        self._api_key_override = api_key
        self._default_model_override = default_model

    # ------------------------------------------------------------------ state
    @property
    def api_key(self) -> str:
        return (
            self._api_key_override
            if self._api_key_override is not None
            else settings.gemini_api_key
        ).strip()

    @property
    def default_model(self) -> str:
        return self._default_model_override or settings.default_model

    @property
    def mode(self) -> str:
        if self.api_key:
            return "gemini"
        if settings.allow_offline_simulation:
            return "offline_simulation"
        return "disabled"

    def validate_model(self, model: str) -> str:
        if model in settings.allowed_models:
            return model
        raise LLMError(
            f"Model '{model}' is not in the configured allowlist "
            f"({', '.join(settings.allowed_models)})."
        )

    # -------------------------------------------------------------- generate
    async def generate_structured(
        self,
        schema: Type[T],
        system_instruction: str,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2,
        mock_response_generator: Optional[Any] = None,
    ) -> tuple[T, Usage]:
        target_model = self.validate_model(model or self.default_model)
        started = time.time()

        if self.mode == "disabled":
            raise LLMError(
                "No LLM provider is configured and offline simulation is disabled. "
                "Set GEMINI_API_KEY (or ALLOW_OFFLINE_SIMULATION=true)."
            )

        if self.mode == "offline_simulation":
            return await self._generate_offline(
                schema, prompt, target_model, started, mock_response_generator
            )

        schema_contract = json.dumps(schema.model_json_schema(), separators=(",", ":"))
        grounded_prompt = (
            f"{prompt}\n\n"
            "Respond with a single JSON object only (no markdown fences, no prose) "
            "that validates against this JSON Schema:\n"
            f"{schema_contract}"
        )

        candidates = [target_model]
        for fallback in settings.model_fallbacks:
            if fallback in candidates:
                continue
            try:
                candidates.append(self.validate_model(fallback))
            except LLMError:
                logger.info("Skipping fallback model outside allowlist: %s", fallback)

        healthy = [model for model in candidates if not _is_unhealthy(model)]
        if healthy:
            candidates = healthy
        active_model = target_model
        raw_text = ""
        api_usage: Optional[Usage] = None
        last_error: Optional[LLMError] = None

        for index, candidate in enumerate(candidates):
            try:
                raw_text, api_usage = await self._request_with_retries(
                    model=candidate,
                    system_instruction=system_instruction,
                    prompt=grounded_prompt,
                    temperature=temperature,
                )
                active_model = candidate
                break
            except LLMError as exc:
                last_error = exc
                if exc.status_code in FALLBACK_STATUS and index + 1 < len(candidates):
                    logger.warning(
                        "Model %s unavailable (%s); falling back to %s",
                        candidate,
                        exc.status_code,
                        candidates[index + 1],
                    )
                    _mark_unhealthy(candidate)
                    continue
                raise

        if api_usage is None:
            raise last_error or LLMError("No configured model was reachable")

        try:
            parsed = schema.model_validate(self._parse_json(raw_text))
        except (json.JSONDecodeError, ValidationError) as first_error:
            parsed = await self._repair(
                schema=schema,
                system_instruction=system_instruction,
                original_prompt=grounded_prompt,
                invalid_output=raw_text,
                error=first_error,
                model=active_model,
                temperature=temperature,
                usage_accumulator=api_usage,
            )

        elapsed_ms = (time.time() - started) * 1000.0
        usage = Usage(
            in_tokens=api_usage.in_tokens,
            out_tokens=api_usage.out_tokens,
            cost_usd=calculate_cost(
                active_model, api_usage.in_tokens, api_usage.out_tokens
            ),
            latency_ms=round(elapsed_ms, 2),
            model=active_model,
        )
        return parsed, usage

    async def _repair(
        self,
        *,
        schema: Type[T],
        system_instruction: str,
        original_prompt: str,
        invalid_output: str,
        error: Exception,
        model: str,
        temperature: float,
        usage_accumulator: Usage,
    ) -> T:
        if settings.llm_repair_attempts <= 0:
            raise LLMError(f"Model returned unparseable structured output: {error}")

        repair_prompt = (
            f"{original_prompt}\n\n"
            "Your previous response could not be validated.\n"
            f"Response:\n{invalid_output[:4000]}\n\n"
            f"Validation error: {error}\n"
            "Return the corrected JSON object only."
        )
        try:
            repaired_text, repair_usage = await self._request_with_retries(
                model=model,
                system_instruction=system_instruction,
                prompt=repair_prompt,
                temperature=temperature,
            )
            parsed = schema.model_validate(self._parse_json(repaired_text))
        except (json.JSONDecodeError, ValidationError, LLMError) as repair_error:
            raise LLMError(
                f"Model returned invalid structured output after repair attempt: {repair_error}"
            ) from repair_error

        usage_accumulator.in_tokens += repair_usage.in_tokens
        usage_accumulator.out_tokens += repair_usage.out_tokens
        return parsed

    # --------------------------------------------------------------- transport
    async def _request_with_retries(
        self,
        *,
        model: str,
        system_instruction: str,
        prompt: str,
        temperature: float,
    ) -> tuple[str, Usage]:
        attempts = max(1, settings.llm_max_attempts)
        delay = 0.5
        last_error: Optional[LLMError] = None

        for attempt in range(1, attempts + 1):
            try:
                return await self._call_api(
                    model=model,
                    system_instruction=system_instruction,
                    prompt=prompt,
                    temperature=temperature,
                )
            except _TransientLLMError as exc:
                last_error = exc
                if attempt >= attempts:
                    break
                wait = min(exc.retry_after or delay, 8.0)
                logger.warning(
                    "Transient LLM error (status %s), retrying in %.1fs (attempt %s/%s)",
                    exc.status_code,
                    wait,
                    attempt,
                    attempts,
                )
                await asyncio.sleep(wait)
                delay *= 2
            except LLMError:
                raise

        raise LLMError(
            f"LLM request failed after {attempts} attempt(s): {last_error}",
            status_code=getattr(last_error, "status_code", None),
            retryable=True,
        )

    async def _call_api(
        self,
        *,
        model: str,
        system_instruction: str,
        prompt: str,
        temperature: float,
    ) -> tuple[str, Usage]:
        url = f"{GEMINI_ENDPOINT}/{model}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": max(0.0, min(float(temperature), 1.0)),
                "maxOutputTokens": 4096,
            },
        }
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise _TransientLLMError(
                "LLM request timed out", status_code=504, retry_after=1.0
            ) from exc
        except httpx.HTTPError as exc:
            raise _TransientLLMError(
                f"LLM transport error: {type(exc).__name__}", status_code=503, retry_after=1.0
            ) from exc

        if response.status_code != 200:
            retry_after = 0.0
            try:
                retry_after = float(response.headers.get("retry-after", "0"))
            except ValueError:
                retry_after = 0.0
            message = f"Gemini API returned HTTP {response.status_code}"
            if response.status_code in RETRYABLE_STATUS:
                raise _TransientLLMError(
                    message, status_code=response.status_code, retry_after=retry_after
                )
            raise LLMError(message, status_code=response.status_code, retryable=False)

        data = response.json()
        usage_meta = data.get("usageMetadata", {}) or {}
        in_tokens = int(usage_meta.get("promptTokenCount", 0) or 0)
        out_tokens = int(usage_meta.get("candidatesTokenCount", 0) or 0)

        candidates = data.get("candidates") or []
        text = ""
        if candidates:
            parts = (candidates[0].get("content") or {}).get("parts") or []
            text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))

        if not text.strip():
            finish_reason = candidates[0].get("finishReason") if candidates else "UNKNOWN"
            raise LLMError(
                f"Gemini returned an empty candidate (finishReason={finish_reason})"
            )

        return text, Usage(
            in_tokens=in_tokens,
            out_tokens=out_tokens,
            cost_usd=calculate_cost(model, in_tokens, out_tokens),
            model=model,
        )

    # ----------------------------------------------------------------- offline
    async def _generate_offline(
        self,
        schema: Type[T],
        prompt: str,
        model: str,
        started: float,
        mock_generator: Optional[Any],
    ) -> tuple[T, Usage]:
        """Deterministic offline simulation, used only when no key is configured."""
        await asyncio.sleep(0.01)

        data: dict[str, Any] = {}
        if mock_generator is not None:
            if callable(mock_generator):
                data = mock_generator(prompt)
            elif isinstance(mock_generator, dict):
                data = mock_generator
            elif isinstance(mock_generator, schema):
                data = mock_generator.model_dump()
        else:
            data = self._synthesize_schema_defaults(schema, prompt)

        validated = schema.model_validate(data)
        elapsed_ms = (time.time() - started) * 1000.0
        in_tokens = max(len(prompt.split()) * 2, 45)
        out_tokens = max(len(json.dumps(data).split()) * 2, 85)

        return validated, Usage(
            in_tokens=in_tokens,
            out_tokens=out_tokens,
            cost_usd=0.0,  # no provider was billed for a simulation
            latency_ms=round(elapsed_ms, 2),
            model=f"{model} (offline-simulation)",
        )

    def _synthesize_schema_defaults(self, schema: Type[T], prompt: str) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for field_name, field_info in schema.model_fields.items():
            annotation = str(field_info.annotation).lower()
            if "list" in annotation:
                value: Any = []
            elif "int" in annotation:
                value = 0
            elif "float" in annotation:
                value = 0.0
            elif "bool" in annotation:
                value = False
            elif "dict" in annotation:
                value = {}
            else:
                value = f"Offline simulation placeholder for {field_name}."
            if field_info.is_required():
                result[field_name] = value
        return result

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise json.JSONDecodeError("Expected a JSON object", cleaned, 0)
        return parsed


llm_client = LLMClient()
