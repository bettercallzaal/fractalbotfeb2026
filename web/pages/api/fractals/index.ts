import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { db } from '../../../utils/database';
import { fractals, users, fractalParticipants } from '../../../utils/schema';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {});

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // Get all fractals with participant counts
      const allFractals = await db
        .select({
          id: fractals.id,
          threadId: fractals.threadId,
          name: fractals.name,
          guildId: fractals.guildId,
          status: fractals.status,
          participantCount: fractals.participantCount,
          currentLevel: fractals.currentLevel,
          isPaused: fractals.isPaused,
          createdAt: fractals.createdAt,
          completedAt: fractals.completedAt,
          facilitator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(fractals)
        .leftJoin(users, eq(fractals.facilitatorId, users.id))
        .orderBy(desc(fractals.createdAt))
        .limit(50);

      res.status(200).json(allFractals);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Internal server error', details: (error as Error).message });
    }
  } else if (req.method === 'POST') {
    try {
      const { threadId, name, guildId, facilitatorDiscordId, participantDiscordIds } = req.body;

      // Find facilitator in database
      const facilitatorData = await db
        .select()
        .from(users)
        .where(eq(users.discordId, facilitatorDiscordId))
        .limit(1);

      if (facilitatorData.length === 0) {
        return res.status(400).json({ error: 'Facilitator not found' });
      }

      // Create fractal
      const newFractal = await db
        .insert(fractals)
        .values({
          threadId: threadId.toString(),
          name,
          guildId: guildId.toString(),
          facilitatorId: facilitatorData[0].id,
          participantCount: participantDiscordIds.length,
        })
        .returning();

      // Add participants
      if (participantDiscordIds && participantDiscordIds.length > 0) {
        for (const discordId of participantDiscordIds) {
          const userData = await db
            .select()
            .from(users)
            .where(eq(users.discordId, discordId))
            .limit(1);

          if (userData.length > 0) {
            await db.insert(fractalParticipants).values({
              fractalId: newFractal[0].id,
              userId: userData[0].id,
            });
          }
        }
      }

      res.status(201).json(newFractal[0]);
    } catch (error) {
      console.error('Error creating fractal:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
