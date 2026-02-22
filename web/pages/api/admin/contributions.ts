import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../utils/database';
import { contributions } from '../../../utils/schema';
import { requireAdmin } from '../../../utils/admin';
import { authOptions } from '../auth/[...nextauth]';
import { desc, eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res, authOptions);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { memberName } = req.query;

      let query = db
        .select()
        .from(contributions)
        .orderBy(desc(contributions.createdAt));

      if (memberName && typeof memberName === 'string') {
        query = query.where(eq(contributions.memberName, memberName)) as typeof query;
      }

      const rows = await query;
      return res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching contributions:', error);
      return res.status(500).json({ error: 'Failed to fetch contributions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { memberName, type, description, respectAmount } = req.body;

      if (!memberName || !type || !description || respectAmount == null) {
        return res.status(400).json({ error: 'Missing required fields: memberName, type, description, respectAmount' });
      }

      const validTypes = ['intro', 'attendance', 'special', 'fractal_hosting'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }

      if (typeof respectAmount !== 'number' || respectAmount <= 0) {
        return res.status(400).json({ error: 'respectAmount must be a positive number' });
      }

      const [row] = await db.insert(contributions).values({
        memberName,
        type,
        description,
        respectAmount,
        loggedBy: session.user.discordId || 'unknown',
      }).returning();

      return res.status(201).json(row);
    } catch (error) {
      console.error('Error creating contribution:', error);
      return res.status(500).json({ error: 'Failed to create contribution' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
