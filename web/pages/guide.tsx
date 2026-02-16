import Head from 'next/head';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const RESPECT_POINTS = [
  { rank: '🥇 1st', level: 6, points: 110 },
  { rank: '🥈 2nd', level: 5, points: 68 },
  { rank: '🥉 3rd', level: 4, points: 42 },
  { rank: '4th', level: 3, points: 26 },
  { rank: '5th', level: 2, points: 16 },
  { rank: '6th', level: 1, points: 10 },
];

const STEPS = [
  {
    emoji: '🎙️',
    title: 'Group Up',
    description: '2-6 people join the same voice channel in Discord. This is your breakout group for the round.',
  },
  {
    emoji: '🚀',
    title: 'Start Fractal',
    description: 'The facilitator runs /zaofractal, confirms the members, and enters the fractal number and group number.',
  },
  {
    emoji: '🗳️',
    title: 'Vote',
    description: 'Starting from Level 6, each member votes for who contributed the most. When enough votes align on one person, they\'re ranked and the next level begins.',
  },
  {
    emoji: '🏆',
    title: 'Results',
    description: 'Once all levels are ranked, the bot posts results with Respect points earned and a one-click link to submit onchain.',
  },
  {
    emoji: '⛓️',
    title: 'Earn Respect',
    description: 'Click the link to submit rankings to the ZAO Respect contract on Optimism. Respect is a soulbound ERC-1155 token — your permanent onchain reputation.',
  },
];

const COMMANDS = [
  { cmd: '/zaofractal', desc: 'Start a fractal from your voice channel' },
  { cmd: '/endgroup', desc: 'End your fractal (facilitator only)' },
  { cmd: '/status', desc: 'Check fractal status in the thread' },
  { cmd: '/guide', desc: 'Show this guide in Discord' },
  { cmd: '/register <wallet>', desc: 'Link your Ethereum wallet' },
  { cmd: '/wallet', desc: 'Show your linked wallet' },
  { cmd: '/groupwallets', desc: 'Show all group wallets' },
];

export default function Guide() {
  return (
    <div className="min-h-screen bg-background dark">
      <Head>
        <title>ZAO Fractal Guide — How It Works</title>
        <meta name="description" content="Learn how ZAO Fractal voting works — fractal democracy for onchain Respect tokens" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-16 space-y-12">

        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            ETH Boulder 2026
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            How <span className="fractal-gradient bg-clip-text text-transparent">ZAO Fractal</span> Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A fractal democracy system where small groups reach consensus on contribution rankings
            and earn onchain Respect tokens on Optimism.
          </p>
        </div>

        {/* What is Fractal Democracy */}
        <Card className="fractal-card-hover">
          <CardHeader>
            <CardTitle className="text-xl">🌀 What is Fractal Democracy?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Fractal democracy breaks large groups into small breakout sessions of 2-6 people.
              Each group has a focused conversation, then members rank each other based on contributions.
            </p>
            <p>
              Rankings are submitted onchain as <strong className="text-foreground">Respect tokens</strong> — soulbound
              ERC-1155 tokens that represent your reputation and contributions over time.
              The more you contribute, the more Respect you earn.
            </p>
            <p>
              Pioneered by{' '}
              <a href="https://edenfractal.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                Eden Fractal
              </a>{' '}
              and{' '}
              <a href="https://optimismfractal.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                Optimism Fractal
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* How It Works — Step by Step */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-center">How It Works</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <Card key={i} className="fractal-card-hover">
                <CardContent className="p-6 flex gap-4 items-start">
                  <div className="text-4xl shrink-0">{step.emoji}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">Step {i + 1}</Badge>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Voting Mechanics */}
        <Card className="fractal-card-hover">
          <CardHeader>
            <CardTitle className="text-xl">🗳️ Voting Mechanics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Voting happens in rounds, starting at <strong className="text-foreground">Level 6</strong> (highest) down to{' '}
              <strong className="text-foreground">Level 1</strong> (lowest).
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong className="text-foreground">Each round:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Everyone votes for who they think contributed most (from the remaining candidates)</li>
                <li>When enough votes converge on one person, they&apos;re ranked at that level</li>
                <li>That person is removed from candidates and the next round begins</li>
                <li>The threshold adapts to group size — smaller groups need fewer votes to agree</li>
              </ul>
            </div>
            <p>
              The bot handles all the mechanics via Discord buttons — just click to vote.
              The facilitator can use <code className="bg-muted px-1 rounded">/endgroup</code> if needed.
            </p>
          </CardContent>
        </Card>

        {/* Respect Points Table */}
        <Card className="fractal-card-hover">
          <CardHeader>
            <CardTitle className="text-xl">🏆 Respect Points</CardTitle>
            <p className="text-sm text-muted-foreground">Year 2 — 2x Fibonacci sequence</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {RESPECT_POINTS.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-medium w-16">{row.rank}</span>
                    <Badge variant="outline">Level {row.level}</Badge>
                  </div>
                  <span className="text-lg font-bold text-primary">+{row.points} Respect</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Onchain Submission */}
        <Card className="fractal-card-hover">
          <CardHeader>
            <CardTitle className="text-xl">⛓️ Submitting Results Onchain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              After a fractal completes, the bot generates a pre-filled link to{' '}
              <a href="https://zao.frapps.xyz/submitBreakout" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                zao.frapps.xyz/submitBreakout
              </a>{' '}
              with all ranked wallet addresses.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong className="text-foreground">To get your wallet linked:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Run <code className="bg-muted px-1 rounded">/register 0xYourWallet</code> in Discord</li>
                <li>Or ask an admin to register it for you</li>
                <li>Your wallet is mapped to your Discord account permanently</li>
              </ul>
            </div>
            <p>
              Respect tokens are <strong className="text-foreground">soulbound</strong> (non-transferable) ERC-1155 tokens
              on Optimism, powered by the{' '}
              <a href="https://github.com/Optimystics/frapps" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                ORDAO toolkit
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* Commands Reference */}
        <Card className="fractal-card-hover">
          <CardHeader>
            <CardTitle className="text-xl">⌨️ Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {COMMANDS.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-primary shrink-0">
                    {c.cmd}
                  </code>
                  <span className="text-muted-foreground">{c.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Get Started CTA */}
        <div className="text-center space-y-4 py-8">
          <h2 className="text-3xl font-bold">Ready to Earn Respect?</h2>
          <p className="text-muted-foreground">
            Join THE ZAO Discord and hop in a voice channel to start your first fractal.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="https://discord.gg/thezao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg fractal-gradient text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Join THE ZAO Discord
            </a>
            <a
              href="https://zao.frapps.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-muted transition-colors"
            >
              View Onchain Dashboard
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground border-t border-border pt-8">
          <p>ZAO Fractal • Built for ETH Boulder 2026</p>
          <p className="mt-1">
            <a href="https://optimismfractal.com" className="hover:underline" target="_blank" rel="noopener noreferrer">Optimism Fractal</a>
            {' · '}
            <a href="https://edenfractal.com" className="hover:underline" target="_blank" rel="noopener noreferrer">Eden Fractal</a>
            {' · '}
            <a href="https://github.com/bettercallzaal/fractalbotfeb2026" className="hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a>
          </p>
        </div>

      </div>
    </div>
  );
}
