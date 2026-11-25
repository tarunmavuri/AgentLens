"""Web search tool: Tavily when configured, DuckDuckGo otherwise.

If every provider is unreachable the tool returns one explicitly-labelled
"unavailable" record. It never fabricates sources or snippets that look real,
because downstream agents treat tool output as evidence.
"""

from __future__ import annotations

import html
import re
import time
import urllib.parse
from typing import Any

import httpx

from backend.app.config import settings
from backend.app.tools.registry import ToolDefinition, tool_registry

USER_AGENT = (
    "Mozilla/5.0 (compatible; AgentLens/1.1; +https://github.com/agentlens) "
    "Python-httpx"
)

_DDG_RESULT_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.DOTALL,
)
_DDG_SNIPPET_RE = re.compile(
    r'<a[^>]+class="result__snippet"[^>]*>(?P<snippet>.*?)</a>', re.DOTALL
)


def _strip_tags(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def _normalise_ddg_url(href: str) -> str:
    if href.startswith("//"):
        href = f"https:{href}"
    if "duckduckgo.com/l/" in href:
        parsed = urllib.parse.urlparse(href)
        target = urllib.parse.parse_qs(parsed.query).get("uddg")
        if target:
            return urllib.parse.unquote(target[0])
    return href


async def _tavily_search(query: str, max_results: int) -> list[dict[str, Any]]:
    if not settings.tavily_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=settings.search_timeout_seconds + 2) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                },
            )
        if response.status_code != 200:
            return []
        results = []
        for item in (response.json().get("results") or [])[:max_results]:
            results.append(
                {
                    "title": item.get("title", "Untitled result"),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", ""),
                    "provider": "tavily",
                }
            )
        return results
    except Exception:
        return []


async def _duckduckgo_html(query: str, max_results: int) -> list[dict[str, Any]]:
    try:
        encoded = urllib.parse.quote_plus(query)
        async with httpx.AsyncClient(
            timeout=settings.search_timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = await client.get(f"https://html.duckduckgo.com/html/?q={encoded}")
        if response.status_code != 200:
            return []

        titles = list(_DDG_RESULT_RE.finditer(response.text))
        snippets = list(_DDG_SNIPPET_RE.finditer(response.text))
        results: list[dict[str, Any]] = []
        for index, match in enumerate(titles[:max_results]):
            snippet = _strip_tags(snippets[index].group("snippet")) if index < len(snippets) else ""
            results.append(
                {
                    "title": _strip_tags(match.group("title")) or "Untitled result",
                    "url": _normalise_ddg_url(match.group("href")),
                    "snippet": snippet,
                    "provider": "duckduckgo",
                }
            )
        return results
    except Exception:
        return []


async def _duckduckgo_instant(query: str, max_results: int) -> list[dict[str, Any]]:
    try:
        encoded = urllib.parse.quote_plus(query)
        async with httpx.AsyncClient(
            timeout=settings.search_timeout_seconds, follow_redirects=True
        ) as client:
            response = await client.get(
                f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
            )
        if response.status_code != 200:
            return []
        data = response.json()
        results: list[dict[str, Any]] = []
        if data.get("AbstractText"):
            results.append(
                {
                    "title": data.get("Heading") or query,
                    "url": data.get("AbstractURL") or f"https://duckduckgo.com/?q={encoded}",
                    "snippet": data.get("AbstractText", ""),
                    "provider": "duckduckgo-instant",
                }
            )
        for topic in (data.get("RelatedTopics") or [])[: max_results - len(results)]:
            if isinstance(topic, dict) and topic.get("FirstURL") and topic.get("Text"):
                results.append(
                    {
                        "title": topic["Text"].split(" - ")[0][:80],
                        "url": topic["FirstURL"],
                        "snippet": topic["Text"],
                        "provider": "duckduckgo-instant",
                    }
                )
        return results[:max_results]
    except Exception:
        return []


def unavailable_result(query: str, reason: str) -> list[dict[str, Any]]:
    return [
        {
            "title": "Web search unavailable",
            "url": "",
            "snippet": (
                f"No search provider returned results for '{query}' ({reason}). "
                "Treat this task as unverified: no sources were retrieved."
            ),
            "provider": "none",
            "status": "unavailable",
        }
    ]


# Small in-process cache: planners and retries often repeat the same query
# within a run, and re-querying the provider adds latency without new evidence.
_CACHE_TTL_SECONDS = 300
_SEARCH_CACHE: dict[tuple[str, int], tuple[float, list[dict[str, Any]]]] = {}


async def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Return up to `max_results` search hits from a real provider."""
    query = (query or "").strip()
    max_results = max(1, min(int(max_results or 5), 10))
    if not query:
        return unavailable_result(query, "empty query")

    key = (query.lower(), max_results)
    cached = _SEARCH_CACHE.get(key)
    if cached and time.time() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    for provider in (_tavily_search, _duckduckgo_html, _duckduckgo_instant):
        results = await provider(query, max_results)
        if results:
            _SEARCH_CACHE[key] = (time.time(), results)
            return results

    results = unavailable_result(query, "all providers unreachable")
    # Cache a short outage so a failing provider is not hammered by retries.
    _SEARCH_CACHE[key] = (time.time() - (_CACHE_TTL_SECONDS - 30), results)
    return results


tool_registry.register(
    ToolDefinition(
        name="web_search",
        description=(
            "Search the web for documentation, benchmarks, papers and articles. "
            "Returns title, url, snippet and the provider that served them."
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results (1-10)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        category="research",
    ),
    web_search,
)
