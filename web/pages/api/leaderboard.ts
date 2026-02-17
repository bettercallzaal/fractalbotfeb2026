import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Contracts on Optimism
const OG_RESPECT_ADDRESS = '0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957';
const ZOR_RESPECT_ADDRESS = '0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c';
const ZOR_TOKEN_ID = 0n;
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

// ABIs (minimal)
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];
const ERC1155_BALANCE_ABI = ['function balanceOf(address, uint256) view returns (uint256)'];
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
];

// In-memory cache
let cachedData: { result: LeaderboardEntry[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface LeaderboardEntry {
  rank: number;
  name: string;
  wallet: string;
  ogRespect: string;
  zorRespect: string;
  totalRespect: string;
}

function loadMemberWallets(): Record<string, string> {
  // Try relative path from web/ (Vercel build includes it via includeFiles)
  const paths = [
    path.join(process.cwd(), '..', 'data', 'names_to_wallets.json'),
    path.join(process.cwd(), 'data', 'names_to_wallets.json'),
    path.join(__dirname, '..', '..', '..', '..', 'data', 'names_to_wallets.json'),
  ];

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {
      // Try next path
    }
  }

  return {};
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    return res.status(200).json(cachedData.result);
  }

  const rpcUrl = process.env.ALCHEMY_OPTIMISM_RPC;
  if (!rpcUrl) {
    return res.status(500).json({ error: 'ALCHEMY_OPTIMISM_RPC not configured' });
  }

  const membersMap = loadMemberWallets();
  const entries = Object.entries(membersMap).filter(([, wallet]) => wallet);

  if (entries.length === 0) {
    return res.status(200).json([]);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

    const ogIface = new ethers.Interface(ERC20_BALANCE_ABI);
    const zorIface = new ethers.Interface(ERC1155_BALANCE_ABI);

    // Build multicall batch: 2 calls per member (OG + ZOR)
    const calls = entries.flatMap(([, wallet]) => [
      {
        target: OG_RESPECT_ADDRESS,
        allowFailure: true,
        callData: ogIface.encodeFunctionData('balanceOf', [wallet]),
      },
      {
        target: ZOR_RESPECT_ADDRESS,
        allowFailure: true,
        callData: zorIface.encodeFunctionData('balanceOf', [wallet, ZOR_TOKEN_ID]),
      },
    ]);

    // Batch in chunks of 200 calls to avoid gas limits
    const CHUNK_SIZE = 200;
    const allResults: { success: boolean; returnData: string }[] = [];

    for (let i = 0; i < calls.length; i += CHUNK_SIZE) {
      const chunk = calls.slice(i, i + CHUNK_SIZE);
      const results = await multicall.aggregate3.staticCall(chunk);
      allResults.push(...results);
    }

    // Parse results
    const leaderboard: LeaderboardEntry[] = entries.map(([name, wallet], idx) => {
      const ogResult = allResults[idx * 2];
      const zorResult = allResults[idx * 2 + 1];

      let ogBalance = 0n;
      let zorBalance = 0n;

      if (ogResult.success && ogResult.returnData !== '0x') {
        try {
          [ogBalance] = ogIface.decodeFunctionResult('balanceOf', ogResult.returnData);
        } catch { /* default 0 */ }
      }
      if (zorResult.success && zorResult.returnData !== '0x') {
        try {
          [zorBalance] = zorIface.decodeFunctionResult('balanceOf', zorResult.returnData);
        } catch { /* default 0 */ }
      }

      // OG Respect is ERC-20 with 18 decimals
      const ogFormatted = ethers.formatEther(ogBalance);
      // ZOR Respect is ERC-1155, raw integer (no decimals)
      const zorFormatted = zorBalance.toString();
      // Total: use OG as whole number + ZOR
      const ogWhole = Number(ethers.formatEther(ogBalance));
      const zorWhole = Number(zorBalance);
      const total = ogWhole + zorWhole;

      return {
        rank: 0,
        name,
        wallet,
        ogRespect: ogFormatted,
        zorRespect: zorFormatted,
        totalRespect: total.toFixed(2),
      };
    });

    // Sort by total descending and assign ranks
    leaderboard.sort((a, b) => parseFloat(b.totalRespect) - parseFloat(a.totalRespect));
    leaderboard.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    // Cache results
    cachedData = { result: leaderboard, timestamp: Date.now() };

    return res.status(200).json(leaderboard);
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch onchain data' });
  }
}
