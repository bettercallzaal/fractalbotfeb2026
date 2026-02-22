import type { NextApiRequest, NextApiResponse } from 'next';
import { loadHistory, loadProposals } from '../../../utils/loadJsonData';
import type { ActivityItem } from '../../../types/dashboard';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActivityItem[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string) || 20, 1),
      100
    );

    const history = loadHistory();
    const proposalsData = loadProposals();

    const items: ActivityItem[] = [];

    // Add fractal entries
    for (const fractal of history.fractals) {
      const winner = fractal.rankings[0];
      const winnerName = winner?.display_name ?? 'Unknown';
      const winnerRespect = winner?.respect ?? 0;

      items.push({
        type: 'fractal',
        title: fractal.group_name,
        description: `${winnerName} earned ${winnerRespect} Respect`,
        timestamp: fractal.completed_at,
      });
    }

    // Add proposal entries
    const proposals = proposalsData.proposals || {};
    for (const proposal of Object.values(proposals) as any[]) {
      const voteCount = proposal.votes
        ? Object.keys(proposal.votes).length
        : 0;

      items.push({
        type: 'proposal',
        title: proposal.title || 'Untitled Proposal',
        description: `${proposal.type || 'proposal'} - ${voteCount} vote${voteCount !== 1 ? 's' : ''}`,
        timestamp: proposal.created_at || proposal.timestamp || '',
      });
    }

    // Sort by timestamp descending
    items.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    // Apply limit
    res.status(200).json(items.slice(0, limit));
  } catch (err) {
    console.error('Dashboard activity error:', err);
    res.status(500).json({ error: 'Failed to load activity feed' });
  }
}
