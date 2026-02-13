"""
One-time script to create a dedicated journal agent on the bonfire.
Run: python agent_setup.py
"""
import asyncio
from delve_client import DelveClient
from config import DELVE_API_KEY, BONFIRE_ID, BASE_URL

JOURNAL_AGENT_CONTEXT = """You are the ETH Boulder Builder Journal agent — a persistent memory system for bettercallzaal's hackathon journey at ETH Boulder 2026 (Feb 13-15, Boulder, CO).

Your purpose:
- Record daily builder updates, project progress, and learnings
- Track what was built, decisions made, people met, and ideas explored
- Provide recall of past entries when searched
- Maintain context across the entire hackathon weekend

Topics you track:
- Fractal bot development (ZAO Fractal Voting System)
- Hackathon project progress and milestones
- Technical decisions and architecture choices
- People met, collaborations formed
- Talks attended, insights gained
- Ideas for future development

All timestamps are in Mountain Standard Time (MST, GMT-7) for ETH Boulder."""


async def main():
    client = DelveClient(DELVE_API_KEY, BONFIRE_ID, BASE_URL)

    # Check connectivity
    health = await client.health_check()
    print(f"API Status: {health['status']}")

    # Create the journal agent
    print("Creating journal agent...")
    result = await client.create_agent(
        username="zaal-journal",
        name="Zaal Builder Journal",
        context=JOURNAL_AGENT_CONTEXT,
    )
    print(f"Create result: {result}")

    agent_id = result.get("id") or result.get("agent_id") or result.get("_id")
    if not agent_id:
        print("Could not extract agent ID from response. Check the response above.")
        return

    print(f"Agent ID: {agent_id}")

    # Register agent to bonfire
    print("Registering agent to bonfire...")
    reg_result = await client.register_agent(agent_id)
    print(f"Register result: {reg_result}")

    print(f"\nDone! Set this in your config.py or .env:")
    print(f'  JOURNAL_AGENT_ID="{agent_id}"')


if __name__ == "__main__":
    asyncio.run(main())
