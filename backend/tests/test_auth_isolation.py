"""Authentication enforcement and per-user data isolation tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from firebase_admin import auth as firebase_auth

from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.main import app


@pytest.fixture()
def raw_client():
    app.dependency_overrides.pop(get_current_user, None)
    with TestClient(app) as test_client:
        yield test_client


def test_protected_routes_require_authentication(raw_client):
    assert raw_client.get("/runs").status_code == 401
    assert raw_client.post("/runs", json={"goal": "Unauthenticated run"}).status_code == 401
    assert raw_client.get("/agents").status_code == 401
    assert raw_client.post("/agents", json={"name": "x"}).status_code == 401
    assert raw_client.get("/tools").status_code == 401
    assert raw_client.get("/auth/me").status_code == 401

    # Public routes remain accessible
    assert raw_client.get("/health").status_code == 200
    assert raw_client.get("/config").status_code == 200
    assert raw_client.get("/concepts").status_code == 200


def test_invalid_and_expired_tokens_rejected(raw_client):
    assert (
        raw_client.get("/runs", headers={"Authorization": "Basic abc"}).status_code
        == 401
    )

    with patch("backend.app.auth._ensure_firebase_app", return_value=object()), patch(
        "backend.app.auth.firebase_auth.verify_id_token",
        side_effect=firebase_auth.InvalidIdTokenError("bad token"),
    ):
        res = raw_client.get("/auth/me", headers={"Authorization": "Bearer bad-token"})
        assert res.status_code == 401

    with patch("backend.app.auth._ensure_firebase_app", return_value=object()), patch(
        "backend.app.auth.firebase_auth.verify_id_token",
        side_effect=firebase_auth.ExpiredIdTokenError("expired", None),
    ):
        res = raw_client.get("/auth/me", headers={"Authorization": "Bearer expired-token"})
        assert res.status_code == 401


def test_bearer_and_query_token_verification(raw_client):
    with patch("backend.app.auth._ensure_firebase_app", return_value=object()), patch(
        "backend.app.auth.firebase_auth.verify_id_token",
        return_value={"uid": "firebase-uid-123", "email": "alice@example.com", "name": "Alice"},
    ):
        res = raw_client.get("/auth/me", headers={"Authorization": "Bearer valid-jwt"})
        assert res.status_code == 200
        assert res.json()["uid"] == "firebase-uid-123"
        assert res.json()["email"] == "alice@example.com"

        # Query token is supported for SSE EventSource connections
        res_query = raw_client.get("/auth/me?token=valid-jwt")
        assert res_query.status_code == 200
        assert res_query.json()["uid"] == "firebase-uid-123"


def test_user_data_isolation_for_runs_and_custom_agents():
    user_a = AuthenticatedUser(uid="user-a", email="a@example.com", name="User A")
    user_b = AuthenticatedUser(uid="user-b", email="b@example.com", name="User B")

    current = {"user": user_a}
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    try:
        with TestClient(app) as client:
            # User A creates a run and a custom agent
            run_res = client.post("/runs", json={"goal": "User A private research goal"})
            assert run_res.status_code == 200
            run_id_a = run_res.json()["run_id"]

            agent_res = client.post(
                "/agents",
                json={
                    "name": "Alice Private Auditor",
                    "description": "Private custom agent for Alice.",
                    "role": "Private Auditor",
                    "instructions": "Audit Alice's private data carefully.",
                    "allowed_tools": ["read_memory"],
                },
            )
            assert agent_res.status_code == 200
            agent_id_a = agent_res.json()["agent_id"]
            assert agent_res.json()["user_id"] == "user-a"

            # Switch to User B
            current["user"] = user_b

            # User B cannot see User A's run in list or direct access
            runs_b = {r["id"] for r in client.get("/runs").json()}
            assert run_id_a not in runs_b
            assert "golden-run-rag-vs-finetuning" in runs_b

            assert client.get(f"/runs/{run_id_a}").status_code == 404
            assert client.get(f"/runs/{run_id_a}/metrics").status_code == 404
            assert client.get(f"/runs/{run_id_a}/trace").status_code == 404
            assert client.get(f"/runs/{run_id_a}/events").status_code == 404

            # User B cannot see or mutate User A's custom agent
            agents_b = {a["agent_id"] for a in client.get("/agents").json()}
            assert agent_id_a not in agents_b
            assert client.get(f"/agents/{agent_id_a}").status_code == 404
            assert (
                client.put(f"/agents/{agent_id_a}", json={"name": "Hijacked"}).status_code
                == 404
            )
            assert client.delete(f"/agents/{agent_id_a}").status_code == 404
            assert client.post(f"/agents/{agent_id_a}/toggle").status_code == 404
            assert (
                client.post(f"/agents/{agent_id_a}/test", json={"test_prompt": "hello"}).status_code
                == 404
            )
            assert client.get(f"/agents/{agent_id_a}/history").status_code == 404

            # System template agents cannot be mutated directly, only duplicated
            assert (
                client.put("/agents/security_reviewer", json={"name": "Modified"}).status_code
                == 403
            )
            assert client.delete("/agents/security_reviewer").status_code == 403
            assert client.post("/agents/security_reviewer/toggle").status_code == 403

            dup_b = client.post("/agents/security_reviewer/duplicate")
            assert dup_b.status_code == 200
            dup_id_b = dup_b.json()["agent_id"]
            assert dup_b.json()["user_id"] == "user-b"
            assert client.post(f"/agents/{dup_id_b}/toggle").status_code == 200
            assert client.delete(f"/agents/{dup_id_b}").status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
