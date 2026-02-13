#!/usr/bin/env python3
"""
Bondfire ETH Boulder Builder Journal — CLI Tool

Usage:
  python journal.py log "Built fractal bot v2 with admin commands"
  python journal.py search "fractal bot progress"
  python journal.py status
  python journal.py process
  python journal.py episodes
"""
import asyncio
import sys
import json
from datetime import datetime, timezone
from delve_client import DelveClient
from config import DELVE_API_KEY, BONFIRE_ID, AGENT_ID, ETHBOULDER_AGENT_ID, BASE_URL


def get_client():
    return DelveClient(DELVE_API_KEY, BONFIRE_ID, BASE_URL)


def get_agent_id():
    agent = AGENT_ID or ETHBOULDER_AGENT_ID
    if not agent:
        print("No JOURNAL_AGENT_ID set. Run agent_setup.py first or set JOURNAL_AGENT_ID in .env")
        sys.exit(1)
    return agent


async def cmd_log(entry: str):
    """Log a journal entry to the agent stack."""
    client = get_client()
    agent_id = get_agent_id()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    tagged_entry = f"[Builder Journal - {timestamp}] {entry}"

    result = await client.stack_add(agent_id, tagged_entry)

    if result.get("success"):
        count = result.get("stack_count", "?")
        print(f"Logged: {entry}")
        print(f"Stack count: {count} messages queued")
    else:
        print(f"Error: {result}")


async def cmd_search(query: str):
    """Search the knowledge graph for past entries."""
    client = get_client()

    result = await client.search(query, num_results=10)

    if not result.get("success"):
        print(f"Search error: {result.get('error', 'unknown')}")
        return

    episodes = result.get("episodes", [])
    entities = result.get("entities", [])

    print(f"Found {len(episodes)} episodes, {len(entities)} entities\n")

    if episodes:
        print("── Episodes ──")
        for ep in episodes:
            name = ep.get("name", "Untitled")
            content = ep.get("content", "")
            # Truncate long content for display
            if len(content) > 300:
                content = content[:300] + "..."
            print(f"\n  {name}")
            if content:
                print(f"  {content}")

    if entities:
        print("\n── Entities ──")
        for ent in entities:
            name = ent.get("name", "?")
            summary = ent.get("summary", "")
            print(f"  - {name}" + (f": {summary}" if summary else ""))


async def cmd_status():
    """Show stack status for the journal agent."""
    client = get_client()
    agent_id = get_agent_id()

    result = await client.stack_status(agent_id)

    print("── Journal Stack Status ──")
    print(f"  Agent ID:        {agent_id}")
    print(f"  Messages queued: {result.get('message_count', '?')}")
    print(f"  Users:           {result.get('user_count', '?')}")
    print(f"  Last message:    {result.get('last_message_at', 'none')}")
    print(f"  Next process:    {result.get('next_process_at', 'not scheduled')}")
    remaining = result.get("time_until_next_process")
    if remaining:
        print(f"  Time remaining:  {remaining}s")
    ready = result.get("is_ready_for_processing", False)
    print(f"  Ready to process: {'yes' if ready else 'no'}")


async def cmd_process():
    """Manually trigger stack → episode processing."""
    client = get_client()
    agent_id = get_agent_id()

    result = await client.stack_process(agent_id)

    if result.get("success"):
        count = result.get("message_count", 0)
        episode_id = result.get("episode_id", "pending")
        print(f"Processing {count} messages into episode")
        print(f"Episode ID: {episode_id}")
        if result.get("warning"):
            print(f"Warning: {result.get('warning_message', '')}")
    else:
        print(f"Error: {result}")


async def cmd_episodes():
    """Show recent episodes from the journal agent."""
    client = get_client()
    agent_id = get_agent_id()

    result = await client.search_episodes(agent_id, limit=10)

    episodes = result.get("episodes", [])
    print(f"── Recent Episodes ({len(episodes)}) ──\n")

    for ep in episodes:
        name = ep.get("name", "Untitled")
        created = ep.get("created_at", "")
        content = ep.get("content", "")
        if len(content) > 200:
            content = content[:200] + "..."
        print(f"  [{created}] {name}")
        if content:
            print(f"    {content}\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "log":
        if len(sys.argv) < 3:
            print("Usage: python journal.py log \"your entry here\"")
            sys.exit(1)
        entry = " ".join(sys.argv[2:])
        asyncio.run(cmd_log(entry))

    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: python journal.py search \"your query\"")
            sys.exit(1)
        query = " ".join(sys.argv[2:])
        asyncio.run(cmd_search(query))

    elif command == "status":
        asyncio.run(cmd_status())

    elif command == "process":
        asyncio.run(cmd_process())

    elif command == "episodes":
        asyncio.run(cmd_episodes())

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
