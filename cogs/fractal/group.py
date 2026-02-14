import discord
import logging
import asyncio
import random
from typing import Optional, List, Dict
from utils.web_integration import web_integration

class FractalGroup:
    """Core class for managing a fractal voting group"""

    def __init__(self, thread: discord.Thread, members: List[discord.Member], facilitator: discord.Member, cog):
        """Initialize a new fractal group"""
        self.thread = thread
        self.facilitator = facilitator
        self.members = members
        self.active_candidates = members.copy()  # Members currently in voting pool
        self.votes = {}  # Dict mapping voter_id to candidate_id
        self.winners = {}  # Dict mapping level to winner
        self.current_level = 6  # Start at level 6
        self.current_voting_message = None
        self.cog = cog
        self.logger = logging.getLogger('bot')

        self.logger.info(f"Created fractal group '{thread.name}' with facilitator {facilitator.display_name} and {len(members)} members")

    async def start_fractal(self):
        """Start the fractal voting process"""
        self.logger.info(f"Starting fractal process for '{self.thread.name}' with {len(self.members)} members")

        # Send welcome message
        welcome_msg = (
            f"# 🎊 **Welcome to {self.thread.name}!** 🎊\n\n"
            f"**Facilitator:** {self.facilitator.mention}\n"
            f"**Members:** {', '.join([m.mention for m in self.members])}\n\n"
            f"🗳️ **Starting fractal voting process...**\n"
            f"We'll vote through levels 6→1 until we have a winner!\n\n"
        )
        await self.thread.send(welcome_msg)

        # Notify web app that fractal started
        await web_integration.notify_fractal_started(self)

        # Start first round
        self.logger.info(f"Starting first round for '{self.thread.name}'")
        await self.start_new_round()

    async def add_member(self, member: discord.Member):
        """Add a member to the fractal group"""
        if member not in self.members:
            self.members.append(member)
            self.active_candidates.append(member)
            await self.thread.add_user(member)
            self.logger.info(f"Added {member.display_name} to fractal group '{self.thread.name}'")

    async def start_new_round(self, winner: Optional[discord.Member] = None):
        """Start a new voting round, optionally recording a previous winner"""
        # Process previous winner if exists
        if winner:
            self.winners[self.current_level] = winner
            self.active_candidates.remove(winner)  # Remove from active candidates
            self.current_level -= 1  # Move to next level

            # Send prominent winner announcement like the second image
            await self.thread.send(
                f"🎊 **LEVEL {self.current_level + 1} WINNER: {winner.mention}!** 🎊\n\n"
                f"Moving to Level {self.current_level}..."
            )

        # Check if we've reached the end
        if self.current_level < 1 or len(self.active_candidates) <= 1:
            await self.end_fractal()
            return

        # Reset votes for new round
        self.votes = {}

        # Log active candidates
        candidate_names = ", ".join([c.display_name for c in self.active_candidates])
        self.logger.info(f"Starting level {self.current_level} with {len(self.active_candidates)} candidates: {candidate_names}")

        try:
            # Import here to avoid circular import
            from .views import ZAOFractalVotingView

            # Create voting view with buttons
            view = ZAOFractalVotingView(self)

            # Create beautiful voting message like the second image
            votes_needed = self.get_vote_threshold()
            candidates_list = ", ".join([c.mention for c in self.active_candidates])

            voting_message = (
                f"🗳️ **Voting for Level {self.current_level}**\n\n"
                f"**Candidates:** {candidates_list}\n"
                f"**Votes Needed to Win:** {votes_needed} ({votes_needed}/{len(self.members)} members)\n\n"
                f"Click a button below to vote. Your vote will be announced publicly.\n"
                f"You can change your vote at any time by clicking a different button."
            )

            message = await self.thread.send(voting_message, view=view)
            self.current_voting_message = message

        except Exception as e:
            self.logger.error(f"Error creating voting UI: {e}", exc_info=True)
            await self.thread.send("❌ Error setting up voting buttons. Please try again.")

    def get_vote_threshold(self):
        """Calculate votes needed to win (50% or more)"""
        return max(1, len(self.members) // 2 + len(self.members) % 2)  # Ceiling division

    async def process_vote(self, voter: discord.Member, candidate: discord.Member):
        """Process a vote and announce it publicly"""
        previous_vote = self.votes.get(voter.id)
        previous_candidate = None

        if previous_vote:
            previous_candidate = discord.utils.get(self.active_candidates + [m for m in self.members if m.id in [w.id for w in self.winners.values()]], id=previous_vote)

        # Update vote
        self.votes[voter.id] = candidate.id

        # Notify web app of vote
        await web_integration.notify_vote_cast(self, voter, candidate)

        # Announce vote publicly with green checkmarks like the second image
        if previous_candidate:
            await self.thread.send(
                f"🔄 **Vote Changed:** {voter.mention} changed vote from {previous_candidate.mention} to {candidate.mention}"
            )
        else:
            await self.thread.send(
                f"✅ **New Vote:** {voter.mention} voted for {candidate.mention}"
            )

        # Check if this vote caused a winner
        await self.check_for_winner()

    async def check_for_winner(self):
        """Check if any candidate has reached the vote threshold"""
        vote_counts = {}

        # Count votes for each candidate
        for candidate_id in self.votes.values():
            vote_counts[candidate_id] = vote_counts.get(candidate_id, 0) + 1

        threshold = self.get_vote_threshold()

        # Check for a winner
        max_votes = max(vote_counts.values()) if vote_counts else 0

        if max_votes >= threshold:
            # Find all candidates with max votes (for tie-breaking)
            winners_with_max_votes = [
                candidate_id for candidate_id, count in vote_counts.items()
                if count == max_votes
            ]

            # Handle ties with random selection
            if len(winners_with_max_votes) > 1:
                await self.thread.send(
                    f"🎲 **Tie detected!** {len(winners_with_max_votes)} candidates tied with {max_votes} votes. Selecting randomly..."
                )
                winner_id = random.choice(winners_with_max_votes)
            else:
                winner_id = winners_with_max_votes[0]

            winner = discord.utils.get(self.active_candidates, id=winner_id)
            if winner:
                # Log winner info
                self.logger.info(f"Winner for level {self.current_level}: {winner.display_name} with {max_votes}/{len(self.members)} votes")

                # Notify web app of round completion
                await web_integration.notify_round_complete(self, winner)

                await self.start_new_round(winner)
                return

    async def end_fractal(self):
        """End the fractal process and show final results"""
        # Add final remaining candidate as last place
        if len(self.active_candidates) == 1:
            self.winners[self.current_level] = self.active_candidates[0]

        # Create final ranking
        final_ranking = []
        for level in sorted(self.winners.keys(), reverse=True):
            final_ranking.append(self.winners[level])

        # Show results in fractal thread
        results_text = "# 🏆 **FRACTAL COMPLETE!** 🏆\n\n**Final Rankings:**\n"
        for i, winner in enumerate(final_ranking, 1):
            medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"{i}."
            results_text += f"{medal} {winner.mention}\n"

        await self.thread.send(results_text)

        # Generate onchain submit breakout link
        await self._post_submit_breakout(final_ranking)

        # Notify web app that fractal is complete
        await web_integration.notify_fractal_complete(self)

        # Post simple results to general channel
        try:
            # Find a general channel to post results
            general_channel = None
            for channel in self.thread.guild.channels:
                if isinstance(channel, discord.TextChannel) and (
                    'general' in channel.name.lower() or
                    'main' in channel.name.lower() or
                    channel.name.lower() in ['chat', 'lobby']
                ):
                    general_channel = channel
                    break

            if not general_channel:
                # Fallback to first available text channel
                general_channel = next(
                    (ch for ch in self.thread.guild.channels if isinstance(ch, discord.TextChannel)),
                    None
                )

            if general_channel:
                simple_results = f"🏆 **{self.thread.name} Results:** "
                simple_results += ", ".join([f"{i+1}. {winner.display_name}" for i, winner in enumerate(final_ranking)])
                await general_channel.send(simple_results)

        except Exception as e:
            self.logger.error(f"Failed to post results to general channel: {e}")

        # Remove from active groups
        if hasattr(self.cog, 'active_groups') and self.thread.id in self.cog.active_groups:
            del self.cog.active_groups[self.thread.id]

        self.logger.info(f"Fractal group '{self.thread.name}' completed")

    async def _post_submit_breakout(self, final_ranking):
        """Generate and post the zao.frapps.xyz submitBreakout link"""
        try:
            # Get wallet registry from the bot
            registry = getattr(self.cog.bot, 'wallet_registry', None)
            if not registry:
                self.logger.warning("No wallet registry available - skipping submitBreakout link")
                return

            # Look up wallets for each ranked member
            wallet_params = []
            missing = []
            ranked_wallets = []
            for i, member in enumerate(final_ranking):
                wallet = registry.lookup(member)
                if wallet:
                    wallet_params.append(f"vote{i+1}={wallet}")
                    ranked_wallets.append((member, wallet))
                else:
                    missing.append(member.display_name)
                    wallet_params.append(f"vote{i+1}=")
                    ranked_wallets.append((member, None))

            # Get group number from daily counter
            guild_id = self.thread.guild.id
            from datetime import datetime
            today = datetime.now().strftime("%b %d, %Y")
            group_number = 1
            if hasattr(self.cog, 'daily_counters'):
                counters = self.cog.daily_counters.get(guild_id, {})
                group_number = counters.get(today, 1)

            # Build the URL
            base_url = "https://zao.frapps.xyz/submitBreakout"
            params = f"groupnumber={group_number}&" + "&".join(wallet_params)
            submit_url = f"{base_url}?{params}"

            # Build rankings text
            from config.config import RESPECT_POINTS
            fibonacci = RESPECT_POINTS
            rankings_lines = []
            for i, (member, wallet) in enumerate(ranked_wallets):
                respect = fibonacci[i] if i < len(fibonacci) else 0
                short = f"`{wallet[:6]}...{wallet[-4:]}`" if wallet else "⚠️ missing"
                rankings_lines.append(f"**{i+1}.** {member.mention} → {short} (+{respect} Respect)")

            # Post the embed
            embed = discord.Embed(
                title="🗳️ Submit Results Onchain",
                description=(
                    "**Fractal complete! Now submit these rankings onchain to earn Respect.**\n\n"
                    + "\n".join(rankings_lines)
                ),
                color=0x57F287,
                url=submit_url
            )

            if missing:
                embed.add_field(
                    name="⚠️ Missing Wallets",
                    value=f"{', '.join(missing)} — use `/register 0xYourAddress` to link",
                    inline=False
                )

            embed.set_footer(text="ZAO Fractal • zao.frapps.xyz")

            await self.thread.send(embed=embed)

            # Post clickable call to action that everyone sees
            mentions = " ".join([m.mention for m in self.members])
            await self.thread.send(
                f"🔗 **Go vote here to submit results onchain:**\n"
                f"{submit_url}\n\n"
                f"{mentions} — click the link above to confirm the breakout results!"
            )

        except Exception as e:
            self.logger.error(f"Error generating submitBreakout link: {e}", exc_info=True)
