import discord
import logging
from discord.ext import commands
from config.config import SUPREME_ADMIN_ROLE_ID

class BaseCog(commands.Cog):
    """Base cog with utility methods for all cogs"""
    def __init__(self, bot):
        self.bot = bot
        self.logger = logging.getLogger('bot')

    def is_supreme_admin(self, member: discord.Member) -> bool:
        """Check if a member has the Supreme Admin role"""
        return any(role.id == SUPREME_ADMIN_ROLE_ID for role in member.roles)

    async def check_voice_state(self, user):
        """Check if user is in a voice channel and return eligible members"""
        # Validate user is in voice channel
        if not user.voice or not user.voice.channel:
            return {
                'success': False,
                'message': '❌ You must be in a voice channel to create a fractal group.',
                'members': [],
                'channel': None
            }

        # Get non-bot members
        members = [m for m in user.voice.channel.members if not m.bot]

        # Validate member count (2-6 members)
        if len(members) < 2:
            return {
                'success': False,
                'message': '❌ You need at least 2 members in your voice channel to create a fractal group.',
                'members': [],
                'channel': user.voice.channel
            }

        if len(members) > 6:
            return {
                'success': False,
                'message': '❌ Fractal groups are limited to 6 members maximum for optimal experience.',
                'members': [],
                'channel': user.voice.channel
            }

        return {
            'success': True,
            'message': f'✅ Found {len(members)} eligible members in voice channel.',
            'members': members,
            'channel': user.voice.channel
        }

async def setup(bot):
    await bot.add_cog(BaseCog(bot))
