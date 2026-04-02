import os
import re
import httpx
from tools import register_tool


async def web_search(query: str, max_results: int = 5) -> str:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return "Error: TAVILY_API_KEY not configured"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": True,
            },
            timeout=15.0,
        )

    if response.status_code != 200:
        return f"Search failed with status {response.status_code}"

    data = response.json()
    results = []

    if data.get("answer"):
        results.append(f"Summary: {data['answer']}")

    for r in data.get("results", []):
        results.append(f"- {r['title']}: {r.get('content', '')[:200]} ({r['url']})")

    return "\n".join(results) if results else "No results found."


async def web_fetch(url: str) -> str:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            response = await client.get(url, timeout=10.0, headers={"User-Agent": "Sudo/1.0"})
        except Exception as e:
            return f"Failed to fetch URL: {e}"

    if response.status_code != 200:
        return f"Failed to fetch URL: HTTP {response.status_code}"

    text = response.text
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:3000] if len(text) > 3000 else text


def register_web_tools():
    register_tool(
        name="web_search",
        description="Search the web for information. Use this when you need to find current information, research topics, or answer questions that require up-to-date knowledge.",
        permission="web",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "max_results": {"type": "integer", "description": "Number of results (default 5, max 10)", "default": 5},
            },
            "required": ["query"],
        },
        fn=web_search,
    )

    register_tool(
        name="web_fetch",
        description="Fetch the content of a specific web page. Use when you need to read the full content of a URL.",
        permission="web",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to fetch"},
            },
            "required": ["url"],
        },
        fn=web_fetch,
    )
