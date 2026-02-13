import aiohttp
import asyncio
import logging
import os
from typing import Dict, Any, Optional

class WebIntegration:
    """Integration with the Vercel web application"""

    def __init__(self):
        self.webhook_url = os.getenv('WEB_WEBHOOK_URL', 'https://your-app.vercel.app/api/webhook')
        self.webhook_secret = os.getenv('WEBHOOK_SECRET', 'your_webhook_secret')
        self.logger = logging.getLogger('bot')

    async def send_webhook(self, event_type: str, fractal_id: str, data: Dict[str, Any]) -> bool:
        """Send webhook to web application"""
        try:
            payload = {
                'fractalId': fractal_id,
                'event': event_type,
                'data': data
            }

            headers = {
                'Authorization': f'Bearer {self.webhook_secret}',
                'Content-Type': 'application/json'
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        self.logger.info(f"Webhook sent successfully: {event_type} for fractal {fractal_id}")
                        return True
                    else:
                        self.logger.error(f"Webhook failed: {response.status} - {await response.text()}")
                        return False

        except asyncio.TimeoutError:
            self.logger.error(f"Webhook timeout for {event_type}")
            return False
        except Exception as e:
            self.logger.error(f"Webhook error: {e}")
            return False

    async def notify_fractal_started(self, fractal_group) -> bool:
        """Notify web app that a fractal has started"""
        data = {
            'threadId': str(fractal_group.thread.id),
            'name': fractal_group.thread.name,
            'guildId': str(fractal_group.thread.guild.id),
            'facilitatorDiscordId': str(fractal_group.facilitator.id),
            'participantDiscordIds': [str(member.id) for member in fractal_group.members],
            'currentLevel': fractal_group.current_level
        }
        return await self.send_webhook('fractal_started', str(fractal_group.thread.id), data)

    async def notify_vote_cast(self, fractal_group, voter, candidate) -> bool:
        """Notify web app that a vote was cast"""
        data = {
            'voterId': str(voter.id),
            'candidateId': str(candidate.id),
            'level': fractal_group.current_level,
            'totalVotes': len(fractal_group.votes)
        }
        return await self.send_webhook('vote_cast', str(fractal_group.thread.id), data)

    async def notify_round_complete(self, fractal_group, winner) -> bool:
        """Notify web app that a round is complete"""
        data = {
            'level': fractal_group.current_level,
            'winnerId': str(winner.id),
            'totalVotes': len(fractal_group.votes),
            'voteDistribution': self._get_vote_distribution(fractal_group)
        }
        return await self.send_webhook('round_complete', str(fractal_group.thread.id), data)

    async def notify_fractal_complete(self, fractal_group) -> bool:
        """Notify web app that a fractal is complete"""
        # Build results array with final rankings
        results = []
        for level, winner in sorted(fractal_group.winners.items(), reverse=True):
            rank = 7 - level  # Convert level to rank (6->1st, 5->2nd, etc.)
            results.append({
                'discordId': str(winner.id),
                'rank': rank,
                'level': level
            })

        data = {
            'results': results,
            'totalRounds': len(fractal_group.winners)
        }
        return await self.send_webhook('fractal_complete', str(fractal_group.thread.id), data)

    async def notify_fractal_paused(self, fractal_group) -> bool:
        """Notify web app that a fractal was paused"""
        data = {
            'currentLevel': fractal_group.current_level,
            'pausedAt': fractal_group.current_level
        }
        return await self.send_webhook('fractal_paused', str(fractal_group.thread.id), data)

    async def notify_fractal_resumed(self, fractal_group) -> bool:
        """Notify web app that a fractal was resumed"""
        data = {
            'currentLevel': fractal_group.current_level,
            'resumedAt': fractal_group.current_level
        }
        return await self.send_webhook('fractal_resumed', str(fractal_group.thread.id), data)

    def _get_vote_distribution(self, fractal_group) -> Dict[str, int]:
        """Get vote distribution for current round"""
        vote_counts = {}
        for candidate_id in fractal_group.votes.values():
            candidate = next((c for c in fractal_group.active_candidates if c.id == candidate_id), None)
            if candidate:
                key = str(candidate.id)
                vote_counts[key] = vote_counts.get(key, 0) + 1
        return vote_counts

# Global instance
web_integration = WebIntegration()
