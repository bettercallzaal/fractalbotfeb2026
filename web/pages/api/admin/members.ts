import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../utils/admin';
import { authOptions } from '../auth/[...nextauth]';
import { loadNamesToWallets, loadIntros } from '../../../utils/loadJsonData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res, authOptions);
  if (!session) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const namesToWallets = loadNamesToWallets();
    const intros = loadIntros();

    // intros.json is keyed by display name (case-insensitive match)
    const introKeys = new Set(
      Object.keys(intros).map((k) => k.toLowerCase())
    );

    const members = Object.entries(namesToWallets).map(([name, wallet]) => ({
      name,
      wallet,
      hasIntro: introKeys.has(name.toLowerCase()),
    }));

    // Sort alphabetically by name
    members.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
}
