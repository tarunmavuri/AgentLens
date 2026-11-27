"""Cloudflare Access authentication enforcement and per-user data isolation tests."""

from __future__ import annotations

import time
from types import SimpleNamespace
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.config import settings
from backend.app.main import app


def _make_rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


@pytest.fixture()
def raw_client():
    app.dependency_overrides.pop(get_current_user, None)
    with TestClient(app) as test_client:
        yield test_client


def test_cloudflare_access_rejects_unauthenticated_and_invalid_tokens(raw_client, monkeypatch):
    private_key, public_key = _make_rsa_keypair()
    team_domain = "https://agentlens-test.cloudflareaccess.com"
    audience = "test-aud-tag-123"

    monkeypatch.setattr(settings, "cloudflare_team_domain", team_domain)
    monkeypatch.setattr(settings, "cloudflare_access_aud", audience)
    monkeypatch.setattr(settings, "allow_local_dev_auth", False)

    fake_jwk_client = SimpleNamespace(
        get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)
    )

    with patch("backend.app.auth._get_jwk_client", return_value=fake_jwk_client):
        # Missing token -> 401 on protected routes
        assert raw_client.get("/runs").status_code == 401
        assert raw_client.post("/runs", json={"goal": "Unauthenticated run"}).status_code == 401
        assert raw_client.get("/agents").status_code == 401
        assert raw_client.get("/tools").status_code == 401
        assert raw_client.get("/auth/me").status_code == 401

        # Public routes remain accessible
        assert raw_client.get("/health").status_code == 200
        assert raw_client.get("/config").status_code == 200
        assert raw_client.get("/concepts").status_code == 200

        # Invalid token -> 401
        assert (
            raw_client.get(
                "/auth/me", headers={"Cf-Access-Jwt-Assertion": "not.a.jwt"}
            ).status_code
            == 401
        )

        # Expired token -> 401
        expired_jwt = jwt.encode(
            {
                "sub": "cf-user-1",
                "email": "alice@example.com",
                "aud": audience,
                "iss": team_domain,
                "exp": int(time.time()) - 60,
            },
            private_key,
            algorithm="RS256",
        )
        assert (
            raw_client.get(
                "/auth/me", headers={"Cf-Access-Jwt-Assertion": expired_jwt}
            ).status_code
            == 401
        )

        # Wrong audience -> 401
        wrong_aud_jwt = jwt.encode(
            {
                "sub": "cf-user-1",
                "email": "alice@example.com",
                "aud": "wrong-aud",
                "iss": team_domain,
                "exp": int(time.time()) + 300,
            },
            private_key,
            algorithm="RS256",
        )
        assert (
            raw_client.get(
                "/auth/me", headers={"Cf-Access-Jwt-Assertion": wrong_aud_jwt}
            ).status_code
            == 401
        )

        # Valid Cloudflare Access JWT via Cf-Access-Jwt-Assertion header or CF_Authorization cookie
        valid_jwt = jwt.encode(
            {
                "sub": "cf-uid-123",
                "email": "alice@example.com",
                "name": "Alice",
                "aud": audience,
                "iss": team_domain,
                "exp": int(time.time()) + 300,
            },
            private_key,
            algorithm="RS256",
        )
        res = raw_client.get("/auth/me", headers={"Cf-Access-Jwt-Assertion": valid_jwt})
        assert res.status_code == 200
        assert res.json()["uid"] == "cf-uid-123"
        assert res.json()["email"] == "alice@example.com"
        assert res.json()["auth_provider"] == "cloudflare_access"

        res_cookie = raw_client.get("/auth/me", cookies={"CF_Authorization": valid_jwt})
        assert res_cookie.status_code == 200
        assert res_cookie.json()["uid"] == "cf-uid-123"


def test_local_dev_auth_fallback_and_production_guard(raw_client, monkeypatch):
    monkeypatch.setattr(settings, "cloudflare_team_domain", "")
    monkeypatch.setattr(settings, "cloudflare_access_aud", "")

    monkeypatch.setattr(settings, "allow_local_dev_auth", True)
    dev_res = raw_client.get("/auth/me")
    assert dev_res.status_code == 200
    assert dev_res.json()["auth_provider"] == "local_dev"

    monkeypatch.setattr(settings, "allow_local_dev_auth", False)
    prod_res = raw_client.get("/auth/me")
    assert prod_res.status_code == 503


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
