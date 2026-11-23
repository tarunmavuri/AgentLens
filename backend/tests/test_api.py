import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import init_db
from backend.app.golden_runs import seed_golden_runs

@pytest.fixture(scope="module")
def client():
    init_db()
    seed_golden_runs()
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_concepts(client):
    res = client.get("/concepts")
    assert res.status_code == 200
    concepts = res.json()
    assert len(concepts) == 8
    ids = [c["id"] for c in concepts]
    assert "react" in ids
    assert "guardrails" in ids

def test_list_runs_and_golden_runs(client):
    res = client.get("/runs")
    assert res.status_code == 200
    runs = res.json()
    assert len(runs) >= 2  # Golden runs should be seeded

def test_create_and_get_run(client):
    res = client.post("/runs", json={"goal": "Test goal via API"})
    assert res.status_code == 200
    data = res.json()
    assert "run_id" in data
    run_id = data["run_id"]

    res_get = client.get(f"/runs/{run_id}")
    assert res_get.status_code == 200
    assert res_get.json()["goal"] == "Test goal via API"

def test_export_trace(client):
    res = client.get("/runs/golden-run-rag-vs-finetuning/trace")
    assert res.status_code == 200
    trace = res.json()
    assert trace["run_id"] == "golden-run-rag-vs-finetuning"
    assert "events" in trace
    assert len(trace["events"]) > 0

def test_agents_crud_and_test(client):
    # 1. List
    res = client.get("/agents")
    assert res.status_code == 200
    agents = res.json()
    assert len(agents) >= 4

    # 2. Create
    new_agent_payload = {
        "name": "API Testing Agent",
        "description": "Verifies API schemas and responses.",
        "role": "QA Engineer",
        "instructions": "Test API responses for consistency.",
        "allowed_tools": ["read_memory"],
        "enabled": True
    }
    create_res = client.post("/agents", json=new_agent_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    agent_id = created["agent_id"]
    assert created["name"] == "API Testing Agent"

    # 3. Toggle
    toggle_res = client.post(f"/agents/{agent_id}/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["enabled"] is False

    # 4. Duplicate
    dup_res = client.post(f"/agents/{agent_id}/duplicate")
    assert dup_res.status_code == 200
    dup_id = dup_res.json()["agent_id"]

    # 5. Independent Test
    test_res = client.post(f"/agents/{agent_id}/test", json={"test_prompt": "Validate sample JSON schema"})
    assert test_res.status_code == 200
    assert "result" in test_res.json()

    # 6. Delete
    del_res = client.delete(f"/agents/{agent_id}")
    assert del_res.status_code == 200
    client.delete(f"/agents/{dup_id}")

def test_tools_endpoints(client):
    res = client.get("/tools")
    assert res.status_code == 200
    tools = res.json()
    assert len(tools) >= 3

    tool_res = client.get("/tools/web_search")
    assert tool_res.status_code == 200
    assert tool_res.json()["name"] == "web_search"
