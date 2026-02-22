import type { NextApiRequest, NextApiResponse } from 'next';
import { loadNamesToWallets, loadHistory, loadProposals, computeOffchainLeaderboard } from '../../../utils/loadJsonData';
import { fetchOnchainBalances } from '../../../utils/respectCache';
import type { DashboardStats } from '../../../types/dashboard';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardStats | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const namesToWallets = loadNamesToWallets();
    const history = loadHistory();
    const proposalsData = loadProposals();

    // Total members
    const totalMembers = Object.keys(namesToWallets).length;

    // Total fractals
    const totalFractals = history.fractals.length;

    // Offchain totals
    const offchainData = computeOffchainLeaderboard(history);
    const totalOffchainRespect = Object.values(offchainData).reduce(
      (sum, entry) => sum + entry.respect,
      0
    );

    // Onchain totals
    const entries: [string, string][] = Object.entries(namesToWallets).filter(
      ([, wallet]) => wallet && wallet.length > 0
    );
    const onchainBalances = await fetchOnchainBalances(entries);

    let totalOGRespect = 0;
    let totalZORRespect = 0;
    for (const balance of onchainBalances.values()) {
      totalOGRespect += balance.ogRespect;
      totalZORRespect += balance.zorRespect;
    }

    // Active proposals
    const proposals = proposalsData.proposals || {};
    const activeProposals = Object.values(proposals).filter(
      (p: any) => p.status !== 'closed'
    ).length;

    const stats: DashboardStats = {
      totalMembers,
      totalOGRespect,
      totalZORRespect,
      totalOffchainRespect,
      totalFractals,
      activeProposals,
    };

    res.status(200).json(stats);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
}
