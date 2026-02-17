import discord
from discord import app_commands
from discord.ext import commands
import json
import os
import logging
import time
import aiohttp
from datetime import datetime
from cogs.base import BaseCog
from config.config import PROPOSAL_TYPES, MAX_PROPOSAL_OPTIONS

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
PROPOSALS_FILE = os.path.join(DATA_DIR, 'proposals.json')

# Optimism contracts
OG_RESPECT_ADDRESS = '0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957'
ZOR_RESPECT_ADDRESS = '0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c'
ZOR_TOKEN_ID = 0

# Default public Optimism RPC (Alchemy key optional via env)
DEFAULT_OPTIMISM_RPC = 'https://mainnet.optimism.io'


class RespectBalance:
    """Queries onchain Respect balances with caching"""

    def __init__(self):
        self.logger = logging.getLogger('bot')
        self._cache = {}  # wallet -> {og, zor, total, timestamp}
        self._cache_ttl = 300  # 5 minutes

    def _get_rpc_url(self) -> str:
        return os.getenv('ALCHEMY_OPTIMISM_RPC', DEFAULT_OPTIMISM_RPC)

    async def get_total_respect(self, wallet: str) -> float:
        """Get total Respect (OG + ZOR) for a wallet, with caching"""
        if not wallet:
            return 0.0

        wallet = wallet.lower()
        cached = self._cache.get(wallet)
        if cached and time.time() - cached['timestamp'] < self._cache_ttl:
            return cached['total']

        try:
            og = await self._query_erc20_balance(wallet, OG_RESPECT_ADDRESS)
            zor = await self._query_erc1155_balance(wallet, ZOR_RESPECT_ADDRESS, ZOR_TOKEN_ID)
            total = og + zor

            self._cache[wallet] = {
                'og': og, 'zor': zor, 'total': total,
                'timestamp': time.time()
            }
            return total
        except Exception as e:
            self.logger.error(f"Failed to query Respect for {wallet}: {e}")
            return 0.0

    async def _eth_call(self, to: str, data: str) -> str:
        """Make an eth_call to Optimism"""
        payload = {
            "jsonrpc": "2.0", "id": 1, "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"]
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(self._get_rpc_url(), json=payload) as resp:
                result = await resp.json()
                return result.get("result", "0x")

    async def _query_erc20_balance(self, wallet: str, contract: str) -> float:
        """Query ERC-20 balanceOf — returns balance as float (18 decimals)"""
        # balanceOf(address) selector: 0x70a08231
        addr_padded = wallet[2:].lower().zfill(64)
        data = f"0x70a08231{addr_padded}"
        result = await self._eth_call(contract, data)
        if result and result != "0x" and len(result) >= 66:
            raw = int(result, 16)
            return raw / 1e18
        return 0.0

    async def _query_erc1155_balance(self, wallet: str, contract: str, token_id: int) -> float:
        """Query ERC-1155 balanceOf — returns balance as integer (no decimals)"""
        # balanceOf(address, uint256) selector: 0x00fdd58e
        addr_padded = wallet[2:].lower().zfill(64)
        id_padded = hex(token_id)[2:].zfill(64)
        data = f"0x00fdd58e{addr_padded}{id_padded}"
        result = await self._eth_call(contract, data)
        if result and result != "0x" and len(result) >= 66:
            return float(int(result, 16))
        return 0.0


# Singleton for caching across votes
_respect_balance = RespectBalance()


class ProposalStore:
    """JSON-backed store for proposals with Respect-weighted voting"""

    def __init__(self):
        self.logger = logging.getLogger('bot')
        self._data = {'next_id': 1, 'proposals': {}}
        self._load()

    def _load(self):
        if os.path.exists(PROPOSALS_FILE):
            with open(PROPOSALS_FILE, 'r') as f:
                self._data = json.load(f)

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(PROPOSALS_FILE, 'w') as f:
            json.dump(self._data, f, indent=2)

    def create(self, title: str, description: str, proposal_type: str,
               author_id: int, thread_id: int, message_id: int,
               options: list[str] | None = None,
               funding_amount: float | None = None) -> dict:
        pid = str(self._data['next_id'])
        self._data['next_id'] += 1

        proposal = {
            'id': pid,
            'title': title,
            'description': description,
            'type': proposal_type,
            'author_id': str(author_id),
            'thread_id': str(thread_id),
            'message_id': str(message_id),
            'status': 'active',
            'votes': {},  # user_id (str) -> {value, weight}
            'options': options or [],
            'funding_amount': funding_amount,
            'created_at': datetime.utcnow().isoformat()
        }

        self._data['proposals'][pid] = proposal
        self._save()
        return proposal

    def get(self, proposal_id: str) -> dict | None:
        return self._data['proposals'].get(str(proposal_id))

    def get_active(self) -> list[dict]:
        return [p for p in self._data['proposals'].values() if p['status'] == 'active']

    def vote(self, proposal_id: str, user_id: int, value: str, weight: float = 1.0) -> bool:
        proposal = self.get(str(proposal_id))
        if not proposal or proposal['status'] != 'active':
            return False
        proposal['votes'][str(user_id)] = {'value': value, 'weight': weight}
        self._save()
        return True

    def close(self, proposal_id: str) -> dict | None:
        proposal = self.get(str(proposal_id))
        if not proposal:
            return None
        proposal['status'] = 'closed'
        proposal['closed_at'] = datetime.utcnow().isoformat()
        self._save()
        return proposal

    def delete(self, proposal_id: str) -> bool:
        pid = str(proposal_id)
        if pid in self._data['proposals']:
            del self._data['proposals'][pid]
            self._save()
            return True
        return False

    def get_vote_summary(self, proposal_id: str) -> dict:
        """Returns {option: {count, weight}} for weighted results"""
        proposal = self.get(str(proposal_id))
        if not proposal:
            return {}
        summary = {}
        for vote_data in proposal['votes'].values():
            # Handle both old format (string) and new format (dict)
            if isinstance(vote_data, str):
                value, weight = vote_data, 1.0
            else:
                value = vote_data['value']
                weight = vote_data.get('weight', 1.0)
            if value not in summary:
                summary[value] = {'count': 0, 'weight': 0.0}
            summary[value]['count'] += 1
            summary[value]['weight'] += weight
        return summary


class ProposalVoteView(discord.ui.View):
    """Yes/No/Abstain voting buttons for text and funding proposals"""

    def __init__(self, store: ProposalStore, proposal_id: str, bot=None):
        super().__init__(timeout=None)
        self.store = store
        self.proposal_id = proposal_id
        self.bot = bot

    @discord.ui.button(label="Yes", style=discord.ButtonStyle.success, custom_id="proposal_yes")
    async def vote_yes(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._handle_vote(interaction, "yes")

    @discord.ui.button(label="No", style=discord.ButtonStyle.danger, custom_id="proposal_no")
    async def vote_no(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._handle_vote(interaction, "no")

    @discord.ui.button(label="Abstain", style=discord.ButtonStyle.secondary, custom_id="proposal_abstain")
    async def vote_abstain(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._handle_vote(interaction, "abstain")

    async def _handle_vote(self, interaction: discord.Interaction, value: str):
        await interaction.response.defer(ephemeral=True)

        # Look up voter's wallet and Respect balance
        bot = self.bot or interaction.client
        weight = await _get_vote_weight(bot, interaction.user)

        if weight <= 0:
            await interaction.followup.send(
                "You need to hold ZAO Respect tokens to vote. "
                "Make sure your wallet is registered with `/register` and holds OG or ZOR Respect.",
                ephemeral=True
            )
            return

        success = self.store.vote(self.proposal_id, interaction.user.id, value, weight)
        if success:
            summary = self.store.get_vote_summary(self.proposal_id)
            total_weight = sum(s['weight'] for s in summary.values())
            await interaction.followup.send(
                f"Vote recorded: **{value}** (weight: {weight:,.0f} Respect). "
                f"Total weighted votes: {total_weight:,.0f}",
                ephemeral=True
            )
        else:
            await interaction.followup.send(
                "This proposal is no longer accepting votes.", ephemeral=True
            )


class GovernanceVoteView(discord.ui.View):
    """Dynamic option voting buttons for governance proposals"""

    def __init__(self, store: ProposalStore, proposal_id: str, options: list[str], bot=None):
        super().__init__(timeout=None)
        self.store = store
        self.proposal_id = proposal_id
        self.bot = bot

        styles = [
            discord.ButtonStyle.primary,
            discord.ButtonStyle.success,
            discord.ButtonStyle.danger,
        ]

        for i, option in enumerate(options):
            style = styles[i % len(styles)]
            button = discord.ui.Button(
                style=style,
                label=option[:80],
                custom_id=f"gov_option_{proposal_id}_{i}"
            )
            button.callback = self._make_callback(option)
            self.add_item(button)

        # Always add abstain
        abstain_btn = discord.ui.Button(
            style=discord.ButtonStyle.secondary,
            label="Abstain",
            custom_id=f"gov_abstain_{proposal_id}"
        )
        abstain_btn.callback = self._make_callback("abstain")
        self.add_item(abstain_btn)

    def _make_callback(self, value: str):
        async def callback(interaction: discord.Interaction):
            await interaction.response.defer(ephemeral=True)

            bot = self.bot or interaction.client
            weight = await _get_vote_weight(bot, interaction.user)

            if weight <= 0:
                await interaction.followup.send(
                    "You need to hold ZAO Respect tokens to vote. "
                    "Make sure your wallet is registered with `/register` and holds OG or ZOR Respect.",
                    ephemeral=True
                )
                return

            success = self.store.vote(self.proposal_id, interaction.user.id, value, weight)
            if success:
                summary = self.store.get_vote_summary(self.proposal_id)
                total_weight = sum(s['weight'] for s in summary.values())
                await interaction.followup.send(
                    f"Vote recorded: **{value}** (weight: {weight:,.0f} Respect). "
                    f"Total weighted votes: {total_weight:,.0f}",
                    ephemeral=True
                )
            else:
                await interaction.followup.send(
                    "This proposal is no longer accepting votes.", ephemeral=True
                )
        return callback


async def _get_vote_weight(bot, user: discord.User) -> float:
    """Look up user's wallet and return their total Respect as vote weight"""
    wallet = None
    if hasattr(bot, 'wallet_registry'):
        wallet = bot.wallet_registry.lookup(user)

    if not wallet:
        return 0.0

    return await _respect_balance.get_total_respect(wallet)


class GovernanceOptionsModal(discord.ui.Modal, title="Governance Proposal Options"):
    """Modal to collect voting options for governance proposals"""

    options_text = discord.ui.TextInput(
        label=f"Options (one per line, max {MAX_PROPOSAL_OPTIONS})",
        placeholder="Option A\nOption B\nOption C",
        required=True,
        style=discord.TextStyle.paragraph,
        max_length=500
    )

    def __init__(self, cog, title_text: str, description: str):
        super().__init__()
        self.cog = cog
        self.proposal_title = title_text
        self.proposal_description = description

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()

        raw_options = self.options_text.value.strip().split('\n')
        options = [o.strip() for o in raw_options if o.strip()][:MAX_PROPOSAL_OPTIONS]

        if len(options) < 2:
            await interaction.followup.send(
                "Governance proposals need at least 2 options.", ephemeral=True
            )
            return

        await self.cog._create_proposal(
            interaction, self.proposal_title, self.proposal_description,
            'governance', options=options
        )


class ProposalsCog(BaseCog):
    """Cog for the proposal voting system with Respect-weighted votes"""

    def __init__(self, bot):
        super().__init__(bot)
        self.store = ProposalStore()

    async def cog_load(self):
        """Re-register persistent views for active proposals on bot restart"""
        for proposal in self.store.get_active():
            pid = proposal['id']
            if proposal['type'] == 'governance' and proposal.get('options'):
                view = GovernanceVoteView(self.store, pid, proposal['options'], bot=self.bot)
            else:
                view = ProposalVoteView(self.store, pid, bot=self.bot)
            self.bot.add_view(view, message_id=int(proposal['message_id']))

    @app_commands.command(
        name="propose",
        description="Create a new proposal for community voting"
    )
    @app_commands.describe(
        title="Short title for the proposal",
        description="Detailed description of the proposal",
        proposal_type="Type of proposal",
        amount="Funding amount (only for funding proposals)"
    )
    @app_commands.choices(proposal_type=[
        app_commands.Choice(name="Text", value="text"),
        app_commands.Choice(name="Governance", value="governance"),
        app_commands.Choice(name="Funding", value="funding"),
    ])
    async def propose(self, interaction: discord.Interaction, title: str,
                      description: str,
                      proposal_type: app_commands.Choice[str] | None = None,
                      amount: float | None = None):
        """Create a new proposal"""
        ptype = proposal_type.value if proposal_type else 'text'

        if ptype == 'governance':
            modal = GovernanceOptionsModal(self, title, description)
            await interaction.response.send_modal(modal)
            return

        await interaction.response.defer()
        await self._create_proposal(
            interaction, title, description, ptype, funding_amount=amount
        )

    async def _create_proposal(self, interaction: discord.Interaction,
                                title: str, description: str, ptype: str,
                                options: list[str] | None = None,
                                funding_amount: float | None = None):
        """Internal method to create and post a proposal"""
        channel = interaction.channel
        if isinstance(channel, discord.Thread):
            channel = channel.parent

        # Create thread for discussion
        thread = await channel.create_thread(
            name=f"Proposal: {title[:90]}",
            type=discord.ChannelType.public_thread,
            reason="ZAO Proposal"
        )

        # Build embed
        type_labels = {'text': 'Text', 'governance': 'Governance', 'funding': 'Funding'}
        type_emojis = {'text': '\U0001f4dd', 'governance': '\u2696\ufe0f', 'funding': '\U0001f4b0'}

        embed = discord.Embed(
            title=f"{type_emojis.get(ptype, '')} Proposal: {title}",
            description=description,
            color=0x57F287
        )
        embed.add_field(name="Type", value=type_labels.get(ptype, ptype), inline=True)
        embed.add_field(name="Author", value=interaction.user.mention, inline=True)
        embed.add_field(name="Status", value="Active", inline=True)
        embed.add_field(
            name="Voting",
            value="Respect-weighted \u2014 your vote power equals your total onchain Respect (OG + ZOR)",
            inline=False
        )

        if funding_amount is not None:
            embed.add_field(name="Funding Amount", value=f"${funding_amount:,.2f}", inline=True)

        if options:
            options_text = "\n".join(f"**{i+1}.** {opt}" for i, opt in enumerate(options))
            embed.add_field(name="Options", value=options_text, inline=False)

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")

        msg = await thread.send(embed=embed)

        # Store proposal
        proposal = self.store.create(
            title=title,
            description=description,
            proposal_type=ptype,
            author_id=interaction.user.id,
            thread_id=thread.id,
            message_id=msg.id,
            options=options,
            funding_amount=funding_amount
        )

        # Create and attach voting view
        pid = proposal['id']
        if ptype == 'governance' and options:
            view = GovernanceVoteView(self.store, pid, options, bot=self.bot)
        else:
            view = ProposalVoteView(self.store, pid, bot=self.bot)

        self.bot.add_view(view, message_id=msg.id)
        await msg.edit(view=view)

        await interaction.followup.send(
            f"Proposal **#{pid}** created! Discussion and voting: {thread.mention}"
        )

    @app_commands.command(
        name="proposals",
        description="List all active proposals"
    )
    async def proposals(self, interaction: discord.Interaction):
        """List active proposals"""
        await interaction.response.defer(ephemeral=True)

        active = self.store.get_active()
        if not active:
            await interaction.followup.send("No active proposals.", ephemeral=True)
            return

        embed = discord.Embed(
            title="Active Proposals",
            color=0x57F287
        )

        for p in active:
            total_voters = len(p['votes'])
            type_label = p['type'].capitalize()
            embed.add_field(
                name=f"#{p['id']} \u2014 {p['title']}",
                value=f"Type: {type_label} | Voters: {total_voters} | <#{p['thread_id']}>",
                inline=False
            )

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="proposal",
        description="View details and vote breakdown for a specific proposal"
    )
    @app_commands.describe(proposal_id="The proposal number to view")
    async def proposal_detail(self, interaction: discord.Interaction, proposal_id: int):
        """View a specific proposal"""
        await interaction.response.defer(ephemeral=True)

        proposal = self.store.get(str(proposal_id))
        if not proposal:
            await interaction.followup.send(
                f"Proposal #{proposal_id} not found.", ephemeral=True
            )
            return

        type_labels = {'text': 'Text', 'governance': 'Governance', 'funding': 'Funding'}
        summary = self.store.get_vote_summary(str(proposal_id))
        total_weight = sum(s['weight'] for s in summary.values()) if summary else 0
        total_voters = sum(s['count'] for s in summary.values()) if summary else 0

        embed = discord.Embed(
            title=f"Proposal #{proposal['id']}: {proposal['title']}",
            description=proposal['description'],
            color=0x57F287
        )
        embed.add_field(name="Type", value=type_labels.get(proposal['type'], proposal['type']), inline=True)
        embed.add_field(name="Status", value=proposal['status'].capitalize(), inline=True)
        embed.add_field(name="Author", value=f"<@{proposal['author_id']}>", inline=True)

        if proposal.get('funding_amount') is not None:
            embed.add_field(
                name="Funding Amount",
                value=f"${proposal['funding_amount']:,.2f}",
                inline=True
            )

        # Vote breakdown (weighted)
        if summary:
            breakdown_lines = []
            for value, data in sorted(summary.items(), key=lambda x: -x[1]['weight']):
                pct = (data['weight'] / total_weight * 100) if total_weight > 0 else 0
                bar_filled = round(pct / 10)
                bar = '\u2588' * bar_filled + '\u2591' * (10 - bar_filled)
                breakdown_lines.append(
                    f"**{value}**: {bar} {data['weight']:,.0f} Respect ({data['count']} voters, {pct:.0f}%)"
                )
            embed.add_field(
                name=f"Votes ({total_voters} voters, {total_weight:,.0f} total Respect)",
                value="\n".join(breakdown_lines),
                inline=False
            )
        else:
            embed.add_field(name="Votes", value="No votes yet", inline=False)

        embed.add_field(name="Discussion", value=f"<#{proposal['thread_id']}>", inline=False)
        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")

        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="admin_close_proposal",
        description="[ADMIN] Close voting on a proposal and post results"
    )
    @app_commands.describe(proposal_id="The proposal number to close")
    async def admin_close_proposal(self, interaction: discord.Interaction, proposal_id: int):
        """Close a proposal and post final results"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role to use this command.",
                ephemeral=True
            )
            return

        proposal = self.store.close(str(proposal_id))
        if not proposal:
            await interaction.followup.send(
                f"Proposal #{proposal_id} not found.", ephemeral=True
            )
            return

        summary = self.store.get_vote_summary(str(proposal_id))
        total_weight = sum(s['weight'] for s in summary.values()) if summary else 0
        total_voters = sum(s['count'] for s in summary.values()) if summary else 0

        # Build results embed
        embed = discord.Embed(
            title=f"Proposal #{proposal['id']} \u2014 CLOSED",
            description=f"**{proposal['title']}**\n\n{proposal['description']}",
            color=0xED4245
        )

        if summary:
            breakdown_lines = []
            for value, data in sorted(summary.items(), key=lambda x: -x[1]['weight']):
                pct = (data['weight'] / total_weight * 100) if total_weight > 0 else 0
                bar_filled = round(pct / 10)
                bar = '\u2588' * bar_filled + '\u2591' * (10 - bar_filled)
                breakdown_lines.append(
                    f"**{value}**: {bar} {data['weight']:,.0f} Respect ({data['count']} voters, {pct:.0f}%)"
                )
            embed.add_field(
                name=f"Final Results ({total_voters} voters, {total_weight:,.0f} total Respect)",
                value="\n".join(breakdown_lines),
                inline=False
            )
        else:
            embed.add_field(name="Final Results", value="No votes were cast.", inline=False)

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")

        # Post results to the proposal thread
        thread = self.bot.get_channel(int(proposal['thread_id']))
        if thread:
            await thread.send(embed=embed)

            # Disable buttons on original message
            try:
                original = await thread.fetch_message(int(proposal['message_id']))
                await original.edit(view=None)
            except discord.NotFound:
                pass

        await interaction.followup.send(
            f"Proposal #{proposal_id} closed. Results posted to <#{proposal['thread_id']}>.",
            ephemeral=True
        )

    @app_commands.command(
        name="admin_delete_proposal",
        description="[ADMIN] Delete a proposal entirely"
    )
    @app_commands.describe(proposal_id="The proposal number to delete")
    async def admin_delete_proposal(self, interaction: discord.Interaction, proposal_id: int):
        """Delete a proposal"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role to use this command.",
                ephemeral=True
            )
            return

        success = self.store.delete(str(proposal_id))
        if success:
            await interaction.followup.send(
                f"Proposal #{proposal_id} deleted.", ephemeral=True
            )
        else:
            await interaction.followup.send(
                f"Proposal #{proposal_id} not found.", ephemeral=True
            )


async def setup(bot):
    await bot.add_cog(ProposalsCog(bot))
