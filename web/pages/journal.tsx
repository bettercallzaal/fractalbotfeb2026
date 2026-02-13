import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  BookOpen,
  Search,
  Send,
  RefreshCw,
  Zap,
  Clock,
  ArrowLeft,
  Loader2,
  Database,
  Brain,
  FileText,
  Network,
} from 'lucide-react';

interface Episode {
  uuid: string;
  name: string;
  content: string;
  source_description?: string;
  created_at?: string;
}

interface Entity {
  uuid: string;
  name: string;
  summary?: string;
}

interface StackStatus {
  message_count: number;
  user_count: number;
  last_message_at: string | null;
  next_process_at: string | null;
  time_until_next_process: number | null;
  is_ready_for_processing: boolean;
}

export default function JournalPage() {
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState('log');

  // Log state
  const [entry, setEntry] = useState('');
  const [logging, setLogging] = useState(false);
  const [logResult, setLogResult] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchEpisodes, setSearchEpisodes] = useState<Episode[]>([]);
  const [searchEntities, setSearchEntities] = useState<Entity[]>([]);

  // Timeline state
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Status state
  const [stackStatus, setStackStatus] = useState<StackStatus | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/journal/status');
      if (res.ok) {
        const data = await res.json();
        setStackStatus(data);
      }
    } catch (e) {
      console.error('Status fetch error:', e);
    }
  }, []);

  const fetchEpisodes = useCallback(async () => {
    setLoadingEpisodes(true);
    try {
      const res = await fetch('/api/journal/episodes');
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data.episodes || []);
      }
    } catch (e) {
      console.error('Episodes fetch error:', e);
    } finally {
      setLoadingEpisodes(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchStatus();
      fetchEpisodes();
    }
  }, [session, fetchStatus, fetchEpisodes]);

  const handleLog = async () => {
    if (!entry.trim()) return;
    setLogging(true);
    setLogResult(null);
    try {
      const res = await fetch('/api/journal/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: entry.trim(),
          userId: session?.user?.discordId || 'bettercallzaal',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLogResult(`Logged! Stack: ${data.stack_count} messages queued`);
        setEntry('');
        fetchStatus();
      } else {
        setLogResult(`Error: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      setLogResult('Failed to log entry');
    } finally {
      setLogging(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchEpisodes([]);
    setSearchEntities([]);
    try {
      const res = await fetch('/api/journal/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), numResults: 10 }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchEpisodes(data.episodes || []);
        setSearchEntities(data.entities || []);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/journal/process', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLogResult(`Processed ${data.message_count} messages into episode`);
        fetchStatus();
        fetchEpisodes();
      } else {
        setLogResult(`Process error: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      setLogResult('Failed to process stack');
    } finally {
      setProcessing(false);
    }
  };

  // Parse episode content - it's often JSON with a nested content field
  const parseContent = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw);
      return parsed.content || parsed.summary || raw;
    } catch {
      return raw;
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fractal-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fractal-primary/10 to-fractal-secondary/10 flex items-center justify-center">
        <Head>
          <title>Builder Journal - ETH Boulder</title>
        </Head>
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <BookOpen className="h-12 w-12 text-fractal-primary mx-auto mb-2" />
            <CardTitle>Builder Journal</CardTitle>
            <CardDescription>Sign in to access your ETH Boulder builder journal</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => signIn('discord')} className="bg-fractal-primary hover:bg-fractal-primary/90">
              Sign in with Discord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Builder Journal - ETH Boulder</title>
      </Head>

      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-fractal-primary" />
              Builder Journal
            </h1>
          </div>

          {/* Status indicator */}
          {stackStatus && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                {stackStatus.message_count} queued
              </Badge>
              {stackStatus.is_ready_for_processing && (
                <Badge className="bg-fractal-secondary text-white flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Ready to process
                </Badge>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                Queued
              </div>
              <div className="text-2xl font-bold">{stackStatus?.message_count ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Brain className="h-4 w-4" />
                Episodes
              </div>
              <div className="text-2xl font-bold">{episodes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Last Entry
              </div>
              <div className="text-sm font-medium truncate">
                {stackStatus?.last_message_at
                  ? new Date(stackStatus.last_message_at).toLocaleString()
                  : '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Network className="h-4 w-4" />
                Status
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProcess}
                  disabled={processing}
                  className="text-xs"
                >
                  {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Process
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchStatus} className="text-xs">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result banner */}
        {logResult && (
          <div className="mb-4 p-3 rounded-lg bg-fractal-primary/10 border border-fractal-primary/20 text-sm">
            {logResult}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="log" className="flex items-center gap-1">
              <Send className="h-3.5 w-3.5" />
              Log Entry
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-1">
              <Search className="h-3.5 w-3.5" />
              Search KG
            </TabsTrigger>
          </TabsList>

          {/* LOG TAB */}
          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Log Builder Update</CardTitle>
                <CardDescription>
                  Record what you built, learned, or decided. Entries are stored in the Bonfires Knowledge Graph.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <textarea
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="What did you build, learn, or decide today?"
                    className="w-full min-h-[120px] p-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-fractal-primary resize-y"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) handleLog();
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Cmd+Enter to submit</span>
                    <Button
                      onClick={handleLog}
                      disabled={logging || !entry.trim()}
                      className="bg-fractal-primary hover:bg-fractal-primary/90"
                    >
                      {logging ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Log Entry
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Knowledge Graph Episodes</h2>
              <Button variant="outline" size="sm" onClick={fetchEpisodes} disabled={loadingEpisodes}>
                {loadingEpisodes ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            {loadingEpisodes ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-fractal-primary" />
                <p className="text-muted-foreground mt-2">Loading episodes...</p>
              </div>
            ) : episodes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No episodes yet. Log some entries and process them!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {episodes.map((ep, i) => (
                  <EpisodeCard key={ep.uuid || i} episode={ep} parseContent={parseContent} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* SEARCH TAB */}
          <TabsContent value="search">
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search the Knowledge Graph..."
                    className="flex-1 p-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-fractal-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="bg-fractal-primary hover:bg-fractal-primary/90"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {(searchEpisodes.length > 0 || searchEntities.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{searchEpisodes.length} episodes</span>
                  <span className="text-border">|</span>
                  <span>{searchEntities.length} entities</span>
                </div>

                {searchEntities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {searchEntities.map((ent, i) => (
                      <Badge key={ent.uuid || i} variant="secondary" className="text-xs py-1">
                        {ent.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {searchEpisodes.map((ep, i) => (
                  <EpisodeCard key={ep.uuid || i} episode={ep} parseContent={parseContent} />
                ))}
              </div>
            )}

            {searching && (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-fractal-primary" />
                <p className="text-muted-foreground mt-2">Searching knowledge graph...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EpisodeCard({
  episode,
  parseContent,
}: {
  episode: Episode;
  parseContent: (raw: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = parseContent(episode.content || '');
  const isLong = content.length > 300;
  const displayContent = expanded || !isLong ? content : content.slice(0, 300) + '...';

  return (
    <Card className="fractal-card-hover">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-snug">{episode.name}</CardTitle>
          {episode.source_description && (
            <Badge variant="secondary" className="text-xs shrink-0 ml-2">
              {episode.source_description}
            </Badge>
          )}
        </div>
        {episode.created_at && (
          <CardDescription className="text-xs">
            {new Date(episode.created_at).toLocaleString()}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {displayContent}
        </p>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-fractal-primary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
