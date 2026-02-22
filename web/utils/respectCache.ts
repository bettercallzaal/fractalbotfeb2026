import { ethers } from 'ethers';

const OG_RESPECT_ADDRESS = '0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957';
const ZOR_RESPECT_ADDRESS = '0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c';
const ZOR_TOKEN_ID = 0n;
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];
const ERC1155_BALANCE_ABI = ['function balanceOf(address, uint256) view returns (uint256)'];
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
];

export interface OnchainBalance {
  wallet: string;
  ogRespect: number;
  zorRespect: number;
  totalOnchain: number;
}

// In-memory cache
let balanceCache: { data: Map<string, OnchainBalance>; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch onchain OG + ZOR balances for a list of wallets using Multicall3.
 * Results are cached for 5 minutes.
 */
export async function fetchOnchainBalances(
  walletEntries: [string, string][] // [name, wallet]
): Promise<Map<string, OnchainBalance>> {
  // Check cache
  if (balanceCache && Date.now() - balanceCache.timestamp < CACHE_TTL_MS) {
    return balanceCache.data;
  }

  const rpcUrl = process.env.ALCHEMY_OPTIMISM_RPC;
  if (!rpcUrl) {
    console.error('ALCHEMY_OPTIMISM_RPC not configured');
    return new Map();
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const ogIface = new ethers.Interface(ERC20_BALANCE_ABI);
  const zorIface = new ethers.Interface(ERC1155_BALANCE_ABI);

  // Build multicall batch: 2 calls per member (OG + ZOR)
  const calls = walletEntries.flatMap(([, wallet]) => [
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

  // Batch in chunks of 200
  const CHUNK_SIZE = 200;
  const allResults: { success: boolean; returnData: string }[] = [];

  for (let i = 0; i < calls.length; i += CHUNK_SIZE) {
    const chunk = calls.slice(i, i + CHUNK_SIZE);
    const results = await multicall.aggregate3.staticCall(chunk);
    allResults.push(...results);
  }

  // Parse results
  const balances = new Map<string, OnchainBalance>();

  walletEntries.forEach(([name, wallet], idx) => {
    const ogResult = allResults[idx * 2];
    const zorResult = allResults[idx * 2 + 1];

    let ogBalance = 0n;
    let zorBalance = 0n;

    if (ogResult?.success && ogResult.returnData !== '0x') {
      try {
        [ogBalance] = ogIface.decodeFunctionResult('balanceOf', ogResult.returnData);
      } catch { /* default 0 */ }
    }
    if (zorResult?.success && zorResult.returnData !== '0x') {
      try {
        [zorBalance] = zorIface.decodeFunctionResult('balanceOf', zorResult.returnData);
      } catch { /* default 0 */ }
    }

    const og = Number(ethers.formatEther(ogBalance));
    const zor = Number(zorBalance);

    balances.set(name, {
      wallet,
      ogRespect: og,
      zorRespect: zor,
      totalOnchain: og + zor,
    });
  });

  // Cache
  balanceCache = { data: balances, timestamp: Date.now() };
  return balances;
}
