"""
Configuration for the Bondfire ETH Boulder Journal.
Loads from environment variables or .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DELVE_API_KEY = os.getenv("DELVE_API_KEY", "8n5l-sJnrHjywrTnJ3rJCjo1f1uLyTPYy_yLgq_bf-d")
BONFIRE_ID = os.getenv("BONFIRE_ID", "698b70002849d936f4259848")
AGENT_ID = os.getenv("JOURNAL_AGENT_ID", "698b70742849d936f4259849")  # Using ethboulder agent
BASE_URL = os.getenv("DELVE_BASE_URL", "https://tnt-v2.api.bonfires.ai")

# Existing ETH Boulder agent (for reference/fallback)
ETHBOULDER_AGENT_ID = "698b70742849d936f4259849"
