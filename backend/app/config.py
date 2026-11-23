import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    app_name: str = "AgentLens"
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    default_model: str = os.getenv("DEFAULT_MODEL", "gemini-2.5-flash")
    db_path: str = os.getenv("DB_PATH", "agentlens.db")
    cors_origins: list[str] = ["*"]
    sandbox_timeout_seconds: int = 10
    max_steps_default: int = 25
    max_tokens_default: int = 60000
    max_seconds_default: int = 120

settings = Settings()

