"""
Delve REST API client for the Bondfire ETH Boulder Journal.
Provides both async (for Discord bot) and sync (for CLI) interfaces.
"""
import aiohttp
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List


class DelveClient:
    """Async client for the Delve/Bonfires REST API."""

    def __init__(self, api_key: str, bonfire_id: str, base_url: str):
        self.api_key = api_key
        self.bonfire_id = bonfire_id
        self.base_url = base_url.rstrip("/")

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def health_check(self) -> Dict[str, Any]:
        """Check API connectivity."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/healthz", timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                return await resp.json()

    # ── Knowledge Graph Search ──────────────────────────────────────

    async def search(
        self,
        query: str,
        num_results: int = 10,
        agent_id: Optional[str] = None,
        graph_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search the unified knowledge graph."""
        payload: Dict[str, Any] = {
            "query": query,
            "bonfire_id": self.bonfire_id,
            "num_results": num_results,
        }
        if agent_id:
            payload["agent_id"] = agent_id
        if graph_id:
            payload["graph_id"] = graph_id

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/delve",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                return await resp.json()

    # ── Agent Stack Operations ──────────────────────────────────────

    async def stack_add(
        self,
        agent_id: str,
        text: str,
        user_id: str = "bettercallzaal",
        chat_id: str = "journal",
    ) -> Dict[str, Any]:
        """Add a single message to the agent stack."""
        payload = {
            "message": {
                "text": text,
                "userId": user_id,
                "chatId": chat_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/agents/{agent_id}/stack/add",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    async def stack_add_paired(
        self,
        agent_id: str,
        user_text: str,
        agent_text: str,
        user_id: str = "bettercallzaal",
        chat_id: str = "journal",
    ) -> Dict[str, Any]:
        """Add a paired user+agent message to the stack."""
        now = datetime.now(timezone.utc)
        payload = {
            "messages": [
                {
                    "text": user_text,
                    "userId": user_id,
                    "chatId": chat_id,
                    "timestamp": now.isoformat(),
                },
                {
                    "text": agent_text,
                    "userId": f"agent-{agent_id}",
                    "chatId": chat_id,
                    "timestamp": now.isoformat(),
                },
            ],
            "is_paired": True,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/agents/{agent_id}/stack/add",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    async def stack_process(self, agent_id: str) -> Dict[str, Any]:
        """Trigger stack processing into episodes."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/agents/{agent_id}/stack/process",
                headers=self._headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                return await resp.json()

    async def stack_status(self, agent_id: str) -> Dict[str, Any]:
        """Get stack timing/status info."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/agents/{agent_id}/stack/status",
                headers=self._headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    # ── Agent Episode Search ────────────────────────────────────────

    async def search_episodes(
        self,
        agent_id: str,
        limit: int = 20,
        after_time: Optional[str] = None,
        before_time: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search agent-scoped episodes."""
        payload: Dict[str, Any] = {"limit": limit}
        if after_time:
            payload["after_time"] = after_time
        if before_time:
            payload["before_time"] = before_time

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/knowledge_graph/agents/{agent_id}/episodes/search",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                return await resp.json()

    async def latest_episodes(self, agent_id: str) -> Dict[str, Any]:
        """Get the agent's most recent episodes."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/knowledge_graph/agents/{agent_id}/episodes/latest",
                headers=self._headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    # ── Agent Management ────────────────────────────────────────────

    async def create_agent(
        self, username: str, name: str, context: str
    ) -> Dict[str, Any]:
        """Create a new agent."""
        payload = {"username": username, "name": name, "context": context}
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/agents",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    async def register_agent(self, agent_id: str) -> Dict[str, Any]:
        """Register an agent to the bonfire."""
        payload = {"agent_id": agent_id, "bonfire_id": self.bonfire_id}
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/agents/register",
                headers=self._headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()

    async def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get agent config/state."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/agents/{agent_id}",
                headers=self._headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return await resp.json()


# ── Sync wrapper for CLI usage ──────────────────────────────────────

def run_sync(coro):
    """Run an async coroutine synchronously."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)
