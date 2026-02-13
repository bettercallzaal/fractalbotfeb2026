import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { db } from '../../../utils/database';
import { users } from '../../../utils/schema';
import { eq } from 'drizzle-orm';

interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
}

// Validate required environment variables
if (!process.env.DISCORD_CLIENT_ID) {
  console.error('DISCORD_CLIENT_ID is not set');
}
if (!process.env.DISCORD_CLIENT_SECRET) {
  console.error('DISCORD_CLIENT_SECRET is not set');
}
if (!process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET is not set');
}

export default NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'discord' && profile) {
        try {
          const discordProfile = profile as DiscordProfile;

          // Check if user exists in database
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.discordId, discordProfile.id))
            .limit(1);

          if (existingUser.length === 0) {
            // Create new user
            await db.insert(users).values({
              discordId: discordProfile.id,
              username: discordProfile.username,
              displayName: discordProfile.global_name || discordProfile.username,
              avatarUrl: `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`,
            });
          } else {
            // Update existing user info
            await db
              .update(users)
              .set({
                username: discordProfile.username,
                displayName: discordProfile.global_name || discordProfile.username,
                avatarUrl: `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`,
                updatedAt: new Date(),
              })
              .where(eq(users.discordId, discordProfile.id));
          }
        } catch (error) {
          console.error('Error handling user sign in:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        // Get user data from database
        const userData = await db
          .select()
          .from(users)
          .where(eq(users.discordId, token.sub as string))
          .limit(1);

        if (userData.length > 0 && session.user) {
          session.user.id = userData[0].id.toString();
          session.user.discordId = userData[0].discordId;
          session.user.walletAddress = userData[0].walletAddress;
          session.user.totalFractals = userData[0].totalFractals ?? 0;
          session.user.totalWins = userData[0].totalWins ?? 0;
        }
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as DiscordProfile;
        token.discordId = discordProfile.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
});
