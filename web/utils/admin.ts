import { getServerSession } from 'next-auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';

const SUPREME_ADMIN_ROLE_ID = '1142290553933938748';
const GUILD_ID = '1127115902010277989';

export async function isSupremeAdmin(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return false;
    const member = await res.json();
    return member.roles?.includes(SUPREME_ADMIN_ROLE_ID) ?? false;
  } catch {
    return false;
  }
}

/**
 * Require admin authentication for an API route.
 * Returns the session if authorized, or sends a 401/403 and returns null.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  authOptions: any
): Promise<(Session & { user: { isAdmin: boolean; accessToken?: string; discordId?: string } }) | null> {
  const session = await getServerSession(req, res, authOptions) as any;
  if (!session?.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!session.user.isAdmin) {
    res.status(403).json({ error: 'Supreme Admin role required' });
    return null;
  }
  return session;
}
