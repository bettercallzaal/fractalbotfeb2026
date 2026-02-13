import { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.DELVE_BASE_URL || 'https://tnt-v2.api.bonfires.ai';
const API_KEY = process.env.DELVE_API_KEY!;
const AGENT_ID = process.env.JOURNAL_AGENT_ID || '698b70742849d936f4259849';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { entry, userId } = req.body;

    if (!entry) {
      return res.status(400).json({ error: 'Entry text is required' });
    }

    const timestamp = new Date().toISOString();
    const taggedEntry = `[Builder Journal - ${timestamp}] ${entry}`;

    const response = await fetch(`${BASE_URL}/agents/${AGENT_ID}/stack/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          text: taggedEntry,
          userId: userId || 'bettercallzaal',
          chatId: 'journal-web',
          timestamp,
        },
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Journal log error:', error);
    res.status(500).json({ error: 'Failed to log entry' });
  }
}
