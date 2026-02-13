"""
Builder Journal cog — Discord integration for the Bondfire ETH Boulder Journal.
"""
from .cog import JournalCog

async def setup(bot):
    await bot.add_cog(JournalCog(bot))
