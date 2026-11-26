import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.main import app
from backend.app.middleware import RateLimitMiddleware

GOLDEN_RUN = "golden-run-rag-vs-finetuning"


@pytest.fixture(scope="module")
def client():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        uid="test-user-1",
        email="tester@example.com",
        name="Test User",
    )
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _sse_events(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[len("data: "):]))
    return events


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["llm_mode"] == "offline_simulation"


def test_config_endpoint_has_no_secrets(client):
    res = client.get("/config")
    assert res.status_code == 200
    body = res.json()
    assert body["llm_mode"] == "offline_simulation"
    assert "limits" in body and "pricing_per_million_tokens" in body
    serialized = json.dumps(body).lower()
    assert "api_key" not in serialized
    assert "gemini_api_key" not in serialized


def test_concepts(client):
    res = client.get("/concepts")
    assert res.status_code == 200
    concepts = res.json()
    assert len(concepts) == 8
    assert {"react", "guardrails", "evaluation"} <= {c["id"] for c in concepts}


def test_list_runs_and_golden_runs(client):
    res = client.get("/runs")
    assert res.status_code == 200
    runs = {run["id"]: run for run in res.json()}
    assert GOLDEN_RUN in runs
    assert runs[GOLDEN_RUN]["status"] == "completed"
    assert runs[GOLDEN_RUN]["totals"]["steps"] > 0


def test_create_and_get_run(client):
    res = client.post("/runs", json={"goal": "Test goal via API"})
    assert res.status_code == 200
    run_id = res.json()["run_id"]

    detail = client.get(f"/runs/{run_id}")
    assert detail.status_code == 200
    assert detail.json()["goal"] == "Test goal via API"
    assert detail.json()["status"] in {"completed", "completed_with_errors", "running"}


def test_run_validation(client):
    assert client.post("/runs", json={"goal": "ab"}).status_code == 422
    bad_config = client.post(
        "/runs", json={"goal": "valid goal", "config": {"max_steps": 9999}}
    )
    assert bad_config.status_code == 422
    unknown_key = client.post(
        "/runs", json={"goal": "valid goal", "config": {"unknown": 1}}
    )
    assert unknown_key.status_code == 422


def test_trace_matches_metrics(client):
    trace = client.get(f"/runs/{GOLDEN_RUN}/trace").json()
    metrics = client.get(f"/runs/{GOLDEN_RUN}/metrics").json()
    computed = metrics["computed"]

    assert trace["events_count"] == len(trace["events"]) == computed["events"]
    trace_in = sum(e["usage"]["in_tokens"] for e in trace["events"] if e["usage"])
    trace_out = sum(e["usage"]["out_tokens"] for e in trace["events"] if e["usage"])
    assert trace_in == computed["in_tokens"]
    assert trace_out == computed["out_tokens"]
    # Stored run totals come from the same events.
    assert trace["totals"]["in_tokens"] == trace_in
    assert trace["totals"]["out_tokens"] == trace_out
    assert abs(trace["totals"]["cost_usd"] - computed["cost_usd"]) < 1e-9
    assert computed["agents"], "agent-level breakdown must be present"


def test_sse_replays_history_and_resumes(client):
    with client.stream("GET", f"/runs/{GOLDEN_RUN}/events") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        full_events = _sse_events("".join(response.iter_text()))

    assert len(full_events) >= 20
    assert [e["id"] for e in full_events] == sorted(e["id"] for e in full_events)

    with client.stream(
        "GET", f"/runs/{GOLDEN_RUN}/events", headers={"Last-Event-ID": "10"}
    ) as response:
        resumed = _sse_events("".join(response.iter_text()))

    assert resumed
    assert all(event["id"] > 10 for event in resumed)
    assert resumed[0]["id"] == 11


def test_agent_crud_validation_permissions_and_history(client):
    payload = {
        "name": "API Testing Agent",
        "description": "Verifies API schemas and responses.",
        "role": "QA Engineer",
        "instructions": "Test API responses for consistency.",
        "allowed_tools": ["read_memory"],
        "enabled": True,
    }
    created = client.post("/agents", json=payload)
    assert created.status_code == 200
    agent_id = created.json()["agent_id"]

    # Invalid configurations are rejected server-side.
    bad_model = client.post(
        "/agents", json={**payload, "llm_config": {"model": "gpt-4o", "temperature": 0.2}}
    )
    assert bad_model.status_code == 400
    bad_tool = client.post("/agents", json={**payload, "allowed_tools": ["rm_rf"]})
    assert bad_tool.status_code == 400
    bad_steps = client.post(
        "/agents", json={**payload, "execution_limits": {"max_steps": 500, "timeout_seconds": 60}}
    )
    assert bad_steps.status_code == 400

    # Isolated test while enabled.
    test_res = client.post(
        f"/agents/{agent_id}/test", json={"test_prompt": "Validate sample JSON schema"}
    )
    assert test_res.status_code == 200
    body = test_res.json()
    assert body["result"]["status"] == "completed"
    # Permission enforcement: the agent may only read memory, so it never calls a tool.
    assert not [e for e in body["events"] if e["type"] == "tool_call"]

    # Disabled agents cannot execute (test endpoint and orchestrator both enforce it).
    toggle = client.post(f"/agents/{agent_id}/toggle")
    assert toggle.status_code == 200 and toggle.json()["enabled"] is False
    assert (
        client.post(f"/agents/{agent_id}/test", json={"test_prompt": "again"}).status_code
        == 400
    )

    duplicate = client.post(f"/agents/{agent_id}/duplicate")
    assert duplicate.status_code == 200
    duplicate_id = duplicate.json()["agent_id"]
    assert duplicate.json()["agent_type"] == "custom"

    history = client.get(f"/agents/{agent_id}/history")
    assert history.status_code == 200
    assert "executions" in history.json()

    assert client.delete(f"/agents/{agent_id}").status_code == 200
    assert client.delete(f"/agents/{duplicate_id}").status_code == 200


def test_builtin_agent_protections(client):
    assert client.delete("/agents/planner").status_code == 400
    # The orchestrator's own agents cannot be disabled.
    assert client.post("/agents/planner/toggle").status_code == 400
    assert client.post("/agents/critic/toggle").status_code == 400
    # System agents are not independently testable.
    assert (
        client.post("/agents/critic/test", json={"test_prompt": "hello"}).status_code == 400
    )


def test_agent_history_from_golden_run(client):
    res = client.get("/agents/researcher/history")
    assert res.status_code == 200
    executions = res.json()["executions"]
    assert executions
    assert any(item["run_id"].startswith("golden-run") for item in executions)
    assert any(item["tool_calls"] >= 1 for item in executions)


def test_tools_endpoints(client):
    res = client.get("/tools")
    assert res.status_code == 200
    tools = {tool["name"] for tool in res.json()}
    assert {"web_search", "python_sandbox", "read_memory", "write_memory"} <= tools
    assert client.get("/tools/web_search").json()["category"] == "research"


def test_rate_limit_middleware():
    limited_app = FastAPI()
    limited_app.add_middleware(RateLimitMiddleware, limit=2, window_seconds=60)

    @limited_app.post("/runs")
    def _create():
        return {"ok": True}

    with TestClient(limited_app) as limited_client:
        assert limited_client.post("/runs").status_code == 200
        assert limited_client.post("/runs").status_code == 200
        blocked = limited_client.post("/runs")
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers
