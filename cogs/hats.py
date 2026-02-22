import discord
from discord import app_commands
from discord.ext import commands, tasks
import logging
import time
import json
import os
import aiohttp
from cogs.base import BaseCog

# Hats Protocol contract (same on all chains)
HATS_CONTRACT = '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137'
ZAO_TREE_ID = 226
DEFAULT_OPTIMISM_RPC = 'https://mainnet.optimism.io'

# Function selectors (computed via keccak256)
SELECTOR_VIEW_HAT = '0xd395acf8'         # viewHat(uint256)
SELECTOR_IS_WEARER = '0x4352409a'        # isWearerOfHat(address,uint256)
SELECTOR_GET_NEXT_ID = '0x1183a8c0'      # getNextId(uint256)

# Cache settings
TREE_CACHE_TTL = 600  # 10 minutes
WEARER_CACHE_TTL = 300  # 5 minutes

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
HATS_ROLES_FILE = os.path.join(DATA_DIR, 'hats_roles.json')


def _get_rpc_url() -> str:
    return os.getenv('ALCHEMY_OPTIMISM_RPC', DEFAULT_OPTIMISM_RPC)


def _top_hat_id(tree_id: int) -> int:
    """Compute the top hat ID for a given tree"""
    return tree_id << 224


def _hat_id_hex(hat_id: int) -> str:
    """Format a hat ID as a 0x-prefixed 64-char hex string"""
    return '0x' + hex(hat_id)[2:].zfill(64)


def _pad_uint256(val: int) -> str:
    """Pad an integer to 32 bytes hex (no 0x prefix)"""
    return hex(val)[2:].zfill(64)


def _pad_address(addr: str) -> str:
    """Pad an address to 32 bytes hex (no 0x prefix)"""
    return addr[2:].lower().zfill(64)


async def _eth_call(to: str, data: str) -> str:
    """Make an eth_call to Optimism"""
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"]
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(_get_rpc_url(), json=payload) as resp:
            result = await resp.json()
            return result.get("result", "0x")


async def _view_hat(hat_id: int) -> dict | None:
    """Call viewHat(uint256) and parse the result"""
    data = SELECTOR_VIEW_HAT + _pad_uint256(hat_id)
    result = await _eth_call(HATS_CONTRACT, data)

    if not result or result == '0x' or len(result) < 66:
        return None

    # viewHat returns: (string details, uint32 maxSupply, uint32 supply,
    #                   address eligibility, address toggle, string imageURI,
    #                   uint16 lastHatId, bool mutable_, bool active)
    # ABI-encoded with dynamic strings
    try:
        raw = result[2:]  # strip 0x

        # Parse fixed fields (offsets for dynamic, then fixed values)
        # Word 0: offset to details string
        # Word 1: maxSupply (uint32)
        max_supply = int(raw[64:128], 16)
        # Word 2: supply (uint32)
        supply = int(raw[128:192], 16)
        # Word 3: eligibility (address)
        eligibility = '0x' + raw[192+24:256]
        # Word 4: toggle (address)
        toggle = '0x' + raw[256+24:320]
        # Word 5: offset to imageURI string
        # Word 6: lastHatId (uint16)
        last_hat_id = int(raw[384:448], 16)
        # Word 7: mutable_ (bool)
        mutable = int(raw[448:512], 16) != 0
        # Word 8: active (bool)
        active = int(raw[512:576], 16) != 0

        # Decode details string
        details_offset = int(raw[0:64], 16) * 2
        details_len = int(raw[details_offset:details_offset+64], 16)
        details_hex = raw[details_offset+64:details_offset+64+details_len*2]
        details = bytes.fromhex(details_hex).decode('utf-8', errors='replace') if details_hex else ''

        # Decode imageURI string
        image_offset = int(raw[320:384], 16) * 2
        image_len = int(raw[image_offset:image_offset+64], 16)
        image_hex = raw[image_offset+64:image_offset+64+image_len*2]
        image_uri = bytes.fromhex(image_hex).decode('utf-8', errors='replace') if image_hex else ''

        return {
            'details': details,
            'max_supply': max_supply,
            'supply': supply,
            'eligibility': eligibility,
            'toggle': toggle,
            'image_uri': image_uri,
            'last_hat_id': last_hat_id,
            'mutable': mutable,
            'active': active,
        }
    except Exception as e:
        logging.getLogger('bot').error(f"Failed to parse viewHat result for {_hat_id_hex(hat_id)}: {e}")
        return None


async def _is_wearer_of_hat(address: str, hat_id: int) -> bool:
    """Check if an address wears a specific hat"""
    data = SELECTOR_IS_WEARER + _pad_address(address) + _pad_uint256(hat_id)
    result = await _eth_call(HATS_CONTRACT, data)
    if result and len(result) >= 66:
        return int(result, 16) != 0
    return False


async def _get_next_id(admin_hat_id: int) -> int:
    """Get the next child hat ID under a given admin hat"""
    data = SELECTOR_GET_NEXT_ID + _pad_uint256(admin_hat_id)
    result = await _eth_call(HATS_CONTRACT, data)
    if result and result != '0x' and len(result) >= 66:
        return int(result, 16)
    return 0


async def _fetch_ipfs_details(ipfs_uri: str) -> dict:
    """Fetch and parse JSON metadata from IPFS"""
    if not ipfs_uri:
        return {}

    # Convert ipfs:// to gateway URL
    if ipfs_uri.startswith('ipfs://'):
        url = 'https://ipfs.io/ipfs/' + ipfs_uri[7:]
    elif ipfs_uri.startswith('http'):
        url = ipfs_uri
    else:
        return {}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        # Plain text details (not JSON)
                        return {'name': text[:100]}
    except Exception:
        pass
    return {}


def _ipfs_to_http(uri: str) -> str | None:
    """Convert ipfs:// URI to HTTP gateway URL"""
    if not uri:
        return None
    if uri.startswith('ipfs://'):
        return 'https://ipfs.io/ipfs/' + uri[7:]
    if uri.startswith('http'):
        return uri
    return None


class HatsRoleMapping:
    """Stores hat_id -> Discord role_id mappings for channel gating"""

    def __init__(self):
        self._data = {}  # hat_id_hex -> {role_id, hat_name}
        self._load()

    def _load(self):
        if os.path.exists(HATS_ROLES_FILE):
            with open(HATS_ROLES_FILE, 'r') as f:
                self._data = json.load(f)

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(HATS_ROLES_FILE, 'w') as f:
            json.dump(self._data, f, indent=2)

    def set(self, hat_id_hex: str, role_id: int, hat_name: str):
        self._data[hat_id_hex] = {'role_id': role_id, 'hat_name': hat_name}
        self._save()

    def remove(self, hat_id_hex: str):
        if hat_id_hex in self._data:
            del self._data[hat_id_hex]
            self._save()

    def get_all(self) -> dict:
        return self._data.copy()

    def get_role_id(self, hat_id_hex: str) -> int | None:
        entry = self._data.get(hat_id_hex)
        return entry['role_id'] if entry else None


class HatsCog(BaseCog):
    """Cog for Hats Protocol integration — tree viewer, hat checks, role sync"""

    def __init__(self, bot):
        super().__init__(bot)
        self.role_mapping = HatsRoleMapping()
        self._tree_cache = None
        self._tree_cache_time = 0
        self._wearer_cache = {}  # (wallet, hat_id) -> {result, timestamp}

    async def cog_load(self):
        """Start the role sync loop"""
        self.sync_roles_loop.start()

    async def cog_unload(self):
        self.sync_roles_loop.cancel()

    # ── Tree fetching ──

    async def _build_tree(self, hat_id: int, depth: int = 0, max_depth: int = 3) -> list[dict]:
        """Recursively build the hat tree from onchain data"""
        hat_data = await _view_hat(hat_id)
        if not hat_data:
            return []

        # Try to get a readable name from IPFS
        name = None
        details_meta = await _fetch_ipfs_details(hat_data['details'])
        if isinstance(details_meta, dict):
            name = details_meta.get('name') or details_meta.get('title')
        if not name and hat_data['details']:
            # Details might be plain text
            name = hat_data['details'][:80] if not hat_data['details'].startswith('ipfs://') else None

        node = {
            'id': hat_id,
            'id_hex': _hat_id_hex(hat_id),
            'name': name or f'Hat {_hat_id_hex(hat_id)[:18]}...',
            'supply': hat_data['supply'],
            'max_supply': hat_data['max_supply'],
            'active': hat_data['active'],
            'image_uri': hat_data['image_uri'],
            'children': [],
            'depth': depth,
        }

        if depth >= max_depth:
            return [node]

        # Enumerate children
        if hat_data['last_hat_id'] > 0:
            for i in range(1, hat_data['last_hat_id'] + 1):
                # Child hat ID: shift parent's level and add child index
                child_id = self._compute_child_id(hat_id, i, depth)
                if child_id:
                    child_nodes = await self._build_tree(child_id, depth + 1, max_depth)
                    node['children'].extend(child_nodes)

        return [node]

    def _compute_child_id(self, parent_id: int, child_index: int, parent_depth: int) -> int | None:
        """Compute a child hat ID given parent and index.

        Hat IDs use a hierarchical encoding:
        - Top hat (level 0): first 4 bytes = tree ID
        - Level 1: next 2 bytes
        - Level 2+: subsequent 2 bytes each
        """
        # Level 0 (top hat): children use bytes 4-5 (bits 208-223)
        # Level 1: children use bytes 6-7 (bits 192-207)
        # Level N: children use bytes (4 + N*2) to (5 + N*2)

        if parent_depth == 0:
            # Top hat -> level 1 child
            shift = 224 - 16  # bits 208
        else:
            # Level N -> level N+1
            shift = 224 - 16 * (parent_depth + 1)

        if shift < 0:
            return None

        return parent_id | (child_index << shift)

    async def _get_cached_tree(self) -> list[dict]:
        """Get tree with caching"""
        if self._tree_cache and time.time() - self._tree_cache_time < TREE_CACHE_TTL:
            return self._tree_cache

        top_hat = _top_hat_id(ZAO_TREE_ID)
        tree = await self._build_tree(top_hat, depth=0, max_depth=2)
        self._tree_cache = tree
        self._tree_cache_time = time.time()
        return tree

    # ── Role sync ──

    @tasks.loop(minutes=10)
    async def sync_roles_loop(self):
        """Periodically sync Discord roles based on hat ownership"""
        mappings = self.role_mapping.get_all()
        if not mappings:
            return

        registry = getattr(self.bot, 'wallet_registry', None)
        if not registry:
            return

        for guild in self.bot.guilds:
            for hat_id_hex, mapping in mappings.items():
                role_id = mapping['role_id']
                role = guild.get_role(role_id)
                if not role:
                    continue

                hat_id = int(hat_id_hex, 16)

                for member in guild.members:
                    if member.bot:
                        continue

                    wallet = registry.lookup(member)
                    if not wallet:
                        # No wallet = no hat check, remove role if they have it
                        if role in member.roles:
                            try:
                                await member.remove_roles(role, reason="Hats Protocol sync - no wallet")
                            except discord.Forbidden:
                                pass
                        continue

                    is_wearer = await _is_wearer_of_hat(wallet, hat_id)

                    if is_wearer and role not in member.roles:
                        try:
                            await member.add_roles(role, reason="Hats Protocol sync")
                            self.logger.info(f"Added role {role.name} to {member.display_name} (hat wearer)")
                        except discord.Forbidden:
                            self.logger.warning(f"Cannot add role {role.name} - missing permissions")
                    elif not is_wearer and role in member.roles:
                        try:
                            await member.remove_roles(role, reason="Hats Protocol sync - no longer wearing hat")
                            self.logger.info(f"Removed role {role.name} from {member.display_name}")
                        except discord.Forbidden:
                            pass

    @sync_roles_loop.before_loop
    async def before_sync(self):
        await self.bot.wait_until_ready()

    # ── Commands ──

    @app_commands.command(
        name="hats",
        description="View the ZAO Hats Protocol tree structure"
    )
    async def hats(self, interaction: discord.Interaction):
        """Show the ZAO hats tree"""
        await interaction.response.defer()

        tree = await self._get_cached_tree()
        if not tree:
            await interaction.followup.send("Could not fetch the ZAO hats tree.", ephemeral=True)
            return

        embed = discord.Embed(
            title="\U0001f3a9 ZAO Hats Tree",
            description="Onchain org structure on Optimism via [Hats Protocol](https://app.hatsprotocol.xyz/trees/10/226)",
            color=0x57F287
        )

        lines = self._format_tree(tree, max_lines=25)
        embed.add_field(name="Organization", value="\n".join(lines) or "Empty tree", inline=False)

        # Role mappings
        mappings = self.role_mapping.get_all()
        if mappings:
            role_lines = []
            for hat_hex, m in list(mappings.items())[:10]:
                role_lines.append(f"\U0001f3a9 {m['hat_name']} \u2192 <@&{m['role_id']}>")
            embed.add_field(name="Role Sync", value="\n".join(role_lines), inline=False)

        embed.set_footer(text="Hats Protocol \u2022 Optimism \u2022 Tree 226")
        await interaction.followup.send(embed=embed)

    def _format_tree(self, nodes: list[dict], max_lines: int = 25) -> list[str]:
        """Format tree nodes into indented lines"""
        lines = []
        for node in nodes:
            indent = "\u2003" * node['depth']
            status = "\u2705" if node['active'] else "\u274c"
            supply_text = f"({node['supply']}/{node['max_supply']})"
            lines.append(f"{indent}{status} **{node['name']}** {supply_text}")

            if len(lines) >= max_lines:
                lines.append("*... and more (use `/hat` to explore)*")
                return lines

            for child in node.get('children', []):
                child_lines = self._format_tree([child], max_lines - len(lines))
                lines.extend(child_lines)
                if len(lines) >= max_lines:
                    return lines
        return lines

    @app_commands.command(
        name="hat",
        description="View details about a specific hat in the ZAO tree"
    )
    @app_commands.describe(name="Hat name to search for (e.g. 'Entrepreneur', 'Community Manager')")
    async def hat_detail(self, interaction: discord.Interaction, name: str):
        """View a specific hat's details"""
        await interaction.response.defer()

        tree = await self._get_cached_tree()
        if not tree:
            await interaction.followup.send("Could not fetch the hats tree.", ephemeral=True)
            return

        # Search for the hat by name
        found = self._find_hat(tree, name.lower())
        if not found:
            await interaction.followup.send(
                f"No hat found matching \"{name}\". Try `/hats` to see the full tree.",
                ephemeral=True
            )
            return

        hat_data = await _view_hat(found['id'])
        details_meta = await _fetch_ipfs_details(hat_data['details']) if hat_data else {}

        embed = discord.Embed(
            title=f"\U0001f3a9 {found['name']}",
            url=f"https://app.hatsprotocol.xyz/trees/10/226",
            color=0x57F287
        )

        desc = ""
        if isinstance(details_meta, dict) and details_meta.get('description'):
            desc = details_meta['description'][:500]
        embed.description = desc or "*No description available*"

        embed.add_field(name="Supply", value=f"{found['supply']}/{found['max_supply']}", inline=True)
        embed.add_field(name="Active", value="\u2705 Yes" if found['active'] else "\u274c No", inline=True)
        embed.add_field(
            name="Hat ID",
            value=f"`{found['id_hex'][:18]}...`",
            inline=True
        )

        if found.get('children'):
            child_names = [c['name'] for c in found['children'][:10]]
            embed.add_field(
                name=f"Sub-hats ({len(found['children'])})",
                value=", ".join(child_names) or "None",
                inline=False
            )

        image_url = _ipfs_to_http(found.get('image_uri', ''))
        if image_url:
            embed.set_thumbnail(url=image_url)

        embed.add_field(
            name="View on Hats",
            value=f"[Open in Hats App](https://app.hatsprotocol.xyz/trees/10/226)",
            inline=False
        )
        embed.set_footer(text="Hats Protocol \u2022 Optimism \u2022 Tree 226")

        await interaction.followup.send(embed=embed)

    def _find_hat(self, nodes: list[dict], query: str) -> dict | None:
        """Search tree for a hat by name (case-insensitive partial match)"""
        for node in nodes:
            if query in node.get('name', '').lower():
                return node
            found = self._find_hat(node.get('children', []), query)
            if found:
                return found
        return None

    @app_commands.command(
        name="myhats",
        description="See which ZAO hats you wear (requires registered wallet)"
    )
    @app_commands.describe(user="Member to check (default: yourself)")
    async def myhats(self, interaction: discord.Interaction, user: discord.Member = None):
        """Check which hats a user wears"""
        await interaction.response.defer(ephemeral=True)

        target = user or interaction.user
        registry = getattr(self.bot, 'wallet_registry', None)
        if not registry:
            await interaction.followup.send("Wallet system not available.", ephemeral=True)
            return

        wallet = registry.lookup(target)
        if not wallet:
            await interaction.followup.send(
                f"**{target.display_name}** doesn't have a registered wallet. Use `/register` first.",
                ephemeral=True
            )
            return

        tree = await self._get_cached_tree()
        if not tree:
            await interaction.followup.send("Could not fetch the hats tree.", ephemeral=True)
            return

        # Check each hat in the tree
        worn_hats = []
        await self._check_hats_recursive(wallet, tree, worn_hats)

        embed = discord.Embed(
            title=f"\U0001f3a9 Hats for {target.display_name}",
            color=0x57F287
        )

        if worn_hats:
            lines = []
            for hat in worn_hats:
                lines.append(f"\u2705 **{hat['name']}**")
            embed.description = "\n".join(lines)
        else:
            embed.description = "*No hats found for this wallet.*"

        embed.add_field(
            name="Wallet",
            value=f"`{wallet[:6]}...{wallet[-4:]}`",
            inline=True
        )
        embed.add_field(
            name="Claim Hats",
            value="[Open Hats App](https://app.hatsprotocol.xyz/trees/10/226)",
            inline=True
        )
        embed.set_footer(text="Hats Protocol \u2022 Optimism \u2022 Tree 226")

        await interaction.followup.send(embed=embed, ephemeral=True)

    async def _check_hats_recursive(self, wallet: str, nodes: list[dict], results: list):
        """Recursively check if wallet wears each hat"""
        for node in nodes:
            if node['supply'] > 0:  # Only check hats with wearers
                is_wearer = await _is_wearer_of_hat(wallet, node['id'])
                if is_wearer:
                    results.append(node)
            for child in node.get('children', []):
                await self._check_hats_recursive(wallet, [child], results)

    @app_commands.command(
        name="claimhat",
        description="Get a link to claim a hat on the Hats Protocol app"
    )
    async def claimhat(self, interaction: discord.Interaction):
        """Link to claim hats"""
        embed = discord.Embed(
            title="\U0001f3a9 Claim a ZAO Hat",
            description=(
                "Hats represent roles and teams in the ZAO. "
                "Claim your hat on the Hats Protocol app to join a team.\n\n"
                "**[Open ZAO Hats Tree \u2192](https://app.hatsprotocol.xyz/trees/10/226)**\n\n"
                "After claiming, use `/myhats` to verify, and your Discord roles "
                "will auto-sync within 10 minutes."
            ),
            color=0x57F287
        )
        embed.set_footer(text="Hats Protocol \u2022 Optimism \u2022 Tree 226")
        await interaction.response.send_message(embed=embed)

    # ── Admin: Role sync management ──

    @app_commands.command(
        name="admin_link_hat",
        description="[ADMIN] Link a hat to a Discord role for auto-sync"
    )
    @app_commands.describe(
        hat_name="Name of the hat (for display)",
        hat_id="Hat ID in hex (from Hats app)",
        role="Discord role to sync with this hat"
    )
    async def admin_link_hat(self, interaction: discord.Interaction,
                             hat_name: str, hat_id: str, role: discord.Role):
        """Link a hat to a Discord role"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role.", ephemeral=True
            )
            return

        # Validate hat_id format
        if not hat_id.startswith('0x'):
            hat_id = '0x' + hat_id

        try:
            int(hat_id, 16)
        except ValueError:
            await interaction.followup.send("Invalid hat ID format.", ephemeral=True)
            return

        self.role_mapping.set(hat_id, role.id, hat_name)

        await interaction.followup.send(
            f"\U0001f3a9 Linked **{hat_name}** (`{hat_id[:18]}...`) \u2192 {role.mention}\n"
            f"Role sync will run every 10 minutes.",
            ephemeral=True
        )

    @app_commands.command(
        name="admin_unlink_hat",
        description="[ADMIN] Remove a hat-to-role mapping"
    )
    @app_commands.describe(hat_id="Hat ID in hex to unlink")
    async def admin_unlink_hat(self, interaction: discord.Interaction, hat_id: str):
        """Unlink a hat from a Discord role"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role.", ephemeral=True
            )
            return

        if not hat_id.startswith('0x'):
            hat_id = '0x' + hat_id

        self.role_mapping.remove(hat_id)
        await interaction.followup.send(f"Unlinked hat `{hat_id[:18]}...`", ephemeral=True)

    @app_commands.command(
        name="admin_hat_roles",
        description="[ADMIN] List all hat-to-role mappings"
    )
    async def admin_hat_roles(self, interaction: discord.Interaction):
        """List all hat-role mappings"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role.", ephemeral=True
            )
            return

        mappings = self.role_mapping.get_all()
        if not mappings:
            await interaction.followup.send("No hat-role mappings configured.", ephemeral=True)
            return

        embed = discord.Embed(
            title="\U0001f3a9 Hat \u2192 Role Mappings",
            color=0x57F287
        )

        lines = []
        for hat_hex, m in mappings.items():
            lines.append(
                f"**{m['hat_name']}** (`{hat_hex[:18]}...`)\n"
                f"\u2003\u2192 <@&{m['role_id']}>"
            )
        embed.description = "\n\n".join(lines)
        embed.set_footer(text="Sync runs every 10 minutes \u2022 Hats Protocol")

        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="admin_sync_hats",
        description="[ADMIN] Manually trigger hat-to-role sync now"
    )
    async def admin_sync_hats(self, interaction: discord.Interaction):
        """Force an immediate role sync"""
        await interaction.response.defer(ephemeral=True)

        if not self.is_supreme_admin(interaction.user):
            await interaction.followup.send(
                "You need the **Supreme Admin** role.", ephemeral=True
            )
            return

        mappings = self.role_mapping.get_all()
        if not mappings:
            await interaction.followup.send("No hat-role mappings to sync.", ephemeral=True)
            return

        await interaction.followup.send("\u23f3 Syncing roles...", ephemeral=True)
        await self.sync_roles_loop.coro(self)
        await interaction.edit_original_response(content="\u2705 Role sync complete!")


async def setup(bot):
    await bot.add_cog(HatsCog(bot))
