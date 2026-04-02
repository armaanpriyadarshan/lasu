import base64
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def read_inbox(user_id: str, max_results: int = 10) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("gmail", "v1", credentials=creds)
    results = service.users().messages().list(
        userId="me", maxResults=max_results, labelIds=["INBOX"]
    ).execute()

    messages = results.get("messages", [])
    if not messages:
        return "Inbox is empty."

    lines = []
    for msg_ref in messages[:max_results]:
        msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"]).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        lines.append(f"- From: {headers.get('From', '?')} | Subject: {headers.get('Subject', '(no subject)')} | {headers.get('Date', '')}")

    return "\n".join(lines)


async def send_email(user_id: str, to: str, subject: str, body: str) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("gmail", "v1", credentials=creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return f"Email sent to {to} (ID: {sent['id']})"


def register_email_tools():
    register_tool(
        name="read_inbox",
        description="Read recent emails from the user's Gmail inbox.",
        permission="email",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "max_results": {"type": "integer", "description": "Number of emails (default 10)", "default": 10},
            },
            "required": ["user_id"],
        },
        fn=read_inbox,
    )
    register_tool(
        name="send_email",
        description="Send an email on behalf of the user via Gmail.",
        permission="email",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "The user's ID"},
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject"},
                "body": {"type": "string", "description": "Email body text"},
            },
            "required": ["user_id", "to", "subject", "body"],
        },
        fn=send_email,
    )
