"""Cloudflare Access JWT verification and user identity extraction."""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Cookie, Header, HTTPException, Query, status
from pydantic import BaseModel

from backend.app.config import settings

logger = logging.getLogger(__name__)


class AuthenticatedUser(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    auth_provider: str = "cloudflare_access"


def _normalize_team_domain(domain: str) -> str:
    cleaned = domain.strip().rstrip("/")
    if not cleaned:
        return ""
    if not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    return cleaned


@lru_cache(maxsize=4)
def _get_jwk_client(certs_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(certs_url, cache_keys=True, lifespan=300)


def verify_cloudflare_token(id_token: str) -> AuthenticatedUser:
    """Verify a Cloudflare Access JWT against the team's JWKS endpoint."""
    team_domain = _normalize_team_domain(settings.cloudflare_team_domain)
    audience = settings.cloudflare_access_aud.strip()
    if not team_domain or not audience:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Cloudflare Access authentication is not configured. Set "
                "CLOUDFLARE_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD."
            ),
        )

    certs_url = f"{team_domain}/cdn-cgi/access/certs"
    try:
        jwk_client = _get_jwk_client(certs_url)
        signing_key = jwk_client.get_signing_key_from_jwt(id_token)
        decoded = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=team_domain,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cloudflare Access session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Cloudflare Access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        logger.warning("Cloudflare Access token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify Cloudflare Access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = str(decoded.get("sub") or decoded.get("email") or "").strip()
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cloudflare Access token is missing a user identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = decoded.get("email")
    name = decoded.get("name") or (
        email.split("@")[0] if isinstance(email, str) and "@" in email else None
    )

    return AuthenticatedUser(
        uid=uid,
        email=email,
        name=name,
        auth_provider="cloudflare_access",
    )


def _extract_access_token(
    cf_access_jwt: Optional[str],
    cf_authorization_cookie: Optional[str],
    authorization: Optional[str],
    token_query: Optional[str],
) -> str:
    if cf_access_jwt and cf_access_jwt.strip():
        return cf_access_jwt.strip()

    if cf_authorization_cookie and cf_authorization_cookie.strip():
        return cf_authorization_cookie.strip()

    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value.strip():
            return value.strip()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must use Bearer token format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_query and token_query.strip():
        return token_query.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Cloudflare Access authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    cf_access_jwt: Optional[str] = Header(default=None, alias="Cf-Access-Jwt-Assertion"),
    cf_authorization_cookie: Optional[str] = Cookie(default=None, alias="CF_Authorization"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    token: Optional[str] = Query(default=None, alias="token"),
) -> AuthenticatedUser:
    """FastAPI dependency enforcing Cloudflare Access JWT authentication."""
    if settings.cloudflare_auth_configured:
        raw_token = _extract_access_token(
            cf_access_jwt,
            cf_authorization_cookie,
            authorization,
            token,
        )
        return await asyncio.to_thread(verify_cloudflare_token, raw_token)

    if settings.allow_local_dev_auth:
        return AuthenticatedUser(
            uid=settings.local_dev_user_id,
            email=settings.local_dev_user_email,
            name="Local Developer",
            auth_provider="local_dev",
        )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Cloudflare Access authentication is not configured. Set "
            "CLOUDFLARE_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD."
        ),
    )
