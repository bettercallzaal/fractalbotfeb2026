import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../utils/database';
import { respectAllocations } from '../../../../utils/schema';
import { requireAdmin } from '../../../../utils/admin';
import { authOptions } from '../../auth/[...nextauth]';
import { desc, eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res, authOptions);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { status } = req.query;

      let query = db
        .select()
        .from(respectAllocations)
        .orderBy(desc(respectAllocations.createdAt));

      if (status && typeof status === 'string') {
        query = query.where(eq(respectAllocations.status, status)) as typeof query;
      }

      const rows = await query;
      return res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching allocations:', error);
      return res.status(500).json({ error: 'Failed to fetch allocations' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { memberName, walletAddress, amount, reason, contributionId } = req.body;

      if (!memberName || !walletAddress || amount == null) {
        return res.status(400).json({ error: 'Missing required fields: memberName, walletAddress, amount' });
      }

      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }

      const [row] = await db.insert(respectAllocations).values({
        memberName,
        walletAddress,
        amount,
        reason: reason || null,
        contributionId: contributionId || null,
        loggedBy: session.user.discordId || 'unknown',
      }).returning();

      return res.status(201).json(row);
    } catch (error) {
      console.error('Error creating allocation:', error);
      return res.status(500).json({ error: 'Failed to create allocation' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
