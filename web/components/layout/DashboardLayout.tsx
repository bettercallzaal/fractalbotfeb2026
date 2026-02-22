import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../../utils/cn';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/respect', label: 'Respect' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/guide', label: 'Guide' },
];

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            <span className="fractal-gradient bg-clip-text text-transparent">ZAO</span>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  router.pathname === link.href
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
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
      </footer>
    </div>
  );
}
