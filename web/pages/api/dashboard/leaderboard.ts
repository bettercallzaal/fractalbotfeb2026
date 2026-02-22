import type { NextApiRequest, NextApiResponse } from 'next';
import { loadNamesToWallets, loadHistory, computeOffchainLeaderboard } from '../../../utils/loadJsonData';
import { fetchOnchainBalances } from '../../../utils/respectCache';
import type { CombinedLeaderboardEntry } from '../../../types/dashboard';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CombinedLeaderboardEntry[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const namesToWallets = loadNamesToWallets();
    const history = loadHistory();

    // Filter to entries with valid wallets
    const entries: [string, string][] = Object.entries(namesToWallets).filter(
      ([, wallet]) => wallet && wallet.length > 0
    );

    // Compute offchain leaderboard from fractal history
    const offchainData = computeOffchainLeaderboard(history);

    // Fetch onchain balances via Multicall3
    const onchainBalances = await fetchOnchainBalances(entries);

    // Merge all data sources
    const combined: CombinedLeaderboardEntry[] = entries.map(([name, wallet]) => {
      const onchain = onchainBalances.get(name);
      const offchain = offchainData[name];

      const ogRespect = onchain?.ogRespect ?? 0;
      const zorRespect = onchain?.zorRespect ?? 0;
      const offchainRespect = offchain?.respect ?? 0;
      const totalRespect = ogRespect + zorRespect + offchainRespect;
      const participations = offchain?.participations ?? 0;

      return {
        rank: 0,
        name,
        wallet,
        ogRespect,
        zorRespect,
        offchainRespect,
        totalRespect,
        participations,
      };
    });

    // Sort by totalRespect descending
    combined.sort((a, b) => b.totalRespect - a.totalRespect);

    // Assign ranks
    combined.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    res.status(200).json(combined);
  } catch (err) {
    console.error('Dashboard leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load combined leaderboard' });
  }
}
