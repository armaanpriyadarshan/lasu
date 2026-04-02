"""Tool registry for agent capabilities."""

TOOL_REGISTRY: dict[str, dict] = {}


def register_tool(name: str, description: str, permission: str, parameters: dict, fn):
    TOOL_REGISTRY[name] = {
        "name": name,
        "description": description,
        "permission": permission,
        "parameters": parameters,
        "fn": fn,
    }


def get_tool(name: str) -> dict | None:
    return TOOL_REGISTRY.get(name)


def get_all_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in TOOL_REGISTRY.values()
    ]


def get_tool_permission(name: str) -> str | None:
    tool = TOOL_REGISTRY.get(name)
    return tool["permission"] if tool else None
