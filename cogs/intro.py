import discord
from discord import app_commands
from discord.ext import commands
import json
import os
import re
from datetime import datetime
from cogs.base import BaseCog
from config.config import INTROS_CHANNEL_ID

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
INTROS_FILE = os.path.join(DATA_DIR, 'intros.json')


def slugify(name: str) -> str:
    """Convert a display name to a URL-safe slug for thezao.com community pages"""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


class IntroCache:
    """JSON-backed cache of member introductions from #intros channel"""

    def __init__(self):
        self._cache = {}  # discord_id (str) -> {text, message_id, timestamp}
        self._load()

    def _load(self):
        if os.path.exists(INTROS_FILE):
            with open(INTROS_FILE, 'r') as f:
                self._cache = json.load(f)

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(INTROS_FILE, 'w') as f:
            json.dump(self._cache, f, indent=2)

    def get(self, discord_id: int) -> dict | None:
        return self._cache.get(str(discord_id))

    def set(self, discord_id: int, text: str, message_id: int, timestamp: str):
        self._cache[str(discord_id)] = {
            'text': text,
            'message_id': message_id,
            'timestamp': timestamp
        }
        self._save()

    def clear(self):
        self._cache = {}
        self._save()

    @property
    def size(self) -> int:
        return len(self._cache)


class IntroCog(BaseCog):
    """Cog for looking up member introductions from the #intros channel"""

    def __init__(self, bot):
        super().__init__(bot)
        self.intro_cache = IntroCache()

    @app_commands.command(
        name="intro",
        description="Look up a member's introduction from #intros"
    )
    @app_commands.describe(user="The member to look up")
    async def intro(self, interaction: discord.Interaction, user: discord.Member):
        """Show a member's introduction"""
        await interaction.response.defer()

        intro_data = self.intro_cache.get(user.id)

        # If not cached, search the #intros channel
        if not intro_data:
            channel = self.bot.get_channel(INTROS_CHANNEL_ID)
            if not channel:
                await interaction.followup.send(
                    "Could not find the #intros channel.", ephemeral=True
                )
                return

            # Search for user's first message in #intros
            found = False
            async for message in channel.history(limit=None, oldest_first=True):
                if message.author.id == user.id and message.content.strip():
                    self.intro_cache.set(
                        user.id,
                        message.content,
                        message.id,
                        message.created_at.isoformat()
                    )
                    intro_data = self.intro_cache.get(user.id)
                    found = True
                    break

            if not found:
                await interaction.followup.send(
                    f"No introduction found for **{user.display_name}** in <#{INTROS_CHANNEL_ID}>.",
                    ephemeral=True
                )
                return

        # Build embed
        intro_text = intro_data['text']
        if len(intro_text) > 1024:
            intro_text = intro_text[:1021] + "..."

        slug = slugify(user.display_name)
        community_url = f"https://thezao.com/community/{slug}"

        embed = discord.Embed(
            title=f"Introduction: {user.display_name}",
            color=0x57F287
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.add_field(name="Intro", value=intro_text, inline=False)
        embed.add_field(
            name="Community Page",
            value=f"[thezao.com/community/{slug}]({community_url})",
            inline=True
        )

        # Show wallet if registered
        wallet = None
        if hasattr(self.bot, 'wallet_registry'):
            wallet = self.bot.wallet_registry.lookup(user)
        if wallet:
            short = f"{wallet[:6]}...{wallet[-4:]}"
            embed.add_field(name="Wallet", value=f"`{short}`", inline=True)

        # Link to original message
        if intro_data.get('message_id'):
            msg_link = f"https://discord.com/channels/{interaction.guild_id}/{INTROS_CHANNEL_ID}/{intro_data['message_id']}"
            embed.add_field(
                name="Original Message",
                value=f"[Jump to intro]({msg_link})",
                inline=True
            )

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")

        await interaction.followup.send(embed=embed)

    @app_commands.command(
        name="admin_refresh_intros",
        description="[ADMIN] Rebuild the intro cache from #intros channel history"
    )
    async def admin_refresh_intros(self, interaction: discord.Interaction):
        """Rebuild entire intro cache from channel history"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role to use this command.",
                ephemeral=True
            )
            return

        channel = self.bot.get_channel(INTROS_CHANNEL_ID)
        if not channel:
            await interaction.followup.send(
                "Could not find the #intros channel.", ephemeral=True
            )
            return

        self.intro_cache.clear()
        count = 0
        seen_users = set()

        async for message in channel.history(limit=None, oldest_first=True):
            if message.author.bot or not message.content.strip():
                continue
            if message.author.id in seen_users:
                continue

            seen_users.add(message.author.id)
            self.intro_cache.set(
                message.author.id,
                message.content,
                message.id,
                message.created_at.isoformat()
            )
            count += 1

        await interaction.followup.send(
            f"Intro cache rebuilt. **{count}** introductions cached.",
            ephemeral=True
        )


async def setup(bot):
    await bot.add_cog(IntroCog(bot))
