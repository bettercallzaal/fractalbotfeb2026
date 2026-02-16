import discord
from discord import app_commands
from discord.ext import commands
from cogs.base import BaseCog
from config.config import RESPECT_POINTS


class GuideCog(BaseCog):
    """Cog for the /guide command — explains how ZAO Fractal works"""

    @app_commands.command(
        name="guide",
        description="Learn how ZAO Fractal voting works"
    )
    async def guide(self, interaction: discord.Interaction):
        """Post an overview of ZAO Fractal with a link to the full guide"""
        embed = discord.Embed(
            title="📚 How ZAO Fractal Works",
            description=(
                "**ZAO Fractal** is a fractal democracy system where small groups "
                "reach consensus on contribution rankings and earn onchain Respect tokens."
            ),
            color=0x57F287
        )

        embed.add_field(
            name="⚡ Quick Flow",
            value=(
                "1️⃣ **Group up** — 2-6 people join a voice channel\n"
                "2️⃣ **Start** — Facilitator runs `/zaofractal`\n"
                "3️⃣ **Vote** — Rank contributions Level 6 → 1\n"
                "4️⃣ **Results** — Bot posts rankings + onchain submit link\n"
                "5️⃣ **Earn Respect** — Confirm results onchain at zao.frapps.xyz"
            ),
            inline=False
        )

        # Build respect table
        ranks = ["🥇 1st", "🥈 2nd", "🥉 3rd", "4th", "5th", "6th"]
        levels = [6, 5, 4, 3, 2, 1]
        table_lines = []
        for i in range(len(RESPECT_POINTS)):
            table_lines.append(f"{ranks[i]} (Lvl {levels[i]}) → **{RESPECT_POINTS[i]} Respect**")

        embed.add_field(
            name="🏆 Respect Points (2x Fibonacci)",
            value="\n".join(table_lines),
            inline=False
        )

        embed.add_field(
            name="📖 Full Guide",
            value="**[View the complete guide with visuals →](https://zao-fractal.vercel.app/guide)**",
            inline=False
        )

        embed.set_footer(text="ZAO Fractal • zao.frapps.xyz")

        await interaction.response.send_message(embed=embed)


async def setup(bot):
    await bot.add_cog(GuideCog(bot))
