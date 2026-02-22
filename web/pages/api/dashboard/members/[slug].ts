import type { NextApiRequest, NextApiResponse } from 'next';
import {
  loadNamesToWallets,
  loadHistory,
  loadIntros,
  getMemberStats,
} from '../../../../utils/loadJsonData';
import { fetchOnchainBalances } from '../../../../utils/respectCache';
import type { MemberProfile } from '../../../../types/dashboard';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MemberProfile | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  try {
    // Load names-to-wallets and find the member whose slugified name matches
    const namesToWallets = loadNamesToWallets();
    const memberEntry = Object.entries(namesToWallets).find(
      ([name]) => slugify(name) === slug
    );

    if (!memberEntry) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const [memberName, wallet] = memberEntry;

    // Load fractal history and compute member stats
    const history = loadHistory();
    const stats = getMemberStats(history, memberName);

    // Fetch onchain balances for this member's wallet
    let ogRespect = 0;
    let zorRespect = 0;

    if (wallet && wallet.length > 0) {
      try {
        const balances = await fetchOnchainBalances([[memberName, wallet]]);
        const balance = balances.get(memberName);
        if (balance) {
          ogRespect = balance.ogRespect;
          zorRespect = balance.zorRespect;
        }
      } catch (err) {
        console.error('Failed to fetch onchain balances for member:', err);
        // Continue with zero balances
      }
    }

    // Load intros and check if this member has one
    // Intros are keyed by display_name (case-insensitive match)
    const intros = loadIntros();
    let hasIntro = false;
    let introText: string | null = null;

    // Try exact match first, then case-insensitive
    if (intros[memberName]) {
      hasIntro = true;
      introText = intros[memberName].text;
    } else {
      const introKey = Object.keys(intros).find(
        (key) => key.toLowerCase() === memberName.toLowerCase()
      );
      if (introKey) {
        hasIntro = true;
        introText = intros[introKey].text;
      }
    }

    const offchainRespect = stats.totalRespect;
    const totalRespect = ogRespect + zorRespect + offchainRespect;

    const profile: MemberProfile = {
      name: memberName,
      wallet: wallet && wallet.length > 0 ? wallet : null,
      hasIntro,
      introText,
      ogRespect,
      zorRespect,
      offchainRespect,
      totalRespect,
      fractalHistory: stats.fractalHistory,
      stats: {
        participations: stats.participations,
        firstPlace: stats.firstPlace,
        secondPlace: stats.secondPlace,
        thirdPlace: stats.thirdPlace,
        avgRespect: stats.avgRespect,
      },
      contributions: [], // Contributions are not yet tracked in JSON data
    };

    return res.status(200).json(profile);
  } catch (err) {
    console.error('Member profile API error:', err);
    return res.status(500).json({ error: 'Failed to load member profile' });
  }
}
