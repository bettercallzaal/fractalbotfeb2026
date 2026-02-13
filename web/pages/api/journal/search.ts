import { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.DELVE_BASE_URL || 'https://tnt-v2.api.bonfires.ai';
const API_KEY = process.env.DELVE_API_KEY!;
const BONFIRE_ID = process.env.BONFIRE_ID || '698b70002849d936f4259848';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, numResults } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await fetch(`${BASE_URL}/delve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        bonfire_id: BONFIRE_ID,
        num_results: numResults || 10,
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Journal search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
}
