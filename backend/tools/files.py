from googleapiclient.discovery import build
from google_auth import get_google_credentials
from tools import register_tool


async def list_files(user_id: str, query: str = "", max_results: int = 20) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("drive", "v3", credentials=creds)

    q = f"name contains '{query}'" if query else None
    results = service.files().list(
        q=q, pageSize=max_results,
        fields="files(id, name, mimeType, modifiedTime, size)"
    ).execute()

    files = results.get("files", [])
    if not files:
        return f"No files found{' matching ' + query if query else ''}."

    lines = []
    for f in files:
        size = f.get("size", "?")
        lines.append(f"- {f['name']} ({f.get('mimeType', '?')}, {size} bytes, modified {f.get('modifiedTime', '?')})")

    return "\n".join(lines)


async def read_file(user_id: str, file_id: str) -> str:
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    service = build("drive", "v3", credentials=creds)

    try:
        file_meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()

        if file_meta["mimeType"] == "application/vnd.google-apps.document":
            content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else str(content)
        else:
            content = service.files().get_media(fileId=file_id).execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else str(content)

        return text[:5000] if len(text) > 5000 else text
    except Exception as e:
        return f"Failed to read file: {e}"


async def create_google_doc(user_id: str, title: str, content: str = "") -> str:
    """Create a new Google Doc with optional initial content."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    # Create the doc via Drive API
    drive_service = build("drive", "v3", credentials=creds)
    file_metadata = {
        "name": title,
        "mimeType": "application/vnd.google-apps.document",
    }
    created = drive_service.files().create(body=file_metadata, fields="id,name,webViewLink").execute()
    doc_id = created["id"]
    link = created.get("webViewLink", "")

    # If content provided, write it via Docs API
    if content:
        docs_service = build("docs", "v1", credentials=creds)
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={"requests": [{"insertText": {"location": {"index": 1}, "text": content}}]},
        ).execute()

    return f"Created Google Doc: '{title}' — {link}"


async def write_to_doc(user_id: str, file_id: str, content: str) -> str:
    """Append text to an existing Google Doc."""
    creds = await get_google_credentials(user_id)
    if not creds:
        return "Google account not connected. Please connect your Google account first."

    docs_service = build("docs", "v1", credentials=creds)

    # Get current doc length to append at end
    doc = docs_service.documents().get(documentId=file_id).execute()
    end_index = doc["body"]["content"][-1]["endIndex"] - 1

    docs_service.documents().batchUpdate(
        documentId=file_id,
        body={"requests": [{"insertText": {"location": {"index": end_index}, "text": "\n" + content}}]},
    ).execute()

    return f"Appended text to document '{doc.get('title', file_id)}'"


def register_files_tools():
    register_tool(
        name="list_drive_files",
        description="List or search files in the user's Google Drive.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (optional)", "default": ""},
                "max_results": {"type": "integer", "description": "Max files (default 20)", "default": 20},
            },
            "required": [],
        },
        fn=list_files,
    )
    register_tool(
        name="read_drive_file",
        description="Read the content of a text file from Google Drive.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "file_id": {"type": "string", "description": "The Google Drive file ID"},
            },
            "required": ["file_id"],
        },
        fn=read_file,
    )
    register_tool(
        name="create_google_doc",
        description="Create a new Google Doc. Use when the user asks to create a document, write something up, or draft a doc.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Document title"},
                "content": {"type": "string", "description": "Initial content for the doc (optional)", "default": ""},
            },
            "required": ["title"],
        },
        fn=create_google_doc,
    )
    register_tool(
        name="write_to_doc",
        description="Append text to an existing Google Doc. Use when the user wants to add content to a document.",
        permission="files",
        parameters={
            "type": "object",
            "properties": {
                "file_id": {"type": "string", "description": "The Google Drive file ID of the doc"},
                "content": {"type": "string", "description": "Text to append to the document"},
            },
            "required": ["file_id", "content"],
        },
        fn=write_to_doc,
    )
