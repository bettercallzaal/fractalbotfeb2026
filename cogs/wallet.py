import discord
from discord import app_commands
from discord.ext import commands
import logging
import json
import os
import re
import aiohttp
from config.config import SUPREME_ADMIN_ROLE_ID

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
WALLETS_FILE = os.path.join(DATA_DIR, 'wallets.json')
NAMES_FILE = os.path.join(DATA_DIR, 'names_to_wallets.json')


def is_valid_address(address: str) -> bool:
    """Validate Ethereum address format"""
    return bool(re.match(r'^0x[0-9a-fA-F]{40}$', address))


def is_ens_name(name: str) -> bool:
    """Check if a string looks like an ENS name"""
    return bool(re.match(r'^[a-zA-Z0-9\-]+\.eth$', name.strip()))


async def resolve_ens(name: str) -> str | None:
    """Resolve an ENS name to an Ethereum address using Cloudflare ETH gateway"""
    try:
        async with aiohttp.ClientSession() as session:
            # Use Cloudflare's public Ethereum RPC
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_call",
                "params": [{
                    # ENS registry: resolver(namehash)
                    "to": "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",  # ENS Universal Resolver
                    "data": _encode_resolve(name)
                }, "latest"]
            }
            async with session.post("https://cloudflare-eth.com", json=payload) as resp:
                data = await resp.json()
                result = data.get("result", "0x")
                if result and result != "0x" and len(result) >= 66:
                    # Extract address from response (last 20 bytes of first 32-byte word)
                    address = "0x" + result[26:66]
                    if is_valid_address(address) and address != "0x0000000000000000000000000000000000000000":
                        return address

        # Fallback: use ensdata.net API
        async with aiohttp.ClientSession() as session:
            async with session.get(f"https://api.ensdata.net/{name}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    address = data.get("address")
                    if address and is_valid_address(address):
                        return address
    except Exception as e:
        logging.getLogger('bot').error(f"ENS resolution failed for {name}: {e}")

    return None


def _encode_resolve(name: str) -> str:
    """Encode ENS name for the universal resolver's resolve(bytes,bytes) call"""
    import hashlib

    # DNS-encode the name
    dns_encoded = b""
    for label in name.split("."):
        encoded_label = label.encode("utf-8")
        dns_encoded += bytes([len(encoded_label)]) + encoded_label
    dns_encoded += b"\x00"

    # addr(bytes32) selector = 0x3b3b57de + namehash
    namehash = _namehash(name)
    inner_data = bytes.fromhex("3b3b57de") + bytes.fromhex(namehash[2:])

    # resolve(bytes,bytes) selector = 0x9061b923
    selector = "9061b923"

    # ABI encode: offset to dns_name, offset to inner_data, then the data
    # offset to dns_name = 64 (0x40)
    # offset to inner_data = 64 + 32 + ceil(len(dns)/32)*32
    dns_padded_len = ((len(dns_encoded) + 31) // 32) * 32
    inner_padded_len = ((len(inner_data) + 31) // 32) * 32

    offset1 = 64  # offset to first bytes param
    offset2 = offset1 + 32 + dns_padded_len  # offset to second bytes param

    result = selector
    result += offset1.to_bytes(32, "big").hex()
    result += offset2.to_bytes(32, "big").hex()
    # dns_encoded bytes
    result += len(dns_encoded).to_bytes(32, "big").hex()
    result += dns_encoded.hex().ljust(dns_padded_len * 2, "0")
    # inner_data bytes
    result += len(inner_data).to_bytes(32, "big").hex()
    result += inner_data.hex().ljust(inner_padded_len * 2, "0")

    return "0x" + result


def _namehash(name: str) -> str:
    """Compute ENS namehash"""
    import hashlib
    node = b"\x00" * 32
    if name:
        labels = name.split(".")
        for label in reversed(labels):
            label_hash = hashlib.sha3_256(label.encode("utf-8")).digest()
            node = hashlib.sha3_256(node + label_hash).digest()
    return "0x" + node.hex()


class WalletRegistry:
    """Manages discord_id -> wallet_address mappings with JSON persistence"""

    def __init__(self):
        self.logger = logging.getLogger('bot')
        self._discord_wallets = {}  # discord_id (str) -> wallet_address (str)
        self._name_wallets = {}     # display_name (str) -> wallet_address (str)
        self._load()

    def _load(self):
        """Load wallets from JSON files"""
        # Load discord ID -> wallet mappings
        if os.path.exists(WALLETS_FILE):
            with open(WALLETS_FILE, 'r') as f:
                self._discord_wallets = json.load(f)
            self.logger.info(f"Loaded {len(self._discord_wallets)} discord wallet mappings")

        # Load name -> wallet mappings (pre-populated list)
        if os.path.exists(NAMES_FILE):
            with open(NAMES_FILE, 'r') as f:
                self._name_wallets = json.load(f)
            self.logger.info(f"Loaded {len(self._name_wallets)} name wallet mappings")

    def _save(self):
        """Save discord wallet mappings to JSON"""
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(WALLETS_FILE, 'w') as f:
            json.dump(self._discord_wallets, f, indent=2)

    def register(self, discord_id: int, wallet: str) -> None:
        """Register a wallet for a discord user"""
        self._discord_wallets[str(discord_id)] = wallet
        self._save()

    def get_by_discord_id(self, discord_id: int) -> str | None:
        """Look up wallet by discord ID"""
        return self._discord_wallets.get(str(discord_id))

    def get_by_name(self, display_name: str) -> str | None:
        """Look up wallet by display name (case-insensitive fuzzy match)"""
        name_lower = display_name.lower().strip()
        for name, wallet in self._name_wallets.items():
            if name.lower().strip() == name_lower:
                return wallet
        return None

    def lookup(self, member: discord.Member) -> str | None:
        """Look up wallet for a Discord member - tries ID first, then name matching"""
        # Try exact discord ID match first
        wallet = self.get_by_discord_id(member.id)
        if wallet:
            return wallet

        # Try display name match
        wallet = self.get_by_name(member.display_name)
        if wallet:
            return wallet

        # Try username match
        wallet = self.get_by_name(member.name)
        if wallet:
            return wallet

        # Try global name match
        if member.global_name:
            wallet = self.get_by_name(member.global_name)
            if wallet:
                return wallet

        return None

    def get_all_discord(self) -> dict:
        """Get all discord ID -> wallet mappings"""
        return dict(self._discord_wallets)

    def get_all_names(self) -> dict:
        """Get all name -> wallet mappings"""
        return dict(self._name_wallets)

    def add_name_mapping(self, name: str, wallet: str) -> None:
        """Add a name -> wallet mapping"""
        self._name_wallets[name] = wallet
        with open(NAMES_FILE, 'w') as f:
            json.dump(self._name_wallets, f, indent=2)

    def stats(self) -> dict:
        """Get registry stats"""
        return {
            'discord_linked': len(self._discord_wallets),
            'name_entries': len(self._name_wallets),
            'names_without_wallet': sum(1 for v in self._name_wallets.values() if not v)
        }


class WalletCog(commands.Cog):
    """Cog for wallet registration and lookup"""

    def __init__(self, bot):
        self.bot = bot
        self.logger = logging.getLogger('bot')
        self.registry = WalletRegistry()
        # Store on bot for access from other cogs
        bot.wallet_registry = self.registry

    def is_supreme_admin(self, member: discord.Member) -> bool:
        """Check if a member has the Supreme Admin role"""
        return any(role.id == SUPREME_ADMIN_ROLE_ID for role in member.roles)

    @app_commands.command(
        name="register",
        description="Register your Ethereum wallet or ENS name for onchain Respect"
    )
    @app_commands.describe(wallet="Your Ethereum wallet address (0x...) or ENS name (e.g. vitalik.eth)")
    async def register(self, interaction: discord.Interaction, wallet: str):
        """Register your wallet address or ENS name"""
        await interaction.response.defer(ephemeral=True)

        wallet = wallet.strip()

        # Check if it's an ENS name
        if is_ens_name(wallet):
            ens_name = wallet
            resolved = await resolve_ens(ens_name)
            if not resolved:
                await interaction.followup.send(
                    f"❌ Could not resolve ENS name `{ens_name}`. Make sure it exists and has an address set.",
                    ephemeral=True
                )
                return
            wallet = resolved
            short = f"{wallet[:6]}...{wallet[-4:]}"
            self.registry.register(interaction.user.id, wallet)
            await interaction.followup.send(
                f"✅ ENS `{ens_name}` resolved and registered: `{short}`\n"
                f"Your fractal results will now link to this address for onchain submission.",
                ephemeral=True
            )
            return

        if not is_valid_address(wallet):
            await interaction.followup.send(
                "❌ Invalid input. Provide a wallet address (`0x...`) or an ENS name (`name.eth`).",
                ephemeral=True
            )
            return

        self.registry.register(interaction.user.id, wallet)
        short = f"{wallet[:6]}...{wallet[-4:]}"
        await interaction.followup.send(
            f"✅ Wallet registered: `{short}`\n"
            f"Your fractal results will now link to this address for onchain submission.",
            ephemeral=True
        )

    @app_commands.command(
        name="wallet",
        description="Show your registered wallet address"
    )
    async def wallet(self, interaction: discord.Interaction):
        """Show your registered wallet"""
        await interaction.response.defer(ephemeral=True)

        wallet = self.registry.lookup(interaction.user)
        if wallet:
            source = "Discord ID" if self.registry.get_by_discord_id(interaction.user.id) else "name match"
            await interaction.followup.send(
                f"🔗 Your wallet: `{wallet}`\n(matched via {source})",
                ephemeral=True
            )
        else:
            await interaction.followup.send(
                "❌ No wallet found. Use `/register 0xYourAddress` to link one.",
                ephemeral=True
            )

    @app_commands.command(
        name="admin_register",
        description="[ADMIN] Register a wallet or ENS for another user"
    )
    @app_commands.describe(user="Discord user", wallet="Their Ethereum wallet address or ENS name")
    async def admin_register(self, interaction: discord.Interaction, user: discord.Member, wallet: str):
        """Admin: register wallet or ENS for another user"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send("❌ You need the **Supreme Admin** role to use this command.", ephemeral=True)
            return

        wallet = wallet.strip()

        if is_ens_name(wallet):
            ens_name = wallet
            resolved = await resolve_ens(ens_name)
            if not resolved:
                await interaction.followup.send(f"❌ Could not resolve ENS name `{ens_name}`.", ephemeral=True)
                return
            wallet = resolved
            short = f"{wallet[:6]}...{wallet[-4:]}"
            self.registry.register(user.id, wallet)
            await interaction.followup.send(
                f"✅ ENS `{ens_name}` resolved → `{short}` registered for {user.mention}",
                ephemeral=True
            )
            return

        if not is_valid_address(wallet):
            await interaction.followup.send("❌ Invalid input. Provide a wallet address (`0x...`) or ENS name (`name.eth`).", ephemeral=True)
            return

        self.registry.register(user.id, wallet)
        short = f"{wallet[:6]}...{wallet[-4:]}"
        await interaction.followup.send(
            f"✅ Registered `{short}` for {user.mention}",
            ephemeral=True
        )

    @app_commands.command(
        name="admin_wallets",
        description="[ADMIN] List all wallet registrations and stats"
    )
    async def admin_wallets(self, interaction: discord.Interaction):
        """Admin: list all wallet registrations"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send("❌ You need the **Supreme Admin** role to use this command.", ephemeral=True)
            return

        stats = self.registry.stats()
        discord_wallets = self.registry.get_all_discord()

        msg = f"# 🔗 Wallet Registry\n\n"
        msg += f"**Discord-linked:** {stats['discord_linked']}\n"
        msg += f"**Name entries:** {stats['name_entries']}\n\n"

        if discord_wallets:
            msg += "**Discord ID Registrations:**\n"
            for did, wallet in list(discord_wallets.items())[:20]:
                short = f"{wallet[:6]}...{wallet[-4:]}"
                try:
                    member = interaction.guild.get_member(int(did))
                    name = member.display_name if member else f"ID:{did}"
                except:
                    name = f"ID:{did}"
                msg += f"• {name}: `{short}`\n"

            if len(discord_wallets) > 20:
                msg += f"\n... and {len(discord_wallets) - 20} more\n"

        msg += f"\n**Name lookup** has {stats['name_entries']} entries ready for auto-matching."

        await interaction.followup.send(msg, ephemeral=True)

    @app_commands.command(
        name="admin_lookup",
        description="[ADMIN] Look up a user's wallet (checks both ID and name)"
    )
    @app_commands.describe(user="Discord user to look up")
    async def admin_lookup(self, interaction: discord.Interaction, user: discord.Member):
        """Admin: look up wallet for a user"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send("❌ You need the **Supreme Admin** role to use this command.", ephemeral=True)
            return

        wallet = self.registry.lookup(user)
        if wallet:
            by_id = self.registry.get_by_discord_id(user.id)
            by_name = self.registry.get_by_name(user.display_name) or self.registry.get_by_name(user.name)
            source = "Discord ID" if by_id else f"name match ({user.display_name})"
            await interaction.followup.send(
                f"🔗 {user.mention}: `{wallet}`\n(matched via {source})",
                ephemeral=True
            )
        else:
            await interaction.followup.send(
                f"❌ No wallet found for {user.mention}\n"
                f"Display name: `{user.display_name}`\n"
                f"Username: `{user.name}`\n"
                f"Global name: `{user.global_name}`",
                ephemeral=True
            )

    @app_commands.command(
        name="admin_match_all",
        description="[ADMIN] Auto-match all server members to wallets by name"
    )
    async def admin_match_all(self, interaction: discord.Interaction):
        """Admin: try to match all guild members to wallets"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send("❌ You need the **Supreme Admin** role to use this command.", ephemeral=True)
            return

        matched = []
        unmatched = []

        for member in interaction.guild.members:
            if member.bot:
                continue
            wallet = self.registry.lookup(member)
            if wallet:
                short = f"{wallet[:6]}...{wallet[-4:]}"
                matched.append(f"✅ {member.display_name}: `{short}`")
            else:
                unmatched.append(f"❌ {member.display_name} ({member.name})")

        msg = f"# 🔍 Auto-Match Results\n\n"
        msg += f"**Matched: {len(matched)}** | **Unmatched: {len(unmatched)}**\n\n"

        if matched:
            msg += "**Matched:**\n"
            for m in matched[:30]:
                msg += f"{m}\n"
            if len(matched) > 30:
                msg += f"... +{len(matched) - 30} more\n"

        if unmatched:
            msg += f"\n**No wallet found:**\n"
            for u in unmatched[:20]:
                msg += f"{u}\n"
            if len(unmatched) > 20:
                msg += f"... +{len(unmatched) - 20} more\n"

        # Truncate if too long for Discord
        if len(msg) > 1900:
            msg = msg[:1900] + "\n... (truncated)"

        await interaction.followup.send(msg, ephemeral=True)


async def setup(bot):
    await bot.add_cog(WalletCog(bot))
