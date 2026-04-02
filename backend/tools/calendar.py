from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_events(user_id: str, days: int = 7) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("calendar", "v3", credentials=creds)
    now = datetime.utcnow().isoformat() + "Z"
    end = (datetime.utcnow() + timedelta(days=days)).isoformat() + "Z"

    events_result = service.events().list(
        calendarId="primary", timeMin=now, timeMax=end,
        maxResults=20, singleEvents=True, orderBy="startTime"
    ).execute()

    events = events_result.get("items", [])
    if not events:
        return f"No events in the next {days} days."

    lines = []
    for e in events:
        start = e["start"].get("dateTime", e["start"].get("date"))
        lines.append(f"- {start}: {e.get('summary', 'No title')}")
    return "\n".join(lines)


async def create_event(user_id: str, summary: str, start_time: str, end_time: str, description: str = "") -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("calendar", "v3", credentials=creds)
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_time, "timeZone": "UTC"},
        "end": {"dateTime": end_time, "timeZone": "UTC"},
    }
    created = service.events().insert(calendarId="primary", body=event).execute()
    return f"Event created: {created.get('summary')} at {created['start'].get('dateTime')}"


def register_calendar_tools():
    register_tool(
        name="list_calendar_events",
        description="List upcoming events from the user's Google Calendar.",
        permission="calendar",
        parameters={
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "Days ahead to look (default 7)", "default": 7},
            },
            "required": [],
        },
        fn=list_events,
    )
    register_tool(
        name="create_calendar_event",
        description="Create a new event on the user's Google Calendar.",
        permission="calendar",
        parameters={
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Event title"},
                "start_time": {"type": "string", "description": "Start time ISO 8601"},
                "end_time": {"type": "string", "description": "End time ISO 8601"},
                "description": {"type": "string", "description": "Event description", "default": ""},
            },
            "required": ["summary", "start_time", "end_time"],
        },
        fn=create_event,
    )
