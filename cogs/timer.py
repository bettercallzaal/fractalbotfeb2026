import discord
from discord import app_commands
from discord.ext import commands, tasks
import logging
import asyncio
import time
from cogs.base import BaseCog


class PresentationTimer:
    """Manages a speaking queue with countdown timer for a channel"""

    def __init__(self, channel: discord.abc.Messageable, speakers: list[discord.Member],
                 minutes: int, facilitator: discord.Member):
        self.channel = channel
        self.speakers = speakers
        self.minutes = minutes
        self.facilitator = facilitator
        self.current_index = 0
        self.paused = False
        self.stopped = False
        self.message: discord.Message | None = None
        self.end_timestamp: int = 0
        self.logger = logging.getLogger('bot')

    @property
    def current_speaker(self) -> discord.Member | None:
        if 0 <= self.current_index < len(self.speakers):
            return self.speakers[self.current_index]
        return None

    @property
    def is_done(self) -> bool:
        return self.current_index >= len(self.speakers) or self.stopped

    def _build_embed(self, status: str = "speaking") -> discord.Embed:
        speaker = self.current_speaker

        if status == "done":
            embed = discord.Embed(
                title="Presentations Complete",
                description="All members have presented. Ready to start voting!",
                color=0x57F287
            )
            # Show who presented
            lines = []
            for i, s in enumerate(self.speakers):
                lines.append(f"\u2705 {s.mention}")
            embed.add_field(name="Speakers", value="\n".join(lines), inline=False)
            embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
            return embed

        if status == "paused":
            embed = discord.Embed(
                title=f"Presentations Paused",
                description=f"Timer paused during {speaker.mention}'s turn.",
                color=0xFEE75C  # Yellow
            )
        else:
            embed = discord.Embed(
                title=f"Now Presenting: {speaker.display_name}",
                description=f"{speaker.mention} has the floor.",
                color=0x5865F2  # Blue
            )
            # Use Discord's relative timestamp for live countdown
            embed.add_field(
                name="Time Remaining",
                value=f"Ends <t:{self.end_timestamp}:R>",
                inline=True
            )

        embed.add_field(
            name="Speaker",
            value=f"{self.current_index + 1} of {len(self.speakers)}",
            inline=True
        )
        embed.add_field(
            name="Duration",
            value=f"{self.minutes} min each",
            inline=True
        )

        # Queue
        queue_lines = []
        for i, s in enumerate(self.speakers):
            if i < self.current_index:
                queue_lines.append(f"\u2705 ~~{s.display_name}~~")
            elif i == self.current_index:
                queue_lines.append(f"\U0001f4ac **{s.display_name}** \u2190 now")
            else:
                queue_lines.append(f"\u23f3 {s.display_name}")
        embed.add_field(name="Queue", value="\n".join(queue_lines), inline=False)

        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
        return embed

    async def start(self):
        """Start the presentation timer from the first speaker"""
        self.end_timestamp = int(time.time()) + (self.minutes * 60)
        embed = self._build_embed("speaking")
        view = TimerControlView(self)
        self.message = await self.channel.send(
            content=f"\U0001f399\ufe0f {self.current_speaker.mention}, you're up! You have **{self.minutes} minutes**.",
            embed=embed,
            view=view
        )
        # Start the countdown task
        asyncio.create_task(self._countdown())

    async def _countdown(self):
        """Wait for the timer to expire, then advance"""
        while not self.is_done:
            remaining = self.end_timestamp - int(time.time())

            if self.paused:
                await asyncio.sleep(1)
                continue

            if remaining <= 0:
                await self.advance()
                return

            # Sleep in short intervals to check for pause/stop
            await asyncio.sleep(min(remaining, 5))

    async def advance(self):
        """Move to the next speaker"""
        if self.is_done:
            return

        self.current_index += 1

        if self.current_index >= len(self.speakers):
            # All done
            embed = self._build_embed("done")
            view = discord.ui.View()  # Empty view to clear buttons
            if self.message:
                try:
                    await self.message.edit(embed=embed, view=view, content=None)
                except discord.NotFound:
                    pass
            await self.channel.send("\u2705 **All presentations complete!** Ready to begin voting.")
            self.stopped = True
            return

        # Start next speaker's timer
        self.end_timestamp = int(time.time()) + (self.minutes * 60)
        self.paused = False
        embed = self._build_embed("speaking")
        view = TimerControlView(self)

        if self.message:
            try:
                await self.message.edit(embed=embed, view=view,
                    content=f"\U0001f399\ufe0f {self.current_speaker.mention}, you're up! You have **{self.minutes} minutes**.")
            except discord.NotFound:
                self.message = await self.channel.send(
                    content=f"\U0001f399\ufe0f {self.current_speaker.mention}, you're up! You have **{self.minutes} minutes**.",
                    embed=embed, view=view
                )

        # Also ping in channel so they get a notification
        ping = await self.channel.send(f"\U0001f399\ufe0f {self.current_speaker.mention}, your turn to present!")
        await asyncio.sleep(3)
        try:
            await ping.delete()
        except discord.NotFound:
            pass

        asyncio.create_task(self._countdown())

    async def pause(self):
        """Pause the timer"""
        if self.paused or self.is_done:
            return
        self.paused = True
        # Store remaining time
        self._remaining_when_paused = max(0, self.end_timestamp - int(time.time()))
        embed = self._build_embed("paused")
        view = TimerControlView(self)
        if self.message:
            try:
                await self.message.edit(embed=embed, view=view, content=None)
            except discord.NotFound:
                pass

    async def resume(self):
        """Resume the timer"""
        if not self.paused or self.is_done:
            return
        self.paused = False
        self.end_timestamp = int(time.time()) + self._remaining_when_paused
        embed = self._build_embed("speaking")
        view = TimerControlView(self)
        if self.message:
            try:
                await self.message.edit(embed=embed, view=view,
                    content=f"\U0001f399\ufe0f {self.current_speaker.mention} has the floor.")
            except discord.NotFound:
                pass
        asyncio.create_task(self._countdown())

    async def skip(self):
        """Skip to next speaker"""
        await self.advance()

    async def stop(self):
        """Stop the timer entirely"""
        self.stopped = True
        embed = discord.Embed(
            title="Presentations Stopped",
            description=f"Timer stopped by facilitator. {self.current_index} of {len(self.speakers)} speakers presented.",
            color=0xED4245
        )
        embed.set_footer(text="ZAO Fractal \u2022 zao.frapps.xyz")
        if self.message:
            try:
                await self.message.edit(embed=embed, view=None, content=None)
            except discord.NotFound:
                pass


class TimerControlView(discord.ui.View):
    """Buttons for controlling the presentation timer"""

    def __init__(self, timer: PresentationTimer):
        super().__init__(timeout=None)
        self.timer = timer

        # Swap pause/resume based on state
        if timer.paused:
            self.remove_item(self.pause_btn)
        else:
            self.remove_item(self.resume_btn)

    @discord.ui.button(label="Skip", style=discord.ButtonStyle.primary, emoji="\u23ed\ufe0f")
    async def skip_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.timer.facilitator:
            await interaction.response.send_message("Only the facilitator can control the timer.", ephemeral=True)
            return
        await interaction.response.defer()
        await self.timer.skip()

    @discord.ui.button(label="Pause", style=discord.ButtonStyle.secondary, emoji="\u23f8\ufe0f")
    async def pause_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.timer.facilitator:
            await interaction.response.send_message("Only the facilitator can control the timer.", ephemeral=True)
            return
        await interaction.response.defer()
        await self.timer.pause()

    @discord.ui.button(label="Resume", style=discord.ButtonStyle.success, emoji="\u25b6\ufe0f")
    async def resume_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.timer.facilitator:
            await interaction.response.send_message("Only the facilitator can control the timer.", ephemeral=True)
            return
        await interaction.response.defer()
        await self.timer.resume()

    @discord.ui.button(label="Stop", style=discord.ButtonStyle.danger, emoji="\u23f9\ufe0f")
    async def stop_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user != self.timer.facilitator:
            await interaction.response.send_message("Only the facilitator can control the timer.", ephemeral=True)
            return
        await interaction.response.defer()
        await self.timer.stop()


class TimerCog(BaseCog):
    """Cog for managing presentation timers before fractal voting"""

    def __init__(self, bot):
        super().__init__(bot)
        self.active_timers = {}  # channel_id -> PresentationTimer

    @app_commands.command(
        name="timer",
        description="Start a presentation timer for everyone in your voice channel"
    )
    @app_commands.describe(
        minutes="Minutes per speaker (default: 3)",
        shuffle="Randomize speaker order (default: no)"
    )
    async def timer(self, interaction: discord.Interaction, minutes: int = 3,
                    shuffle: bool = False):
        """Start a presentation timer"""
        await interaction.response.defer()

        # Check voice state
        voice_check = await self.check_voice_state(interaction.user)
        if not voice_check['success']:
            await interaction.followup.send(voice_check['message'], ephemeral=True)
            return

        channel = interaction.channel
        if channel.id in self.active_timers and not self.active_timers[channel.id].is_done:
            await interaction.followup.send(
                "A timer is already running in this channel. Stop it first with the Stop button.",
                ephemeral=True
            )
            return

        if minutes < 1 or minutes > 30:
            await interaction.followup.send("Timer must be between 1 and 30 minutes.", ephemeral=True)
            return

        members = voice_check['members']

        if shuffle:
            import random
            random.shuffle(members)

        timer = PresentationTimer(
            channel=channel,
            speakers=members,
            minutes=minutes,
            facilitator=interaction.user
        )
        self.active_timers[channel.id] = timer

        # Announce
        speaker_list = "\n".join(f"**{i+1}.** {s.mention}" for i, s in enumerate(members))
        await interaction.followup.send(
            f"\U0001f399\ufe0f **Presentation Timer Started!**\n\n"
            f"**{minutes} min** per speaker | **{len(members)} speakers** | "
            f"{'Shuffled' if shuffle else 'Voice channel order'}\n\n"
            f"{speaker_list}"
        )

        await timer.start()

    @app_commands.command(
        name="timer_add",
        description="Add extra time to the current speaker"
    )
    @app_commands.describe(minutes="Extra minutes to add (default: 1)")
    async def timer_add(self, interaction: discord.Interaction, minutes: int = 1):
        """Add time to the current speaker"""
        await interaction.response.defer(ephemeral=True)

        channel = interaction.channel
        timer = self.active_timers.get(channel.id)

        if not timer or timer.is_done:
            await interaction.followup.send("No active timer in this channel.", ephemeral=True)
            return

        if interaction.user != timer.facilitator and not self.is_supreme_admin(interaction.user):
            await interaction.followup.send("Only the facilitator can add time.", ephemeral=True)
            return

        timer.end_timestamp += minutes * 60
        embed = timer._build_embed("speaking")
        view = TimerControlView(timer)
        if timer.message:
            try:
                await timer.message.edit(embed=embed, view=view)
            except discord.NotFound:
                pass

        await interaction.followup.send(
            f"Added **{minutes} min** to {timer.current_speaker.display_name}'s turn.",
            ephemeral=True
        )


async def setup(bot):
    await bot.add_cog(TimerCog(bot))
