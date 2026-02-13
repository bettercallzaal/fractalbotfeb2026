import discord
from discord import app_commands
from discord.ext import commands
import logging
import os
import sys

# Add the journal module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'bondfire-eth-boulder-journal'))
from delve_client import DelveClient
from config import DELVE_API_KEY, BONFIRE_ID, AGENT_ID, ETHBOULDER_AGENT_ID, BASE_URL


class JournalCog(commands.Cog):
    """Discord slash commands for the ETH Boulder Builder Journal."""

    def __init__(self, bot):
        self.bot = bot
        self.logger = logging.getLogger('bot')
        self.client = DelveClient(DELVE_API_KEY, BONFIRE_ID, BASE_URL)
        self.agent_id = AGENT_ID or ETHBOULDER_AGENT_ID

    journal_group = app_commands.Group(name="journal", description="ETH Boulder Builder Journal")

    @journal_group.command(name="log", description="Log a builder journal entry")
    @app_commands.describe(entry="Your journal entry / update / note")
    async def journal_log(self, interaction: discord.Interaction, entry: str):
        await interaction.response.defer(ephemeral=True)

        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        tagged = f"[Builder Journal - {timestamp}] {entry}"

        result = await self.client.stack_add(self.agent_id, tagged, user_id=str(interaction.user.id))

        if result.get("success"):
            count = result.get("stack_count", "?")
            await interaction.followup.send(
                f"**Journal entry logged.**\n> {entry}\n\nStack: {count} messages queued.",
                ephemeral=True,
            )
        else:
            await interaction.followup.send(f"Error logging entry: {result}", ephemeral=True)

    @journal_group.command(name="search", description="Search past journal entries")
    @app_commands.describe(query="What to search for")
    async def journal_search(self, interaction: discord.Interaction, query: str):
        await interaction.response.defer(ephemeral=True)

        result = await self.client.search(query, num_results=5)

        if not result.get("success"):
            await interaction.followup.send(f"Search error: {result.get('error', 'unknown')}", ephemeral=True)
            return

        episodes = result.get("episodes", [])
        entities = result.get("entities", [])

        msg = f"**Search: \"{query}\"**\n"
        msg += f"Found {len(episodes)} episodes, {len(entities)} entities\n\n"

        if episodes:
            for ep in episodes[:5]:
                name = ep.get("name", "Untitled")
                content = ep.get("content", "")
                if len(content) > 150:
                    content = content[:150] + "..."
                msg += f"**{name}**\n{content}\n\n"

        if entities:
            msg += "**Entities:** " + ", ".join(e.get("name", "?") for e in entities[:8]) + "\n"

        if len(msg) > 2000:
            msg = msg[:1997] + "..."

        await interaction.followup.send(msg, ephemeral=True)

    @journal_group.command(name="status", description="Show journal stack status")
    async def journal_status(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        result = await self.client.stack_status(self.agent_id)

        msg = "**Journal Stack Status**\n"
        msg += f"Messages queued: {result.get('message_count', '?')}\n"
        msg += f"Last message: {result.get('last_message_at', 'none')}\n"
        msg += f"Next process: {result.get('next_process_at', 'not scheduled')}\n"
        ready = result.get("is_ready_for_processing", False)
        msg += f"Ready to process: {'yes' if ready else 'no'}\n"

        await interaction.followup.send(msg, ephemeral=True)

    @journal_group.command(name="process", description="Process queued entries into episodes")
    async def journal_process(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        result = await self.client.stack_process(self.agent_id)

        if result.get("success"):
            count = result.get("message_count", 0)
            episode_id = result.get("episode_id", "pending")
            msg = f"**Processing {count} messages into episode**\nEpisode ID: {episode_id}"
            if result.get("warning"):
                msg += f"\nWarning: {result.get('warning_message', '')}"
            await interaction.followup.send(msg, ephemeral=True)
        else:
            await interaction.followup.send(f"Error: {result}", ephemeral=True)
