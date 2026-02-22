import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import DashboardLayout from '../components/layout/DashboardLayout';
import type { CombinedLeaderboardEntry, DashboardStats, ActivityItem } from '../types/dashboard';

type SortKey = 'rank' | 'name' | 'ogRespect' | 'zorRespect' | 'offchainRespect' | 'totalRespect';

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

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatTimestamp(ts: string): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return ts;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case 'fractal':
      return 'default';
    case 'proposal':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function RespectDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<CombinedLeaderboardEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');

  // Fetch stats and leaderboard on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((res) => {
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json();
      }),
      fetch('/api/dashboard/leaderboard').then((res) => {
        if (!res.ok) throw new Error('Failed to load leaderboard');
        return res.json();
      }),
    ])
      .then(([statsData, leaderboardData]) => {
        setStats(statsData);
        setLeaderboard(leaderboardData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Fetch activity when tab switches to activity
  useEffect(() => {
    if (activeTab === 'activity' && activity.length === 0) {
      setActivityLoading(true);
      fetch('/api/dashboard/activity?limit=20')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load activity');
          return res.json();
        })
        .then((data: ActivityItem[]) => {
          setActivity(data);
          setActivityLoading(false);
        })
        .catch(() => {
          setActivityLoading(false);
        });
    }
  }, [activeTab, activity.length]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank' || key === 'name');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortAsc ? ' \u25B2' : ' \u25BC';
  };

  const filtered = leaderboard.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'rank') {
      cmp = a.rank - b.rank;
    } else {
      cmp = a[sortKey] - b[sortKey];
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <DashboardLayout title="Respect Dashboard">
      <Head>
        <title>Respect Dashboard | ZAO Fractal</title>
        <meta
          name="description"
          content="Combined Respect dashboard — onchain and offchain reputation rankings for ZAO Fractal"
        />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            All Respect Types
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="fractal-gradient bg-clip-text text-transparent">
              Respect Dashboard
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Combined onchain and offchain Respect rankings for the ZAO community.
          </p>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="fractal-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Loading...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-9 w-24 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="fractal-card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Total Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {stats.totalMembers}
                </p>
              </CardContent>
            </Card>
            <Card className="fractal-card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  OG Respect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {formatNumber(stats.totalOGRespect)}
                </p>
              </CardContent>
            </Card>
            <Card className="fractal-card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  ZOR Respect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {formatNumber(stats.totalZORRespect)}
                </p>
              </CardContent>
            </Card>
            <Card className="fractal-card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Offchain Respect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {formatNumber(stats.totalOffchainRespect)}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs
          defaultValue="leaderboard"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4">
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
                  Loading combined Respect data...
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
                        onClick={() => handleSort('offchainRespect')}
                      >
                        Offchain{sortArrow('offchainRespect')}
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
                          key={entry.wallet || entry.name}
                          className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                            isTop3 ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-medium">
                            {getMedal(entry.rank)} {entry.rank}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/members/${slugify(entry.name)}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {entry.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {formatNumber(entry.ogRespect)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {formatNumber(entry.zorRespect)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {formatNumber(entry.offchainRespect)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                            {formatNumber(entry.totalRespect)}
                          </td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
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
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            {activityLoading ? (
              <div className="text-center py-16">
                <div className="animate-pulse-fractal text-2xl text-muted-foreground">
                  Loading activity...
                </div>
              </div>
            ) : activity.length === 0 && activeTab === 'activity' ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No recent activity found.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activity.map((item, idx) => (
                  <Card key={`${item.type}-${item.timestamp}-${idx}`} className="fractal-card-hover">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <Badge variant={getTypeBadgeVariant(item.type)} className="shrink-0 mt-0.5">
                            {item.type}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
