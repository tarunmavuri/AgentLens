from fastapi import APIRouter, Depends, HTTPException

from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.tools.registry import tool_registry, ToolDefinition

router = APIRouter(prefix="/tools", tags=["tools"])

@router.get("", response_model=list[ToolDefinition])
def list_tools(_: AuthenticatedUser = Depends(get_current_user)):
    return tool_registry.list_tools()

@router.get("/{tool_name}", response_model=ToolDefinition)
def get_tool(tool_name: str, _: AuthenticatedUser = Depends(get_current_user)):
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    return tool

