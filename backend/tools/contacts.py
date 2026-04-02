from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_contacts(user_id: str, query: str = "", max_results: int = 20) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("people", "v1", credentials=creds)

    if query:
        results = service.people().searchContacts(
            query=query, readMask="names,emailAddresses,phoneNumbers", pageSize=max_results
        ).execute()
        contacts = results.get("results", [])
        people = [r.get("person", {}) for r in contacts]
    else:
        results = service.people().connections().list(
            resourceName="people/me", pageSize=max_results,
            personFields="names,emailAddresses,phoneNumbers"
        ).execute()
        people = results.get("connections", [])

    if not people:
        return f"No contacts found{' matching ' + query if query else ''}."

    lines = []
    for person in people:
        name = person.get("names", [{}])[0].get("displayName", "Unknown")
        email = person.get("emailAddresses", [{}])[0].get("value", "")
        phone = person.get("phoneNumbers", [{}])[0].get("value", "")
        parts = [name]
        if email:
            parts.append(email)
        if phone:
            parts.append(phone)
        lines.append(f"- {' | '.join(parts)}")

    return "\n".join(lines)


def register_contacts_tools():
    register_tool(
        name="list_contacts",
        description="List or search the user's Google contacts.",
        permission="contacts",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (optional)", "default": ""},
                "max_results": {"type": "integer", "description": "Max contacts (default 20)", "default": 20},
            },
            "required": [],
        },
        fn=list_contacts,
    )
