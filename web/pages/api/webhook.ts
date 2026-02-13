import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../utils/database';
import { fractals, votingRounds, votes, users } from '../../utils/schema';
import { eq, and } from 'drizzle-orm';

// Webhook endpoint for Discord bot to send updates
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth - you might want to add a secret token
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { fractalId, event, data } = req.body;

    switch (event) {
      case 'fractal_started':
        await handleFractalStarted(fractalId, data);
        break;

      case 'vote_cast':
        await handleVoteCast(fractalId, data);
        break;

      case 'round_complete':
        await handleRoundComplete(fractalId, data);
        break;

      case 'fractal_complete':
        await handleFractalComplete(fractalId, data);
        break;

      case 'fractal_paused':
        await handleFractalPaused(fractalId, data);
        break;

      case 'fractal_resumed':
        await handleFractalResumed(fractalId, data);
        break;

      default:
        console.log(`Unknown event type: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleFractalStarted(threadId: string, data: any) {
  // Update fractal status
  await db
    .update(fractals)
    .set({
      status: 'active',
      currentLevel: data.currentLevel || 6,
    })
    .where(eq(fractals.threadId, threadId));
}

async function handleVoteCast(threadId: string, data: any) {
  const { voterId, candidateId, level } = data;

  // Find the fractal and current round
  const fractal = await db
    .select()
    .from(fractals)
    .where(eq(fractals.threadId, threadId))
    .limit(1);

  if (fractal.length === 0) return;

  // Find or create voting round
  let round = await db
    .select()
    .from(votingRounds)
    .where(and(
      eq(votingRounds.fractalId, fractal[0].id),
      eq(votingRounds.level, level)
    ))
    .limit(1);

  if (round.length === 0) {
    const newRound = await db
      .insert(votingRounds)
      .values({
        fractalId: fractal[0].id,
        level: level,
      })
      .returning();
    round = newRound;
  }

  // Find users
  const voter = await db.select().from(users).where(eq(users.discordId, voterId)).limit(1);
  const candidate = await db.select().from(users).where(eq(users.discordId, candidateId)).limit(1);

  if (voter.length > 0 && candidate.length > 0) {
    // Insert or update vote
    await db.insert(votes).values({
      roundId: round[0].id,
      voterId: voter[0].id,
      candidateId: candidate[0].id,
    });
  }
}

async function handleRoundComplete(threadId: string, data: any) {
  const { level, winnerId, totalVotes } = data;

  const fractal = await db
    .select()
    .from(fractals)
    .where(eq(fractals.threadId, threadId))
    .limit(1);

  if (fractal.length === 0) return;

  const winner = await db.select().from(users).where(eq(users.discordId, winnerId)).limit(1);

  if (winner.length > 0) {
    // Update voting round with winner
    await db
      .update(votingRounds)
      .set({
        winnerId: winner[0].id,
        totalVotes: totalVotes,
        completedAt: new Date(),
      })
      .where(and(
        eq(votingRounds.fractalId, fractal[0].id),
        eq(votingRounds.level, level)
      ));

    // Update fractal current level
    await db
      .update(fractals)
      .set({ currentLevel: level - 1 })
      .where(eq(fractals.id, fractal[0].id));
  }
}

async function handleFractalComplete(threadId: string, data: any) {
  const { results } = data; // Array of { discordId, rank }

  const fractal = await db
    .select()
    .from(fractals)
    .where(eq(fractals.threadId, threadId))
    .limit(1);

  if (fractal.length === 0) return;

  // Update fractal status
  await db
    .update(fractals)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(fractals.id, fractal[0].id));

  // Update user statistics
  for (const result of results) {
    const user = await db.select().from(users).where(eq(users.discordId, result.discordId)).limit(1);

    if (user.length > 0) {
      const isWinner = result.rank === 1;
      await db
        .update(users)
        .set({
          totalFractals: (user[0].totalFractals ?? 0) + 1,
          totalWins: isWinner ? (user[0].totalWins ?? 0) + 1 : (user[0].totalWins ?? 0),
        })
        .where(eq(users.id, user[0].id));
    }
  }
}

async function handleFractalPaused(threadId: string, data: any) {
  await db
    .update(fractals)
    .set({ isPaused: true })
    .where(eq(fractals.threadId, threadId));
}

async function handleFractalResumed(threadId: string, data: any) {
  await db
    .update(fractals)
    .set({ isPaused: false })
    .where(eq(fractals.threadId, threadId));
}
