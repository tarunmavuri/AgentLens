from typing import Callable, Any, Optional
from pydantic import BaseModel

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict[str, Any]
    category: str = "general"

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._handlers: dict[str, Callable] = {}

    def register(self, definition: ToolDefinition, handler: Callable):
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        return list(self._tools.values())

    async def execute(self, name: str, **kwargs) -> Any:
        if name not in self._handlers:
            raise ValueError(f"Tool '{name}' not found in registry")
        handler = self._handlers[name]
        return await handler(**kwargs)

tool_registry = ToolRegistry()

