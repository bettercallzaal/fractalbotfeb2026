import { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.DELVE_BASE_URL || 'https://tnt-v2.api.bonfires.ai';
const API_KEY = process.env.DELVE_API_KEY!;
const AGENT_ID = process.env.JOURNAL_AGENT_ID || '698b70742849d936f4259849';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      `${BASE_URL}/knowledge_graph/agents/${AGENT_ID}/episodes/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 20,
        }),
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Journal episodes error:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
}
