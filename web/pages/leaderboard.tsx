import Head from 'next/head';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface LeaderboardEntry {
  rank: number;
  name: string;
  wallet: string;
  ogRespect: string;
  zorRespect: string;
  totalRespect: string;
}

type SortKey = 'rank' | 'name' | 'ogRespect' | 'zorRespect' | 'totalRespect';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getMedal(rank: number): string {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return '';
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load leaderboard');
        return res.json();
      })
      .then((entries: LeaderboardEntry[]) => {
        setData(entries);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank' || key === 'name');
    }
  };

  const filtered = data.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'rank') {
      cmp = a.rank - b.rank;
    } else {
      cmp = parseFloat(a[sortKey]) - parseFloat(b[sortKey]);
    }
    return sortAsc ? cmp : -cmp;
  });

  // Stats
  const totalMembers = data.length;
  const totalOG = data.reduce((sum, e) => sum + parseFloat(e.ogRespect || '0'), 0);
  const totalZOR = data.reduce((sum, e) => sum + parseFloat(e.zorRespect || '0'), 0);

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortAsc ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div className="min-h-screen bg-background dark">
      <Head>
        <title>ZAO Respect Leaderboard</title>
        <meta
          name="description"
          content="ZAO Fractal Respect leaderboard — onchain reputation rankings on Optimism"
        />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            Onchain Reputation
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="fractal-gradient bg-clip-text text-transparent">
              Respect
            </span>{' '}
            Leaderboard
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Live rankings from the ZAO Respect contracts on Optimism.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="fractal-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{totalMembers}</p>
            </CardContent>
          </Card>
          <Card className="fractal-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total OG Respect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {totalOG.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="fractal-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total ZOR Respect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {totalZOR.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-pulse-fractal text-2xl text-muted-foreground">
              Loading onchain data...
            </div>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-red-400">
              {error}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th
                    className="px-4 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('rank')}
                  >
                    Rank{sortArrow('rank')}
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('name')}
                  >
                    Name{sortArrow('name')}
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('ogRespect')}
                  >
                    OG Respect{sortArrow('ogRespect')}
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('zorRespect')}
                  >
                    ZOR Respect{sortArrow('zorRespect')}
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-medium text-muted-foreground text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('totalRespect')}
                  >
                    Total{sortArrow('totalRespect')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => {
                  const isTop3 = entry.rank <= 3;
                  return (
                    <tr
                      key={entry.wallet}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        isTop3 ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {getMedal(entry.rank)} {entry.rank}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://thezao.com/community/${slugify(entry.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {entry.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {parseFloat(entry.ogRespect).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {parseFloat(entry.zorRespect).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                        {parseFloat(entry.totalRespect).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground border-t border-border pt-8">
          <p>ZAO Fractal &bull; Built for ETH Boulder 2026</p>
          <p className="mt-1">
            <a
              href="https://zao.frapps.xyz"
              className="hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Onchain Dashboard
            </a>
            {' \u00B7 '}
            <a
              href="https://discord.gg/thezao"
              className="hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
            {' \u00B7 '}
            <a
              href="https://github.com/bettercallzaal/fractalbotfeb2026"
              className="hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
