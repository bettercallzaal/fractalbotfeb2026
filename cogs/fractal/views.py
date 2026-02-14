import discord
import logging
from typing import Callable, Dict, List
from .group import FractalGroup

class ZAOFractalVotingView(discord.ui.View):
    """UI view with voting buttons for fractal rounds"""

    def __init__(self, fractal_group):
        super().__init__(timeout=None)  # No timeout for persistent buttons
        self.fractal_group = fractal_group
        self.logger = logging.getLogger('bot')

        # Create voting buttons
        self.create_voting_buttons()

    def create_voting_buttons(self):
        """Create a button for each active candidate"""
        # Clear any existing buttons
        self.clear_items()

        # List of button styles to cycle through
        styles = [
            discord.ButtonStyle.primary,    # Blue
            discord.ButtonStyle.success,    # Green
            discord.ButtonStyle.danger,     # Red
            discord.ButtonStyle.secondary   # Grey
        ]

        # Create a button for each candidate
        for i, candidate in enumerate(self.fractal_group.active_candidates):
            # Cycle through button styles
            style = styles[i % len(styles)]

            # Create button with candidate name
            button = discord.ui.Button(
                style=style,
                label=candidate.display_name,
                custom_id=f"vote_{candidate.id}"
            )

            # Create and assign callback
            button.callback = self.create_vote_callback(candidate)
            self.add_item(button)

        self.logger.info(f"Created {len(self.fractal_group.active_candidates)} voting buttons")

    def create_vote_callback(self, candidate):
        """Create a callback function for voting buttons"""
        async def vote_callback(interaction):
            # Always defer response immediately to avoid timeout
            await interaction.response.defer(ephemeral=True)

            try:
                # Process the vote (public announcement happens in process_vote)
                await self.fractal_group.process_vote(interaction.user, candidate)

                # Confirm to the voter (private)
                await interaction.followup.send(
                    f"You voted for {candidate.display_name}",
                    ephemeral=True
                )

            except Exception as e:
                self.logger.error(f"Error processing vote: {e}", exc_info=True)
                await interaction.followup.send(
                    "❌ Error recording your vote. Please try again.",
                    ephemeral=True
                )

        return vote_callback


class MemberConfirmationView(discord.ui.View):
    """A view for confirming fractal group members"""
    def __init__(self, cog, members, facilitator, custom_name=None):
        super().__init__(timeout=60)
        self.cog = cog
        self.members = members
        self.facilitator = facilitator
        self.custom_name = custom_name
        self.awaiting_modification = False

    @discord.ui.button(label="✅ Start Fractal", style=discord.ButtonStyle.success)
    async def confirm_members(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Start the fractal with current members"""
        if interaction.user != self.facilitator:
            await interaction.response.send_message("Only the facilitator can start the fractal.", ephemeral=True)
            return

        await interaction.response.defer()

        # Use custom name or generate one
        if self.custom_name:
            group_name = self.custom_name
        else:
            group_name = self.cog._get_next_group_name(interaction.guild.id)

        # Get the parent channel (in case we're in a thread)
        channel = interaction.channel
        if isinstance(channel, discord.Thread):
            channel = channel.parent

        # Create public thread
        thread = await channel.create_thread(
            name=group_name,
            type=discord.ChannelType.public_thread,
            reason="ZAO Fractal Group"
        )

        # Add all members to thread
        for member in self.members:
            try:
                await thread.add_user(member)
            except discord.HTTPException:
                pass  # Member might already be in thread or have permissions issues

        # Create and start fractal group
        fractal_group = FractalGroup(
            thread=thread,
            members=self.members,
            facilitator=self.facilitator,
            cog=self.cog
        )

        # Store active group
        self.cog.active_groups[thread.id] = fractal_group

        # Update original message first to avoid timeout
        try:
            await interaction.edit_original_response(
                content=f"✅ **Fractal started!** Check {thread.mention}",
                view=None
            )
        except:
            pass  # Interaction might have timed out, but continue anyway

        # Start the fractal (this might take a moment)
        try:
            await fractal_group.start_fractal()
        except Exception as e:
            # If fractal start fails, send error to thread
            await thread.send(f"❌ Error starting fractal: {str(e)}")
            raise

    @discord.ui.button(label="❌ Modify Members", style=discord.ButtonStyle.secondary)
    async def modify_members(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Allow modification of member list"""
        if interaction.user != self.facilitator:
            await interaction.response.send_message("Only the facilitator can modify members.", ephemeral=True)
            return

        await interaction.response.send_message(
            "**To modify members:**\n"
            "• Remove people: `@username @username`\n"
            "• Add people: `@username @username`\n"
            "• Then click ✅ to start",
            ephemeral=True
        )
        self.awaiting_modification = True
