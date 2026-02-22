import discord
from discord import app_commands
from discord.ext import commands
import json
import os
import logging
import time
import aiohttp
from cogs.base import BaseCog
from config.config import RESPECT_POINTS

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
NAMES_FILE = os.path.join(DATA_DIR, 'names_to_wallets.json')

# Optimism contracts
OG_RESPECT_ADDRESS = '0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957'
ZOR_RESPECT_ADDRESS = '0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c'
ZOR_TOKEN_ID = 0
DEFAULT_OPTIMISM_RPC = 'https://mainnet.optimism.io'


class GuideCog(BaseCog):
    """Cog for the /guide and /leaderboard commands"""

    def __init__(self, bot):
        super().__init__(bot)
        self._lb_cache = None  # {'data': [...], 'timestamp': float}
        self._lb_cache_ttl = 300  # 5 minutes

    @app_commands.command(
        name="guide",
        description="Learn how ZAO Fractal voting works"
    )
    async def guide(self, interaction: discord.Interaction):
        """Post an overview of ZAO Fractal with a link to the full guide"""
        embed = discord.Embed(
            title="\U0001f4da How ZAO Fractal Works",
            description=(
                "**ZAO Fractal** is a fractal democracy system where small groups "
                "reach consensus on contribution rankings and earn onchain Respect tokens."
            ),
            color=0x57F287
        )

        embed.add_field(
            name="\u26a1 Quick Flow",
            value=(
                "1\ufe0f\u20e3 **Group up** \u2014 2-6 people join a voice channel\n"
                "2\ufe0f\u20e3 **Start** \u2014 Facilitator runs `/zaofractal`\n"
                "3\ufe0f\u20e3 **Vote** \u2014 Rank contributions Level 6 \u2192 1\n"
                "4\ufe0f\u20e3 **Results** \u2014 Bot posts rankings + onchain submit link\n"
                "5\ufe0f\u20e3 **Earn Respect** \u2014 Confirm results onchain at zao.frapps.xyz"
            ),
            inline=False
        )

        # Build respect table
        ranks = ["\U0001f947 1st", "\U0001f948 2nd", "\U0001f949 3rd", "4th", "5th", "6th"]
        levels = [6, 5, 4, 3, 2, 1]
        table_lines = []
        for i in range(len(RESPECT_POINTS)):
            table_lines.append(f"{ranks[i]} (Lvl {levels[i]}) \u2192 **{RESPECT_POINTS[i]} Respect**")

        embed.add_field(
            name="\U0001f3c6 Respect Points (2x Fibonacci)",
            value="\n".join(table_lines),
            inline=False
        )

        embed.add_field(
            name="\U0001f4d6 Full Guide",
            value="**[View the complete guide with visuals \u2192](https://zao-fractal.vercel.app/guide)**",
            inline=False
        )

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(
        name="leaderboard",
        description="View the ZAO Respect leaderboard"
    )
    async def leaderboard(self, interaction: discord.Interaction):
        """Fetch onchain Respect balances and show top 10 in Discord"""
        await interaction.response.defer()

        try:
            top_10 = await self._fetch_leaderboard()
        except Exception as e:
            self.logger.error(f"Leaderboard fetch failed: {e}")
            await interaction.followup.send(
                "Failed to fetch onchain data. Try again later.",
                ephemeral=True
            )
            return

        if not top_10:
            await interaction.followup.send("No leaderboard data available.", ephemeral=True)
            return

        embed = discord.Embed(
            title="\U0001f3c6 ZAO Respect Leaderboard",
            description="Live onchain Respect rankings (OG + ZOR) on Optimism",
            color=0x57F287
        )

        lines = []
        for entry in top_10:
            rank = entry['rank']
            if rank == 1:
                medal = "\U0001f947"
            elif rank == 2:
                medal = "\U0001f948"
            elif rank == 3:
                medal = "\U0001f949"
            else:
                medal = f"`{rank}.`"

            total = entry['total']
            og_str = f"{entry['og']:.0f}" if entry['og'] > 0 else "0"
            zor_str = f"{int(entry['zor'])}" if entry['zor'] > 0 else "0"

            lines.append(
                f"{medal} **{entry['name']}** \u2014 **{total:.0f}** Respect "
                f"({og_str} OG + {zor_str} ZOR)"
            )

        embed.add_field(
            name="Top 10",
            value="\n".join(lines),
            inline=False
        )

        embed.add_field(
            name="\U0001f310 Full Leaderboard",
            value="**[View all members \u2192](https://www.thezao.com/zao-leaderboard)**",
            inline=False
        )

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
        await interaction.followup.send(embed=embed)

    async def _fetch_leaderboard(self) -> list[dict]:
        """Fetch onchain Respect balances for all members, return top 10"""
        # Check cache
        if self._lb_cache and time.time() - self._lb_cache['timestamp'] < self._lb_cache_ttl:
            return self._lb_cache['data']

        # Load member wallets
        if not os.path.exists(NAMES_FILE):
            return []

        with open(NAMES_FILE, 'r') as f:
            names_map = json.load(f)

        entries = [(name, wallet) for name, wallet in names_map.items() if wallet]
        if not entries:
            return []

        rpc_url = os.getenv('ALCHEMY_OPTIMISM_RPC', DEFAULT_OPTIMISM_RPC)
        results = []

        # Query each member's OG + ZOR balance
        async with aiohttp.ClientSession() as session:
            for name, wallet in entries:
                og = await self._query_erc20(session, rpc_url, wallet, OG_RESPECT_ADDRESS)
                zor = await self._query_erc1155(session, rpc_url, wallet, ZOR_RESPECT_ADDRESS, ZOR_TOKEN_ID)
                total = og + zor
                if total > 0:
                    results.append({
                        'name': name,
                        'wallet': wallet,
                        'og': og,
                        'zor': zor,
                        'total': total,
                    })

        # Sort by total descending
        results.sort(key=lambda x: -x['total'])

        # Assign ranks
        for i, entry in enumerate(results):
            entry['rank'] = i + 1

        top_10 = results[:10]

        # Cache full results
        self._lb_cache = {'data': top_10, 'timestamp': time.time()}
        return top_10

    async def _query_erc20(self, session: aiohttp.ClientSession, rpc_url: str,
                           wallet: str, contract: str) -> float:
        """Query ERC-20 balanceOf"""
        addr_padded = wallet[2:].lower().zfill(64)
        data = f"0x70a08231{addr_padded}"
        result = await self._eth_call(session, rpc_url, contract, data)
        if result and result != "0x" and len(result) >= 66:
            return int(result, 16) / 1e18
        return 0.0

    async def _query_erc1155(self, session: aiohttp.ClientSession, rpc_url: str,
                             wallet: str, contract: str, token_id: int) -> float:
        """Query ERC-1155 balanceOf"""
        addr_padded = wallet[2:].lower().zfill(64)
        id_padded = hex(token_id)[2:].zfill(64)
        data = f"0x00fdd58e{addr_padded}{id_padded}"
        result = await self._eth_call(session, rpc_url, contract, data)
        if result and result != "0x" and len(result) >= 66:
            return float(int(result, 16))
        return 0.0

    async def _eth_call(self, session: aiohttp.ClientSession, rpc_url: str,
                        to: str, data: str) -> str:
        """Make an eth_call to Optimism"""
        payload = {
            "jsonrpc": "2.0", "id": 1, "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"]
        }
        try:
            async with session.post(rpc_url, json=payload,
                                    timeout=aiohttp.ClientTimeout(total=10)) as resp:
                result = await resp.json()
                return result.get("result", "0x")
        except Exception as e:
            self.logger.error(f"eth_call failed for {to}: {e}")
            return "0x"


async def setup(bot):
    await bot.add_cog(GuideCog(bot))
