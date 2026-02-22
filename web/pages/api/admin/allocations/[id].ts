import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../utils/database';
import { respectAllocations } from '../../../../utils/schema';
import { requireAdmin } from '../../../../utils/admin';
import { authOptions } from '../../auth/[...nextauth]';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res, authOptions);
  if (!session) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing allocation id' });
  }

  const allocationId = parseInt(id, 10);
  if (isNaN(allocationId)) {
    return res.status(400).json({ error: 'Invalid allocation id' });
  }

  try {
    const { status } = req.body;

    const validStatuses = ['distributed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Check if allocation exists
    const existing = await db
      .select()
      .from(respectAllocations)
      .where(eq(respectAllocations.id, allocationId))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const updateData: Record<string, any> = { status };
    if (status === 'distributed') {
      updateData.distributedAt = new Date();
    }

    const [updated] = await db
      .update(respectAllocations)
      .set(updateData)
      .where(eq(respectAllocations.id, allocationId))
      .returning();

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating allocation:', error);
    return res.status(500).json({ error: 'Failed to update allocation' });
  }
}
