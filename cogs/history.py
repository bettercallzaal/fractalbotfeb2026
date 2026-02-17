import discord
from discord import app_commands
from discord.ext import commands
import json
import os
import logging
from datetime import datetime
from cogs.base import BaseCog
from config.config import RESPECT_POINTS

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')


class FractalHistory:
    """JSON-backed store of completed fractal results"""

    def __init__(self):
        self.logger = logging.getLogger('bot')
        self._data = {'fractals': []}
        self._load()

    def _load(self):
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r') as f:
                self._data = json.load(f)

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(HISTORY_FILE, 'w') as f:
            json.dump(self._data, f, indent=2)

    def record(self, group_name: str, facilitator_id: int, facilitator_name: str,
               fractal_number: str, group_number: str, guild_id: int,
               thread_id: int, rankings: list[dict]):
        """Record a completed fractal.
        rankings: [{user_id, display_name, level, respect}]
        """
        entry = {
            'id': len(self._data['fractals']) + 1,
            'group_name': group_name,
            'facilitator_id': str(facilitator_id),
            'facilitator_name': facilitator_name,
            'fractal_number': fractal_number,
            'group_number': group_number,
            'guild_id': str(guild_id),
            'thread_id': str(thread_id),
            'rankings': rankings,
            'completed_at': datetime.utcnow().isoformat()
        }
        self._data['fractals'].append(entry)
        self._save()
        return entry

    def get_all(self) -> list[dict]:
        return self._data['fractals']

    def get_recent(self, count: int = 10) -> list[dict]:
        return self._data['fractals'][-count:]

    def get_by_user(self, user_id: int) -> list[dict]:
        """Get all fractals where a user participated"""
        uid = str(user_id)
        results = []
        for fractal in self._data['fractals']:
            for r in fractal['rankings']:
                if str(r['user_id']) == uid:
                    results.append(fractal)
                    break
        return results

    def get_user_stats(self, user_id: int) -> dict:
        """Get cumulative stats for a user"""
        uid = str(user_id)
        total_respect = 0
        participations = 0
        placements = {1: 0, 2: 0, 3: 0}  # Top 3 counts

        for fractal in self._data['fractals']:
            for i, r in enumerate(fractal['rankings']):
                if str(r['user_id']) == uid:
                    total_respect += r.get('respect', 0)
                    participations += 1
                    rank = i + 1
                    if rank in placements:
                        placements[rank] += 1
                    break

        return {
            'total_respect': total_respect,
            'participations': participations,
            'first_place': placements[1],
            'second_place': placements[2],
            'third_place': placements[3],
        }

    def get_leaderboard(self) -> list[dict]:
        """Get cumulative Respect leaderboard from history"""
        user_totals = {}  # user_id -> {name, respect, participations}

        for fractal in self._data['fractals']:
            for r in fractal['rankings']:
                uid = str(r['user_id'])
                if uid not in user_totals:
                    user_totals[uid] = {
                        'user_id': uid,
                        'display_name': r['display_name'],
                        'respect': 0,
                        'participations': 0
                    }
                user_totals[uid]['respect'] += r.get('respect', 0)
                user_totals[uid]['participations'] += 1
                # Keep name updated to latest
                user_totals[uid]['display_name'] = r['display_name']

        ranked = sorted(user_totals.values(), key=lambda x: -x['respect'])
        for i, entry in enumerate(ranked):
            entry['rank'] = i + 1
        return ranked

    def search(self, query: str) -> list[dict]:
        """Search fractals by group name, participant name, or fractal number"""
        query = query.lower()
        results = []
        for fractal in self._data['fractals']:
            if query in fractal['group_name'].lower():
                results.append(fractal)
                continue
            if query in fractal.get('fractal_number', '').lower():
                results.append(fractal)
                continue
            for r in fractal['rankings']:
                if query in r['display_name'].lower():
                    results.append(fractal)
                    break
        return results

    @property
    def total_fractals(self) -> int:
        return len(self._data['fractals'])


class HistoryCog(BaseCog):
    """Cog for tracking and searching fractal history"""

    def __init__(self, bot):
        super().__init__(bot)
        self.history = FractalHistory()
        # Store on bot for access from FractalGroup.end_fractal()
        bot.fractal_history = self.history

    @app_commands.command(
        name="history",
        description="Search completed fractal history by member name, group, or fractal number"
    )
    @app_commands.describe(query="Search by member name, group name, or fractal number (leave empty for recent)")
    async def history_search(self, interaction: discord.Interaction, query: str = None):
        """Search fractal history"""
        await interaction.response.defer(ephemeral=True)

        if query:
            results = self.history.search(query)
            title = f"Search Results: \"{query}\""
        else:
            results = self.history.get_recent(10)
            title = "Recent Fractals"

        if not results:
            await interaction.followup.send(
                f"No fractals found{f' matching \"{query}\"' if query else ''}.",
                ephemeral=True
            )
            return

        embed = discord.Embed(title=title, color=0x57F287)

        for fractal in results[-10:]:  # Show max 10
            rankings_text = []
            for i, r in enumerate(fractal['rankings']):
                medal = "\U0001f947" if i == 0 else "\U0001f948" if i == 1 else "\U0001f949" if i == 2 else f"{i+1}."
                rankings_text.append(f"{medal} {r['display_name']} (+{r.get('respect', 0)})")

            date = fractal['completed_at'][:10]
            embed.add_field(
                name=f"#{fractal['id']} \u2014 {fractal['group_name']} ({date})",
                value="\n".join(rankings_text),
                inline=False
            )

        embed.set_footer(text=f"{self.history.total_fractals} total fractals \u2022 ZAO Fractal \u2022 zao.frapps.xyz")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="mystats",
        description="View your cumulative fractal stats and Respect earned"
    )
    @app_commands.describe(user="Member to look up (default: yourself)")
    async def my_stats(self, interaction: discord.Interaction, user: discord.Member = None):
        """View cumulative stats for a member"""
        await interaction.response.defer(ephemeral=True)

        target = user or interaction.user
        stats = self.history.get_user_stats(target.id)

        if stats['participations'] == 0:
            await interaction.followup.send(
                f"No fractal history found for **{target.display_name}**.",
                ephemeral=True
            )
            return

        embed = discord.Embed(
            title=f"Fractal Stats: {target.display_name}",
            color=0x57F287
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(name="Total Respect Earned", value=f"**{stats['total_respect']:,}**", inline=True)
        embed.add_field(name="Fractals Participated", value=f"**{stats['participations']}**", inline=True)
        embed.add_field(
            name="Avg Respect / Fractal",
            value=f"**{stats['total_respect'] / stats['participations']:.0f}**",
            inline=True
        )
        embed.add_field(
            name="Podium Finishes",
            value=f"\U0001f947 {stats['first_place']}x  |  \U0001f948 {stats['second_place']}x  |  \U0001f949 {stats['third_place']}x",
            inline=False
        )

        # Show recent fractals
        recent = self.history.get_by_user(target.id)[-5:]
        if recent:
            recent_lines = []
            for f in reversed(recent):
                for i, r in enumerate(f['rankings']):
                    if str(r['user_id']) == str(target.id):
                        medal = "\U0001f947" if i == 0 else "\U0001f948" if i == 1 else "\U0001f949" if i == 2 else f"{i+1}."
                        date = f['completed_at'][:10]
                        recent_lines.append(f"{medal} {f['group_name']} \u2014 +{r.get('respect', 0)} ({date})")
                        break
            embed.add_field(name="Recent Fractals", value="\n".join(recent_lines), inline=False)

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="rankings",
        description="View cumulative Respect rankings from fractal history"
    )
    async def rankings(self, interaction: discord.Interaction):
        """Show cumulative Respect leaderboard from history"""
        await interaction.response.defer(ephemeral=True)

        leaderboard = self.history.get_leaderboard()
        if not leaderboard:
            await interaction.followup.send("No fractal history yet.", ephemeral=True)
            return

        embed = discord.Embed(
            title="Cumulative Respect Rankings",
            description="Total Respect earned across all completed fractals",
            color=0x57F287
        )

        lines = []
        for entry in leaderboard[:20]:
            medal = ""
            if entry['rank'] == 1:
                medal = "\U0001f947 "
            elif entry['rank'] == 2:
                medal = "\U0001f948 "
            elif entry['rank'] == 3:
                medal = "\U0001f949 "

            lines.append(
                f"{medal}**{entry['rank']}.** {entry['display_name']} \u2014 "
                f"**{entry['respect']:,}** Respect ({entry['participations']} fractals)"
            )

        embed.add_field(name="Top Members", value="\n".join(lines) or "None", inline=False)
        embed.set_footer(
            text=f"{self.history.total_fractals} fractals recorded \u2022 ZAO Fractal \u2022 zao.frapps.xyz"
        )

        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot):
    await bot.add_cog(HistoryCog(bot))
