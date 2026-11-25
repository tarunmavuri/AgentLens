"""HTTP middleware: per-client rate limiting for expensive endpoints."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from typing import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

PROTECTED_PREFIXES = ("/runs", "/agents")


def _is_rate_limited_request(request: Request) -> bool:
    if request.method != "POST":
        return False
    path = request.url.path
    if path == "/runs" or path.rstrip("/") == "/runs":
        return True
    return path.startswith(PROTECTED_PREFIXES[1]) and path.endswith("/test")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window counter keyed by client IP.

    In-process only: with multiple backend workers each process keeps its own
    window. That is sufficient to stop accidental runaway loops from one
    browser; production deployments should also rate limit at the edge.
    """

    def __init__(self, app, limit: int, window_seconds: int) -> None:
        super().__init__(app)
        self.limit = limit
        self.window = max(1, window_seconds)
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if self.limit <= 0 or not _is_rate_limited_request(request):
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.window

        async with self._lock:
            hits = [stamp for stamp in self._hits[client] if stamp >= cutoff]
            if len(hits) >= self.limit:
                retry_after = max(1, int(self.window - (now - hits[0])) + 1)
                self._hits[client] = hits
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": (
                            f"Rate limit exceeded ({self.limit} requests per "
                            f"{self.window}s). Retry in {retry_after}s."
                        )
                    },
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)
            self._hits[client] = hits
            # Opportunistic cleanup so the dict cannot grow without bound.
            if len(self._hits) > 2048:
                for key in [k for k, v in self._hits.items() if not v or v[-1] < cutoff]:
                    self._hits.pop(key, None)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - len(hits)))
        return response
