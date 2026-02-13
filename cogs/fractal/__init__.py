"""
ZAO Fractal Voting System package initialization
"""
from .cog import FractalCog

async def setup(bot):
    """Register the FractalCog with the bot"""
    await bot.add_cog(FractalCog(bot))
