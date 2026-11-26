"""Firebase ID token verification and user identity extraction."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import firebase_admin
from fastapi import Header, HTTPException, Query, status
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from pydantic import BaseModel

from backend.app.config import settings

logger = logging.getLogger(__name__)


class AuthenticatedUser(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None


def _ensure_firebase_app() -> firebase_admin.App:
    """Lazily initialize the default Firebase Admin app."""
    if firebase_admin._apps:
        return firebase_admin.get_app()

    creds_json = settings.firebase_credentials_json.strip()
    creds_path = settings.firebase_credentials_path.strip()
    project_id = settings.firebase_project_id.strip()

    options = {"projectId": project_id} if project_id else None

    if creds_json:
        try:
            service_account_info = json.loads(creds_json)
        except json.JSONDecodeError as exc:
            logger.error("Invalid FIREBASE_CREDENTIALS_JSON: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase server credentials are misconfigured.",
            ) from exc
        cred = credentials.Certificate(service_account_info)
        return firebase_admin.initialize_app(cred, options=options)

    if creds_path:
        try:
            cred = credentials.Certificate(creds_path)
        except Exception as exc:
            logger.error("Failed to load FIREBASE_CREDENTIALS_PATH '%s': %s", creds_path, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase server credentials file could not be loaded.",
            ) from exc
        return firebase_admin.initialize_app(cred, options=options)

    if project_id:
        return firebase_admin.initialize_app(options=options)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Firebase authentication is not configured. Set FIREBASE_PROJECT_ID, "
            "FIREBASE_CREDENTIALS_JSON, or FIREBASE_CREDENTIALS_PATH."
        ),
    )


def verify_firebase_token(id_token: str) -> AuthenticatedUser:
    """Verify a Firebase ID token and return the authenticated user identity."""
    app = _ensure_firebase_app()
    try:
        decoded = firebase_auth.verify_id_token(id_token, app=app)
    except firebase_auth.ExpiredIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except firebase_auth.RevokedIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (firebase_auth.InvalidIdTokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = str(decoded.get("uid") or decoded.get("sub") or "").strip()
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing a user identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(
        uid=uid,
        email=decoded.get("email"),
        name=decoded.get("name"),
        picture=decoded.get("picture"),
    )


def _extract_bearer_token(
    authorization: Optional[str],
    token_query: Optional[str],
) -> str:
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
        detail="Authentication required. Sign in to access this resource.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    token: Optional[str] = Query(default=None, alias="token"),
) -> AuthenticatedUser:
    """FastAPI dependency that enforces Firebase ID token authentication."""
    raw_token = _extract_bearer_token(authorization, token)
    return await asyncio.to_thread(verify_firebase_token, raw_token)
