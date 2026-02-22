import fs from 'fs';
import path from 'path';
import type { FractalEntry } from '../types/dashboard';

function resolveDataFile(filename: string): string | null {
  const paths = [
    path.join(process.cwd(), '..', 'data', filename),
    path.join(process.cwd(), 'data', filename),
    path.join(__dirname, '..', '..', '..', '..', 'data', filename),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // Try next path
    }
  }
  return null;
}

function loadJsonFile<T>(filename: string, fallback: T): T {
  const filePath = resolveDataFile(filename);
  if (!filePath) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

export function loadNamesToWallets(): Record<string, string> {
  return loadJsonFile('names_to_wallets.json', {});
}

export function loadWallets(): Record<string, string> {
  return loadJsonFile('wallets.json', {});
}

export function loadHistory(): { fractals: FractalEntry[] } {
  return loadJsonFile('history.json', { fractals: [] });
}

export function loadIntros(): Record<string, { text: string; message_id: number; timestamp: string }> {
  return loadJsonFile('intros.json', {});
}

export function loadProposals(): { next_id: number; proposals: Record<string, any> } {
  return loadJsonFile('proposals.json', { next_id: 1, proposals: {} });
}

/** Compute offchain Respect leaderboard from fractal history */
export function computeOffchainLeaderboard(history: { fractals: FractalEntry[] }): Record<string, { respect: number; participations: number }> {
  const totals: Record<string, { respect: number; participations: number }> = {};
  for (const fractal of history.fractals) {
    for (const r of fractal.rankings) {
      const name = r.display_name;
      if (!totals[name]) {
        totals[name] = { respect: 0, participations: 0 };
      }
      totals[name].respect += r.respect || 0;
      totals[name].participations += 1;
    }
  }
  return totals;
}

/** Get member stats from fractal history */
export function getMemberStats(history: { fractals: FractalEntry[] }, memberName: string) {
  let totalRespect = 0;
  let participations = 0;
  let firstPlace = 0;
  let secondPlace = 0;
  let thirdPlace = 0;
  const fractalHistory: Array<{
    fractalId: number;
    groupName: string;
    date: string;
    rank: number;
    level: number;
    respect: number;
  }> = [];

  for (const fractal of history.fractals) {
    for (let i = 0; i < fractal.rankings.length; i++) {
      const r = fractal.rankings[i];
      if (r.display_name.toLowerCase() === memberName.toLowerCase()) {
        const rank = i + 1;
        totalRespect += r.respect || 0;
        participations += 1;
        if (rank === 1) firstPlace++;
        if (rank === 2) secondPlace++;
        if (rank === 3) thirdPlace++;
        fractalHistory.push({
          fractalId: fractal.id,
          groupName: fractal.group_name,
          date: fractal.completed_at.slice(0, 10),
          rank,
          level: r.level,
          respect: r.respect || 0,
        });
        break;
      }
    }
  }

  return {
    totalRespect,
    participations,
    firstPlace,
    secondPlace,
    thirdPlace,
    avgRespect: participations > 0 ? Math.round(totalRespect / participations) : 0,
    fractalHistory,
  };
}
