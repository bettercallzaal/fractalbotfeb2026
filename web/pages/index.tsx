import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Head from 'next/head';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  Users,
  Trophy,
  Vote,
  Activity,
  Play,
  Pause,
  Clock,
  ExternalLink
} from 'lucide-react';

interface Fractal {
  id: number;
  threadId: string;
  name: string;
  status: string;
  participantCount: number;
  currentLevel: number;
  isPaused: boolean;
  createdAt: string;
  facilitator: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [fractals, setFractals] = useState<Fractal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchFractals();
    }
  }, [session]);

  const fetchFractals = async () => {
    try {
      const response = await fetch('/api/fractals');
      if (response.ok) {
        const data = await response.json();
        setFractals(data);
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-fractal-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fractal-primary/10 to-fractal-secondary/10">
        <Head>
          <title>ZAO Fractal Voting System</title>
          <meta name="description" content="Democratic decision-making through fractal voting" />
        </Head>

        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-fractal-primary to-fractal-secondary bg-clip-text text-transparent">
              ZAO Fractal
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Democratic decision-making through transparent fractal voting. Connect your Discord account to participate in community governance.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card>
                <CardHeader>
                  <Users className="h-8 w-8 text-fractal-primary mb-2" />
                  <CardTitle>Community Driven</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Every voice matters. Participate in transparent, democratic decision-making processes.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Vote className="h-8 w-8 text-fractal-secondary mb-2" />
                  <CardTitle>Fair Voting</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Progressive elimination voting ensures the best ideas rise to the top through multiple rounds.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Trophy className="h-8 w-8 text-fractal-accent mb-2" />
                  <CardTitle>Track Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View your participation history, wins, and contribution to community decisions.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={() => signIn('discord')}
              size="lg"
              className="bg-fractal-primary hover:bg-fractal-primary/90"
            >
              <Image
                src="/discord-logo.svg"
                alt="Discord"
                width={20}
                height={20}
                className="mr-2"
              />
              Sign in with Discord
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeFractals = fractals.filter(f => f.status === 'active');
  const completedFractals = fractals.filter(f => f.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Dashboard - ZAO Fractal</title>
      </Head>

      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-fractal-primary">ZAO Fractal</h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user?.image || ''} />
                <AvatarFallback>{session.user?.name?.[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{session.user?.name}</span>
            </div>

            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Fractals</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeFractals.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Participation</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{session.user?.totalFractals ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wins</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{session.user?.totalWins ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(session.user?.totalFractals ?? 0) > 0
                  ? Math.round(((session.user?.totalWins ?? 0) / (session.user?.totalFractals ?? 0)) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fractals Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Fractals ({activeFractals.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedFractals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading fractals...</div>
            ) : activeFractals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No active fractals at the moment.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Join a voice channel in Discord and use <code>/zaofractal</code> to start a new fractal!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeFractals.map((fractal) => (
                  <FractalCard key={fractal.id} fractal={fractal} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedFractals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No completed fractals yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedFractals.map((fractal) => (
                  <FractalCard key={fractal.id} fractal={fractal} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FractalCard({ fractal }: { fractal: Fractal }) {
  const getStatusColor = (status: string, isPaused: boolean) => {
    if (isPaused) return 'bg-yellow-500';
    if (status === 'active') return 'bg-green-500';
    if (status === 'completed') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getStatusIcon = (status: string, isPaused: boolean) => {
    if (isPaused) return <Pause className="h-3 w-3" />;
    if (status === 'active') return <Play className="h-3 w-3" />;
    if (status === 'completed') return <Trophy className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{fractal.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={fractal.facilitator.avatarUrl} />
                <AvatarFallback>{fractal.facilitator.username[0]}</AvatarFallback>
              </Avatar>
              {fractal.facilitator.displayName}
            </CardDescription>
          </div>

          <Badge
            variant="secondary"
            className={`${getStatusColor(fractal.status, fractal.isPaused)} text-white flex items-center gap-1`}
          >
            {getStatusIcon(fractal.status, fractal.isPaused)}
            {fractal.isPaused ? 'Paused' : fractal.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Participants:</span>
            <span>{fractal.participantCount}</span>
          </div>

          {fractal.status === 'active' && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Level:</span>
              <span>Level {fractal.currentLevel}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(fractal.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(`https://discord.com/channels/@me/${fractal.threadId}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View in Discord
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
