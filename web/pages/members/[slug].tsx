import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import type { MemberProfile, FractalParticipation } from '../../types/dashboard';

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getMedal(rank: number): string {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return '';
}

export default function MemberProfilePage() {
  const router = useRouter();
  const { slug } = router.query;

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug || typeof slug !== 'string') return;

    setLoading(true);
    setError('');

    fetch(`/api/dashboard/members/${slug}`)
      .then((res) => {
        if (res.status === 404) {
          throw new Error('Member not found');
        }
        if (!res.ok) {
          throw new Error('Failed to load member profile');
        }
        return res.json();
      })
      .then((data: MemberProfile) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  const handleCopyAddress = async () => {
    if (!profile?.wallet) return;
    try {
      await navigator.clipboard.writeText(profile.wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = profile.wallet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const podiumFinishes =
    profile
      ? profile.stats.firstPlace + profile.stats.secondPlace + profile.stats.thirdPlace
      : 0;

  return (
    <div className="min-h-screen bg-background dark">
      <Head>
        <title>
          {profile ? `${profile.name} - ZAO Member Profile` : 'Member Profile - ZAO Fractal'}
        </title>
        <meta
          name="description"
          content={
            profile
              ? `${profile.name}'s ZAO Fractal profile - Respect rankings, fractal history, and onchain reputation`
              : 'ZAO Fractal member profile'
          }
        />
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-8">
        {/* Back Link */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Leaderboard
        </Link>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="animate-pulse-fractal text-2xl text-muted-foreground">
              Loading member profile...
            </div>
          </div>
        )}

        {/* Error / Not Found State */}
        {!loading && error && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-2xl font-semibold text-muted-foreground mb-2">
                {error === 'Member not found' ? 'Member Not Found' : 'Error'}
              </p>
              <p className="text-muted-foreground mb-6">
                {error === 'Member not found'
                  ? 'No member matches this profile URL. They may not have a registered wallet yet.'
                  : error}
              </p>
              <Link href="/leaderboard">
                <Button variant="outline">Back to Leaderboard</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Profile Content */}
        {!loading && !error && profile && (
          <>
            {/* Member Header */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 space-y-2">
                  <h1 className="text-4xl font-bold tracking-tight">
                    <span className="fractal-gradient bg-clip-text text-transparent">
                      {profile.name}
                    </span>
                  </h1>
                  {profile.wallet && (
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {truncateAddress(profile.wallet)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleCopyAddress}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.hasIntro && (
                    <Badge variant="secondary">Has Intro</Badge>
                  )}
                  {profile.wallet ? (
                    <Badge variant="default">Wallet Registered</Badge>
                  ) : (
                    <Badge variant="outline">No Wallet</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="fractal-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    OG Respect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    {profile.ogRespect.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">ERC-20 on Optimism</p>
                </CardContent>
              </Card>

              <Card className="fractal-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    ZOR Respect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    {profile.zorRespect.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">ERC-1155 on Optimism</p>
                </CardContent>
              </Card>

              <Card className="fractal-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Offchain Respect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    {profile.offchainRespect.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">From fractal rounds</p>
                </CardContent>
              </Card>

              <Card className="fractal-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Total Respect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold fractal-gradient bg-clip-text text-transparent">
                    {profile.totalRespect.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Combined score</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="history">
                  Fractal History ({profile.fractalHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Intro Text */}
                {profile.hasIntro && profile.introText && (
                  <Card className="fractal-card-hover">
                    <CardHeader>
                      <CardTitle className="text-lg">Introduction</CardTitle>
                      <CardDescription>
                        From the #intros channel on Discord
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {profile.introText}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Stats */}
                <Card className="fractal-card-hover">
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Stats</CardTitle>
                    <CardDescription>
                      Performance across all fractal rounds
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Participations</p>
                        <p className="text-2xl font-bold">{profile.stats.participations}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Podium Finishes</p>
                        <p className="text-2xl font-bold">{podiumFinishes}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Avg Respect / Round</p>
                        <p className="text-2xl font-bold">{profile.stats.avgRespect}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Placement Breakdown</p>
                        <div className="flex items-center gap-3 text-lg">
                          <span title="1st place finishes">
                            {'\uD83E\uDD47'} {profile.stats.firstPlace}
                          </span>
                          <span title="2nd place finishes">
                            {'\uD83E\uDD48'} {profile.stats.secondPlace}
                          </span>
                          <span title="3rd place finishes">
                            {'\uD83E\uDD49'} {profile.stats.thirdPlace}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* No intro message */}
                {!profile.hasIntro && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <p>This member hasn&apos;t posted an intro in the #intros channel yet.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Fractal History Tab */}
              <TabsContent value="history" className="space-y-4">
                {profile.fractalHistory.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No fractal participation history yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-sm font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="px-4 py-3 text-sm font-medium text-muted-foreground">
                            Group Name
                          </th>
                          <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">
                            Rank
                          </th>
                          <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">
                            Respect Earned
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...profile.fractalHistory]
                          .reverse()
                          .map((entry: FractalParticipation, idx: number) => {
                            const isTop3 = entry.rank <= 3;
                            return (
                              <tr
                                key={`${entry.fractalId}-${idx}`}
                                className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                                  isTop3 ? 'bg-primary/5' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-sm font-mono">
                                  {entry.date}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {entry.groupName}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {getMedal(entry.rank)}{' '}
                                  <span className={isTop3 ? 'font-semibold' : ''}>
                                    #{entry.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-mono font-bold text-primary">
                                  +{entry.respect}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

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
          </>
        )}
      </div>
    </div>
  );
}
