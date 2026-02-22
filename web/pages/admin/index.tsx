import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

// ---------- Types ----------

interface Member {
  name: string;
  wallet: string;
  hasIntro: boolean;
}

interface Contribution {
  id: number;
  memberName: string;
  type: string;
  description: string;
  respectAmount: number;
  loggedBy: string;
  createdAt: string;
}

interface Allocation {
  id: number;
  memberName: string;
  walletAddress: string;
  amount: number;
  reason: string | null;
  status: string;
  contributionId: number | null;
  loggedBy: string;
  distributedAt: string | null;
  createdAt: string;
}

// ---------- Helpers ----------

function truncateWallet(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const CONTRIBUTION_TYPES = ['intro', 'attendance', 'special', 'fractal_hosting'] as const;

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'intro':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'attendance':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'special':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'fractal_hosting':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return '';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'distributed':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return '';
  }
}

// ---------- Members Tab ----------

function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/members')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load members');
        return res.json();
      })
      .then((data: Member[]) => {
        setMembers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-pulse text-lg text-muted-foreground">Loading members...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-400">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Wallet</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Has Intro</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((member) => (
              <tr key={member.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{member.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                  {truncateWallet(member.wallet)}
                </td>
                <td className="px-4 py-3">
                  {member.hasIntro ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Yes</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No</Badge>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Contributions Tab ----------

function ContributionsTab() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [memberName, setMemberName] = useState('');
  const [type, setType] = useState<string>('intro');
  const [description, setDescription] = useState('');
  const [respectAmount, setRespectAmount] = useState<number | ''>('');

  const fetchContributions = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/contributions')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load contributions');
        return res.json();
      })
      .then((data: Contribution[]) => {
        setContributions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !type || !description || !respectAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName,
          type,
          description,
          respectAmount: Number(respectAmount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create contribution');
      }

      // Reset form and refresh
      setMemberName('');
      setType('intro');
      setDescription('');
      setRespectAmount('');
      setShowForm(false);
      fetchContributions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contributions</h3>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? 'Cancel' : 'Log Contribution'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Log New Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Member Name
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Alice"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CONTRIBUTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="What did this member contribute?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Respect Amount
                </label>
                <input
                  type="number"
                  value={respectAmount}
                  onChange={(e) => setRespectAmount(e.target.value ? Number(e.target.value) : '')}
                  required
                  min={1}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 10"
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Logging...' : 'Log Contribution'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-4 text-center text-red-400">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-pulse text-lg text-muted-foreground">Loading contributions...</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Member</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Amount</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{c.memberName}</td>
                  <td className="px-4 py-3">
                    <Badge className={typeBadgeClass(c.type)}>
                      {c.type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    {c.description}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                    {c.respectAmount}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </td>
                </tr>
              ))}
              {contributions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No contributions logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Allocations Tab ----------

function AllocationsTab() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form state
  const [memberName, setMemberName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  const fetchAllocations = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/allocations')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load allocations');
        return res.json();
      })
      .then((data: Allocation[]) => {
        setAllocations(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !walletAddress || !amount) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName,
          walletAddress,
          amount: Number(amount),
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create allocation');
      }

      // Reset form and refresh
      setMemberName('');
      setWalletAddress('');
      setAmount('');
      setReason('');
      setShowForm(false);
      fetchAllocations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: 'distributed' | 'cancelled') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/allocations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update allocation');
      }

      fetchAllocations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Allocations</h3>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? 'Cancel' : 'Create Allocation'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Member Name
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Alice"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  required
                  min={1}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Optional reason for this allocation"
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Allocation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-4 text-center text-red-400">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-pulse text-lg text-muted-foreground">Loading allocations...</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Member</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Wallet</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-right">Amount</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{a.memberName}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {truncateWallet(a.walletAddress)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold">{a.amount}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusBadgeClass(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                          disabled={actionLoading === a.id}
                          onClick={() => handleStatusUpdate(a.id, 'distributed')}
                        >
                          {actionLoading === a.id ? '...' : 'Distribute'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          disabled={actionLoading === a.id}
                          onClick={() => handleStatusUpdate(a.id, 'cancelled')}
                        >
                          {actionLoading === a.id ? '...' : 'Cancel'}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {allocations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No allocations created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Main Admin Page ----------

export default function AdminDashboard() {
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAdmin = session?.user?.isAdmin === true;

  return (
    <DashboardLayout title="Admin Dashboard">
      <Head>
        <title>Admin Dashboard | ZAO Fractal</title>
        <meta name="description" content="ZAO Fractal admin dashboard - manage members, contributions, and allocations" />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="fractal-gradient bg-clip-text text-transparent">Admin</span> Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage members, log contributions, and distribute Respect allocations.
          </p>
        </div>

        {/* Auth gate */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-pulse text-lg text-muted-foreground">
              Checking authentication...
            </div>
          </div>
        ) : !session ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground text-lg">
                You must sign in with Discord to access the admin dashboard.
              </p>
              <Button onClick={() => signIn('discord')}>
                Sign in with Discord
              </Button>
            </CardContent>
          </Card>
        ) : !isAdmin ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground text-lg">
                Access denied. The Supreme Admin role is required to view this page.
              </p>
              <p className="text-sm text-muted-foreground">
                Signed in as {session.user.name || session.user.discordId}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="contributions">Contributions</TabsTrigger>
              <TabsTrigger value="allocations">Allocations</TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <MembersTab />
            </TabsContent>

            <TabsContent value="contributions">
              <ContributionsTab />
            </TabsContent>

            <TabsContent value="allocations">
              <AllocationsTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
