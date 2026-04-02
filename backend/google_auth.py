import os
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from db import get_oauth_token, save_oauth_token

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _get_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=os.environ["GOOGLE_REDIRECT_URI"],
    )


_pending_verifiers: dict[str, str] = {}


def get_auth_url(user_id: str) -> str:
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=user_id,
    )
    # Store the code verifier so we can use it during token exchange
    _pending_verifiers[user_id] = flow.code_verifier
    return auth_url


async def exchange_code(code: str, user_id: str) -> dict:
    flow = _get_flow()
    flow.code_verifier = _pending_verifiers.pop(user_id, None)
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_data = await save_oauth_token(
        user_id=user_id,
        provider="google",
        access_token=creds.token,
        refresh_token=creds.refresh_token,
        token_expiry=creds.expiry.isoformat() if creds.expiry else None,
        scopes=" ".join(SCOPES),
    )
    return token_data


async def get_google_credentials(user_id: str) -> Credentials | None:
    token = await get_oauth_token(user_id, "google")
    if not token:
        return None

    creds = Credentials(
        token=token["access_token"],
        refresh_token=token.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    )

    if not creds.valid and creds.refresh_token:
        creds.refresh(GoogleRequest())
        await save_oauth_token(
            user_id=user_id,
            provider="google",
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_expiry=creds.expiry.isoformat() if creds.expiry else None,
            scopes=token.get("scopes", ""),
        )

    return creds if creds.valid else None
